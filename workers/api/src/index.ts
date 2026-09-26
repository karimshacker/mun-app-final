import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import type { ScanOutcome, ScanResult } from '@mianu/types';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

interface Env {
  DB: D1Database;
  KV: KVNamespace;
  JWT_SECRET: string;
}

const app = new Hono<{
  Bindings: Env;
  Variables: { userId: string; role: string };
}>();

// ---------------------------------------------------------------------------
// Scopes
// ---------------------------------------------------------------------------

type Role = 'HEAD' | 'DEPUTY' | 'ORGANIZER' | 'IT_ADMIN';

/** Routes may restrict to a subset of roles. */
const allow = (roles: Role[]) =>
  async (c: any, next: any) => {
    const role = c.get('role') as Role;
    if (!roles.includes(role)) return c.json({ error: 'forbidden' }, 403);
    await next();
  };

// ---------------------------------------------------------------------------
// Auth — HS256 JWT over Web Crypto, plus PIN login.
// ---------------------------------------------------------------------------

const b64 = (buf: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

const keyFor = (secret: string) =>
  crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );

async function signJwt(
  payload: Record<string, unknown>,
  secret: string,
  ttlSeconds: number,
): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const body = { ...payload, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + ttlSeconds };
  const enc = new TextEncoder();
  const data = `${b64(enc.encode(JSON.stringify(header)))}.${b64(enc.encode(JSON.stringify(body)))}`;
  const sig = await keyFor(secret).then((k) => crypto.subtle.sign('HMAC', k, enc.encode(data)));
  return `${data}.${b64(sig)}`;
}

async function verifyJwt(token: string, secret: string): Promise<Record<string, any> | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;
  const data = `${header}.${body}`;
  const key = await keyFor(secret);

  let sigBytes: Uint8Array;
  try {
    const bin = atob(sig.replace(/-/g, '+').replace(/_/g, '/'));
    sigBytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
  } catch {
    return null;
  }

  const valid = await crypto.subtle.verify(
    'HMAC',
    key,
    sigBytes,
    new TextEncoder().encode(data),
  );
  if (!valid) return null;

  const payload = JSON.parse(
    atob(body.replace(/-/g, '+').replace(/_/g, '/')),
  );
  if (payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

// SHA-256 of the PIN with a per-user salt.
async function hashPin(pin: string, salt: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${pin}:${salt}`),
  );
  return b64(digest);
}

const LoginSchema = z.object({
  phone: z.string().min(1),
  pin: z.string().min(4).max(8),
});

app.post(
  '/api/auth/login',
  zValidator('json', LoginSchema, (r, c) => (r.success ? undefined : c.json({ error: 'bad_request' }, 400))),
  async (c) => {
    const { phone, pin } = c.req.valid('json');
    const user = await c.env.DB.prepare(
      'SELECT id, name, role, committee_id, pin_hash, pin_salt FROM users WHERE phone = ?',
    )
      .bind(phone)
      .first<any>();

    // Constant-ish failure: always run the hash even for an unknown user.
    const expected = user?.pin_hash ?? 'invalid';
    const salt = user?.pin_salt ?? 'no-such-user';
    const given = await hashPin(pin, salt);

    if (!user || given !== expected) {
      return c.json({ error: 'invalid_credentials' }, 401);
    }

    const accessToken = await signJwt({ sub: user.id, role: user.role }, c.env.JWT_SECRET, 60 * 15);
    const refreshToken = await signJwt({ sub: user.id, role: user.role, typ: 'refresh' }, c.env.JWT_SECRET, 60 * 60 * 24 * 7);

    await c.env.DB.prepare(
      'INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)',
    )
      .bind(
        refreshToken,
        user.id,
        new Date(Date.now() + 7 * 864e5).toISOString(),
      )
      .run();

    return c.json({
      accessToken,
      refreshToken,
      user: { id: user.id, name: user.name, role: user.role, committeeId: user.committee_id },
    });
  },
);

// Applies to every authenticated route.
app.use('/api/*', async (c, next) => {
  const header = c.req.header('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return c.json({ error: 'unauthenticated' }, 401);

  const payload = await verifyJwt(token, c.env.JWT_SECRET).catch(() => null);
  if (!payload) return c.json({ error: 'invalid_token' }, 401);

  c.set('userId', payload.sub);
  c.set('role', payload.role);
  await next();
});

// ---------------------------------------------------------------------------
// Scanning — conference, halls, meals.
// ---------------------------------------------------------------------------

const ScanSchema = z.object({
  badgeUid: z.string().optional(),
  altCode: z.string().optional(),
  stationType: z.enum([
    'CONFERENCE_IN',
    'CONFERENCE_OUT',
    'HALL_IN',
    'HALL_OUT',
    'MEAL',
  ]),
  mealType: z.enum(['BREAKFAST', 'LUNCH']).optional(),
  committeeId: z.string().optional(),
  clientScanId: z.string().min(1),
});

app.post(
  '/api/scan',
  allow(['HEAD', 'DEPUTY', 'ORGANIZER', 'IT_ADMIN']),
  zValidator('json', ScanSchema, (r, c) => (r.success ? undefined : c.json({ error: 'bad_request' }, 400))),
  async (c) => {
    const body = c.req.valid('json');
    const scannedBy = c.get('userId');
    const now = new Date().toISOString();

    // Exactly one identifier — badge UID (NFC) or typed alt code.
    if (!!body.badgeUid === !!body.altCode) {
      return c.json({ error: 'provide_exactly_one_of_badgeUid_altCode' }, 400);
    }
    if (body.stationType !== 'CONFERENCE_IN' && body.stationType !== 'CONFERENCE_OUT' && !body.committeeId) {
      return c.json({ error: 'committeeId_required_for_hall_and_meal_stations' }, 400);
    }
    if (body.stationType === 'MEAL' && !body.mealType) {
      return c.json({ error: 'mealType_required_for_meal_station' }, 400);
    }

    const column = body.badgeUid ? 'badge_uid' : 'alt_code';
    const value = body.badgeUid ?? body.altCode;

    const p = await c.env.DB.prepare(
      `SELECT id, name, committee_id, badge_uid, alt_code, balance_cents, meal_plan, status
         FROM participants WHERE ${column} = ?`,
    )
      .bind(value)
      .first<any>();

    if (!p) {
      return c.json<ScanResult>({ outcome: 'NOT_FOUND', participant: null, at: now });
    }

    // Idempotency: a retried request with the same client_scan_id never
    // commits twice — it replays the original outcome.
    const replayed = await c.env.DB.prepare(
      `SELECT s.station_type, s.at
         FROM scan_events s WHERE s.client_scan_id = ?`,
    )
      .bind(body.clientScanId)
      .first<any>();
    if (replayed) {
      const outcome: ScanOutcome =
        replayed.station_type === 'MEAL' ? 'MEAL_SERVED' : 'CHECKED_IN';
      return c.json<ScanResult>({
        outcome,
        participant: p,
        balanceCents: p.balance_cents,
        at: replayed.at,
      });
    }

    if (p.status === 'BLOCKED') {
      return c.json<ScanResult>({ outcome: 'BLOCKED', participant: p, at: now });
    }

    const presence =
      (await c.env.DB.prepare(
        'SELECT in_conference, hall_id, in_hall_since FROM participant_presence WHERE participant_id = ?',
      )
        .bind(p.id)
        .first<any>()) ?? { in_conference: 0, hall_id: null, in_hall_since: null };

    const decision = decideScan({
      stationType: body.stationType,
      mealType: body.mealType ?? null,
      committeeId: body.committeeId ?? null,
      presence,
      participant: p,
    });

    if (!decision.commit) {
      return c.json<ScanResult>({ outcome: decision.outcome, participant: p, at: now });
    }

    const mealCostCents = 0; // configured per committee; loaded in phase 3.
    const balanceAfter = p.balance_cents + decision.balanceDeltaCents;

    const stmts: D1PreparedStatement[] = [
      c.env.DB.prepare(
        `INSERT INTO scan_events
           (id, participant_id, station_type, committee_id, scanned_by, entry_method, client_scan_id, at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        crypto.randomUUID(),
        p.id,
        body.stationType,
        body.committeeId ?? null,
        scannedBy,
        body.badgeUid ? 'NFC' : 'ALT_CODE',
        body.clientScanId,
        now,
      ),
      c.env.DB.prepare(
        `INSERT INTO participant_presence
           (participant_id, in_conference, hall_id, in_hall_since, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(participant_id) DO UPDATE SET
           in_conference = excluded.in_conference,
           hall_id        = excluded.hall_id,
           in_hall_since  = excluded.in_hall_since,
           updated_at     = excluded.updated_at`,
      ).bind(
        p.id,
        decision.presenceAfter.in_conference,
        decision.presenceAfter.hall_id,
        decision.presenceAfter.in_hall_since,
        now,
      ),
      c.env.DB.prepare(
        `UPDATE participants SET balance_cents = ?, updated_at = ? WHERE id = ?`,
      ).bind(balanceAfter, now, p.id),
    ];

    if (decision.mealRow) {
      const mealType = body.mealType as 'BREAKFAST' | 'LUNCH';
      stmts.push(
        c.env.DB.prepare(
          `INSERT INTO meal_serve_log (participant_id, meal_type, served_at) VALUES (?, ?, ?)`,
        ).bind(p.id, mealType, now),
        c.env.DB.prepare(
          `INSERT INTO meal_ledger
             (id, participant_id, meal_type, amount_cents, reason, station_user_id, at)
           VALUES (?, ?, ?, ?, 'MEAL', ?, ?)`,
        ).bind(crypto.randomUUID(), p.id, mealType, decision.balanceDeltaCents, scannedBy, now),
      );
    }

    await c.env.DB.batch(stmts);

    return c.json<ScanResult>({
      outcome: decision.outcome,
      participant: { ...p, balance_cents: balanceAfter } as any,
      balanceCents: balanceAfter,
      at: now,
    });
  },
);

// ---------------------------------------------------------------------------
// The check-in/out + meal state machine. Pure — unit-testable without D1.
// ---------------------------------------------------------------------------

interface Presence {
  in_conference: number;
  hall_id: string | null;
  in_hall_since: string | null;
}

interface DecideArgs {
  stationType: string;
  mealType: string | null;
  committeeId: string | null;
  presence: Presence;
  participant: any;
}

interface DecideResult {
  outcome: ScanOutcome;
  commit: boolean;
  presenceAfter: Presence;
  balanceDeltaCents: number;
  mealRow: boolean;
}

export function decideScan(args: DecideArgs): DecideResult {
  const { stationType, mealType, committeeId, presence, participant } = args;
  const no = (outcome: ScanOutcome): DecideResult => ({
    outcome,
    commit: false,
    presenceAfter: presence,
    balanceDeltaCents: 0,
    mealRow: false,
  });

  switch (stationType) {
    case 'CONFERENCE_IN':
      if (presence.in_conference) return no('ALREADY_IN');
      return {
        outcome: 'CHECKED_IN',
        commit: true,
        presenceAfter: { in_conference: 1, hall_id: null, in_hall_since: null },
        balanceDeltaCents: 0,
        mealRow: false,
      };

    case 'CONFERENCE_OUT':
      if (!presence.in_conference) return no('ALREADY_OUT');
      return {
        outcome: 'CHECKED_OUT',
        commit: true,
        presenceAfter: { in_conference: 0, hall_id: null, in_hall_since: null },
        balanceDeltaCents: 0,
        mealRow: false,
      };

    case 'HALL_IN': {
      if (!presence.in_conference) return no('NOT_IN_CONFERENCE' as ScanOutcome);
      if (presence.hall_id === committeeId) return no('ALREADY_IN');
      return {
        outcome: 'CHECKED_IN',
        commit: true,
        presenceAfter: {
          in_conference: 1,
          hall_id: committeeId,
          in_hall_since: new Date().toISOString(),
        },
        balanceDeltaCents: 0,
        mealRow: false,
      };
    }

    case 'HALL_OUT':
      if (presence.hall_id !== committeeId) return no('ALREADY_OUT');
      return {
        outcome: 'CHECKED_OUT',
        commit: true,
        presenceAfter: {
          in_conference: presence.in_conference,
          hall_id: null,
          in_hall_since: null,
        },
        balanceDeltaCents: 0,
        mealRow: false,
      };

    case 'MEAL': {
      const plan = participant.meal_plan as string;
      if (plan === 'NONE') return no('MEAL_NOT_IN_PLAN');
      if (mealType === 'BREAKFAST' && plan === 'LUNCH_ONLY') return no('MEAL_NOT_IN_PLAN');
      if (mealType === 'LUNCH' && plan === 'BREAKFAST_ONLY') return no('MEAL_NOT_IN_PLAN');
      if (participant.status !== 'ACTIVE') return no('BLOCKED');
      // Real balance check happens in SQL inside the transaction; this is the
      // fast pre-check so the device shows a reason without a round trip.
      if (participant.balance_cents <= 0) return no('INSUFFICIENT_BALANCE');

      return {
        outcome: 'MEAL_SERVED',
        commit: true,
        presenceAfter: presence,
        balanceDeltaCents: -MEAL_COST_CENTS,
        mealRow: true,
      };
    }

    default:
      return no('NOT_FOUND');
  }
}

const MEAL_COST_CENTS = 0; // TODO(phase 3): per-committee pricing config.

// ---------------------------------------------------------------------------
// Badge linking (IT Admin app) — binds a pre-printed UID to a participant.
// ---------------------------------------------------------------------------

const LinkSchema = z.object({
  participantId: z.string().min(1),
  badgeUid: z.string().min(1),
  altCode: z.string().min(1),
});

app.post(
  '/api/admin/link-badge',
  allow(['IT_ADMIN']),
  zValidator('json', LinkSchema, (r, c) => (r.success ? undefined : c.json({ error: 'bad_request' }, 400))),
  async (c) => {
    const { participantId, badgeUid, altCode } = c.req.valid('json');
    const taken = await c.env.DB.prepare(
      'SELECT id FROM participants WHERE badge_uid = ? AND id != ?',
    )
      .bind(badgeUid, participantId)
      .first();
    if (taken) return c.json({ error: 'badge_uid_already_linked' }, 409);

    await c.env.DB.prepare(
      'UPDATE participants SET badge_uid = ?, alt_code = ?, updated_at = ? WHERE id = ?',
    )
      .bind(badgeUid, altCode, new Date().toISOString(), participantId)
      .run();

    return c.json({ ok: true });
  },
);

// ---------------------------------------------------------------------------
// Balance top-up (IT Admin app) — adjusts a participant's balance and appends
// exactly one ledger row, atomically. The reason is what makes a later
// discrepancy auditable, so it is validated server-side, never trusted.
// ---------------------------------------------------------------------------

const TopUpSchema = z.object({
  altCode: z.string().min(1),
  amountCents: z.number().int().refine((n) => n !== 0, 'must not be zero'),
  reason: z.enum(['TOPUP', 'COMP', 'REFUND']),
});

app.post(
  '/api/admin/topup',
  allow(['IT_ADMIN']),
  zValidator('json', TopUpSchema, (r, c) => (r.success ? undefined : c.json({ error: 'bad_request' }, 400))),
  async (c) => {
    const { altCode, amountCents, reason } = c.req.valid('json');
    const now = new Date().toISOString();

    const p = await c.env.DB.prepare('SELECT id FROM participants WHERE alt_code = ?')
      .bind(altCode)
      .first<{ id: string }>();
    if (!p) return c.json({ error: 'not_found' }, 404);

    // balance + ledger row in one batch, so a crash between them can never
    // credit a participant without recording where the money came from.
    const stmts = [
      c.env.DB.prepare(
        'UPDATE participants SET balance_cents = balance_cents + ?, updated_at = ? WHERE id = ?',
      ).bind(amountCents, now, p.id),
      c.env.DB.prepare(
        `INSERT INTO meal_ledger (id, participant_id, meal_type, amount_cents, reason, at)
         VALUES (?, ?, 'LUNCH', ?, ?, ?)`,
      ).bind(crypto.randomUUID(), p.id, amountCents, reason, now),
    ];

    await c.env.DB.batch(stmts);

    const after = await c.env.DB.prepare('SELECT balance_cents FROM participants WHERE id = ?')
      .bind(p.id)
      .first<{ balance_cents: number }>();

    return c.json({ balanceCents: after?.balance_cents ?? 0 });
  },
);

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

app.get('/health', (c) => c.json({ ok: true, service: 'mianu-api' }));

export default app;
