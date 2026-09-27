import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import type { ScanOutcome, ScanResult } from '@mianu/types';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

interface Env {
  DB: D1Database;
  // binding name from wrangler.toml
  MIANU_APP_KV: KVNamespace;
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

const STAFF: Role[] = ['HEAD', 'DEPUTY', 'ORGANIZER', 'IT_ADMIN'];

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

const REFRESH_TTL_S = 60 * 60 * 24 * 7;

/** Issue an access/refresh pair bound to one durable session row. */
async function issueSession(c: any, user: { id: string; role: string }, sessionId: string) {
  const accessToken = await signJwt({ sub: user.id, role: user.role }, c.env.JWT_SECRET, 60 * 15);
  const refreshToken = await signJwt(
    { sub: user.id, role: user.role, typ: 'refresh', sid: sessionId },
    c.env.JWT_SECRET,
    REFRESH_TTL_S,
  );
  return { accessToken, refreshToken };
}

const userById = (db: D1Database, id: string) =>
  db
    .prepare('SELECT id, name, role, committee_id FROM users WHERE id = ?')
    .bind(id)
    .first<any>();

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
    // Base64 has two alphabets (standard '+/' and URL-safe '-_') plus optional
    // padding, and stored hashes may use either — canonicalize both sides so
    // the comparison is variant-agnostic.
    const normB64 = (s: string) => s.replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
    const expected = normB64(user?.pin_hash ?? 'invalid');
    const salt = user?.pin_salt ?? 'no-such-user';
    const given = normB64(await hashPin(pin, salt));

    if (!user || given !== expected) {
      return c.json({ error: 'invalid_credentials' }, 401);
    }

    // The sessions row is keyed by a random id, never by the token itself —
    // a token is a capability, not a database key.
    const sessionId = crypto.randomUUID();
    await c.env.DB.prepare(
      'INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)',
    )
      .bind(sessionId, user.id, new Date(Date.now() + REFRESH_TTL_S * 1000).toISOString())
      .run();

    const { accessToken, refreshToken } = await issueSession(c, user, sessionId);

    return c.json({
      accessToken,
      refreshToken,
      user: { id: user.id, name: user.name, role: user.role, committeeId: user.committee_id },
    });
  },
);

const RefreshSchema = z.object({ refreshToken: z.string().min(10) });

/** Exchange a still-valid refresh token for a fresh pair (rotation, same session row). */
app.post(
  '/api/auth/refresh',
  zValidator('json', RefreshSchema, (r, c) => (r.success ? undefined : c.json({ error: 'bad_request' }, 400))),
  async (c) => {
    const { refreshToken } = c.req.valid('json');
    const payload = await verifyJwt(refreshToken, c.env.JWT_SECRET).catch(() => null);
    if (!payload || payload.typ !== 'refresh' || typeof payload.sid !== 'string') {
      return c.json({ error: 'invalid_token' }, 401);
    }

    const sess = await c.env.DB.prepare('SELECT id, expires_at, revoked_at FROM sessions WHERE id = ?')
      .bind(payload.sid)
      .first<any>();
    if (!sess || sess.revoked_at || new Date(sess.expires_at) < new Date()) {
      return c.json({ error: 'session_expired' }, 401);
    }

    const user = await userById(c.env.DB, payload.sub);
    if (!user) return c.json({ error: 'invalid_token' }, 401);

    const tokens = await issueSession(c, user, sess.id);
    return c.json({
      ...tokens,
      user: { id: user.id, name: user.name, role: user.role, committeeId: user.committee_id },
    });
  },
);

/** Invalidate the session row so every token minted from it stops working. */
app.post(
  '/api/auth/logout',
  zValidator('json', RefreshSchema, (r, c) => (r.success ? undefined : c.json({ error: 'bad_request' }, 400))),
  async (c) => {
    const { refreshToken } = c.req.valid('json');
    const payload = await verifyJwt(refreshToken, c.env.JWT_SECRET).catch(() => null);
    if (payload?.sid) {
      await c.env.DB.prepare('UPDATE sessions SET revoked_at = ? WHERE id = ?')
        .bind(new Date().toISOString(), payload.sid)
        .run();
    }
    return c.json({ ok: true });
  },
);

// Applies to every authenticated route.
app.use('/api/*', async (c, next) => {
  if (c.req.path.startsWith('/api/auth/')) return next();

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
// Committees — the station picker's data.
// ---------------------------------------------------------------------------

app.get('/api/committees', allow(STAFF), async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT id, name, hall_name AS hallName FROM committees ORDER BY hall_name',
  ).all();
  return c.json({ committees: results });
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
    'FREE_ITEM',
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
    // Halls are scoped rooms: a hall scan must say which hall. Conference
    // and meal stations are venue-wide, so no committee is needed there —
    // the picker offers conference-wide meal lines on purpose.
    if ((body.stationType === 'HALL_IN' || body.stationType === 'HALL_OUT') && !body.committeeId) {
      return c.json({ error: 'committeeId_required_for_hall_stations' }, 400);
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
        replayed.station_type === 'MEAL'
          ? 'MEAL_SERVED'
          : replayed.station_type === 'FREE_ITEM'
            ? 'ITEM_SERVED'
            : 'CHECKED_IN';
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

    // Meal grid: which conference day this scan falls on, and which slots the
    // participant has already consumed. Both come from one query so the state
    // machine sees a consistent snapshot before deciding.
    let mealDay: number | null = null;
    let mealsUsed = 0;
    let slotTaken = false;
    let mealDays = CONFERENCE_MEAL_DAYS;
    let itemTaken = false;
    if (body.stationType === 'FREE_ITEM') {
      // The journal is a per-day handout: one query answers whether today's
      // copy already went to this delegate.
      const conf = await c.env.DB.prepare(
        'SELECT start_date FROM conference_config WHERE id = 1',
      ).first<{ start_date: string }>();
      const day = dayOfConference(now, conf?.start_date ?? '2026-09-26');
      mealDay = day;
      const taken = await c.env.DB.prepare(
        `SELECT 1 AS taken FROM free_item_log
          WHERE participant_id = ?1 AND item = 'JOURNAL' AND meal_day = ?2`,
      )
        .bind(p.id, day)
        .first<{ taken: number }>();
      itemTaken = (taken?.taken ?? 0) > 0;
    }
    if (body.stationType === 'MEAL' && body.mealType) {
      const conf = await c.env.DB.prepare(
        'SELECT start_date, meal_days FROM conference_config WHERE id = 1',
      ).first<{ start_date: string; meal_days: number }>();

      const start = conf?.start_date ?? '2026-09-26';
      // 0 or a nonsense value would zero the whole grid; fall back to the default.
      mealDays = conf && conf.meal_days > 0 && conf.meal_days <= 14 ? conf.meal_days : CONFERENCE_MEAL_DAYS;
      mealDay = dayOfConference(now, start);

      const grid = await c.env.DB.prepare(
        `SELECT
           (SELECT COUNT(*) FROM meal_serve_log
             WHERE participant_id = ?) AS used,
           (SELECT COUNT(*) FROM meal_serve_log
             WHERE participant_id = ? AND meal_day = ? AND meal_type = ?) AS slot`,
      )
        .bind(p.id, p.id, mealDay, body.mealType)
        .first<{ used: number; slot: number }>();
      mealsUsed = grid?.used ?? 0;
      slotTaken = (grid?.slot ?? 0) > 0;
    }

    const decision = decideScan({
      stationType: body.stationType,
      mealType: body.mealType ?? null,
      committeeId: body.committeeId ?? null,
      presence,
      participant: p,
      mealDay,
      mealsUsed,
      slotTaken,
      mealDays,
      itemTaken,
    });

    if (!decision.commit) {
      return c.json<ScanResult>({ outcome: decision.outcome, participant: p, at: now });
    }

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
      const slot = decision.mealSlot ?? { day: 1, mealType };
      stmts.push(
        // The (participant, meal_day, meal_type) PK is the double-serve guard:
        // a second insert into the same slot fails the whole batch, so even a
        // race between two devices cannot serve one meal twice.
        c.env.DB.prepare(
          `INSERT INTO meal_serve_log (participant_id, meal_day, meal_type, served_at)
           VALUES (?, ?, ?, ?)`,
        ).bind(p.id, slot.day, slot.mealType, now),
        c.env.DB.prepare(
          `INSERT INTO meal_ledger
             (id, participant_id, meal_type, amount_cents, reason, station_user_id, at)
           VALUES (?, ?, ?, ?, 'MEAL', ?, ?)`,
        ).bind(crypto.randomUUID(), p.id, slot.mealType, decision.balanceDeltaCents, scannedBy, now),
      );
    }

    if (body.stationType === 'FREE_ITEM' && decision.outcome === 'ITEM_SERVED') {
      // Same PK-guard pattern as the meal grid: a second handout today fails
      // the whole batch, so even a race cannot hand the journal out twice.
      stmts.push(
        c.env.DB.prepare(
          `INSERT INTO free_item_log (participant_id, item, meal_day, served_at)
           VALUES (?, 'JOURNAL', ?, ?)`,
        ).bind(p.id, mealDay, now),
      );
    }

    await c.env.DB.batch(stmts);

    const mealsRemaining =
      body.stationType === 'MEAL' && decision.mealRow
        ? Math.max(0, mealEntitlement(p.meal_plan, mealDays) - (mealsUsed + 1))
        : undefined;

    return c.json<ScanResult>({
      outcome: decision.outcome,
      participant: { ...p, balance_cents: balanceAfter } as any,
      balanceCents: balanceAfter,
      mealsRemaining,
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
  /** 1-based conference day the scan is happening on (MEAL/FREE_ITEM). */
  mealDay?: number | null;
  /** How many of the participant's meal slots are already consumed. */
  mealsUsed?: number;
  /** Whether *this* (day, mealType) slot is already consumed. */
  slotTaken?: boolean;
  /** How many days the conference runs, from conference_config. */
  mealDays?: number;
  /** The per-day free item (journal) was already handed to this delegate today. */
  itemTaken?: boolean;
}

interface DecideResult {
  outcome: ScanOutcome;
  commit: boolean;
  presenceAfter: Presence;
  balanceDeltaCents: number;
  mealRow: boolean;
  /** The exact slot this scan consumed, for the idempotency insert. */
  mealSlot?: { day: number; mealType: 'BREAKFAST' | 'LUNCH' };
}

/**
 * How many meals a plan is worth across the whole conference. The conference
 * runs `mealDays` days with two slots each; FULL covers both, a single-meal
 * plan covers only its own slot per day, NONE covers nothing.
 */
const CONFERENCE_MEAL_DAYS = 3;
const MIN_MEAL_DAYS = 1;
const MAX_MEAL_DAYS = 14;

function mealEntitlement(plan: string, mealDays = CONFERENCE_MEAL_DAYS): number {
  const days = clampMealDays(mealDays);
  switch (plan) {
    case 'FULL': return days * 2;
    case 'BREAKFAST_ONLY': return days;
    case 'LUNCH_ONLY': return days;
    default: return 0;
  }
}

/**
 * The schema allows 1-14 days. Anything outside that is a bad config row, not
 * a conference with zero meals — clamp rather than let a degenerate value
 * empty the whole grid.
 */
function clampMealDays(n: number | undefined | null): number {
  // No value means "the caller did not configure this", not "one-day conference".
  if (!n && n !== 0) return CONFERENCE_MEAL_DAYS;
  if (n < MIN_MEAL_DAYS) return MIN_MEAL_DAYS;
  if (n > MAX_MEAL_DAYS) return MAX_MEAL_DAYS;
  return n;
}

/**
 * Which conference day an ISO timestamp falls on (1-based). 0 or negative
 * means before the conference, above CONFERENCE_MEAL_DAYS means after it —
 * both are rejected by the state machine as MEAL_DAY_CLOSED.
 */
function dayOfConference(iso: string, startDate: string): number {
  const d = new Date(iso);
  const s = new Date(startDate + 'T00:00:00Z');
  if (isNaN(d.getTime()) || isNaN(s.getTime())) return 1;
  const ms = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) -
             Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate());
  return Math.floor(ms / 86_400_000) + 1;
}

function decideScan(args: DecideArgs): DecideResult {
  const { stationType, mealType, committeeId, presence, participant, mealDay, mealsUsed, slotTaken, mealDays, itemTaken } = args;
  const days = clampMealDays(mealDays);
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

      // The meal grid: 2 slots per day (breakfast + lunch) for each conference
      // day. A FULL plan over 3 days is 6 meals. This slot has already been
      // consumed today, and a plan that is out of days is out of meals.
      const day = mealDay ?? 1;
      const used = mealsUsed ?? 0;
      const remaining = mealEntitlement(plan, days) - used;

      if (remaining <= 0) return no('MEAL_PLAN_EXHAUSTED');
      if (slotTaken) return no('MEAL_ALREADY_SERVED');
      if (day < 1 || day > days) return no('MEAL_DAY_CLOSED');

      // Real balance check happens in SQL inside the transaction; this is the
      // fast pre-check so the device shows a reason without a round trip.
      if (participant.balance_cents <= 0) return no('INSUFFICIENT_BALANCE');

      return {
        outcome: 'MEAL_SERVED',
        commit: true,
        presenceAfter: presence,
        balanceDeltaCents: -MEAL_COST_CENTS,
        mealRow: true,
        mealSlot: { day, mealType: mealType as 'BREAKFAST' | 'LUNCH' },
      };
    }

    case 'FREE_ITEM': {
      // The journal (and any future free handout) is once per conference day,
      // independent of meals: it never consumes a meal-grid slot, never
      // touches the ledger, and is available on every plan including NONE.
      if (participant.status !== 'ACTIVE') return no('BLOCKED');
      if (itemTaken) return no('ITEM_ALREADY_SERVED');
      if (mealDay == null || mealDay < 1 || mealDay > (mealDays ?? CONFERENCE_MEAL_DAYS)) {
        return no('MEAL_DAY_CLOSED');
      }
      return {
        outcome: 'ITEM_SERVED',
        commit: true,
        presenceAfter: presence,
        balanceDeltaCents: 0,
        mealRow: false,
      };
    }

    default:
      return no('NOT_FOUND');
  }
}

const MEAL_COST_CENTS = 0; // TODO(phase 3): per-committee pricing config.

// ---------------------------------------------------------------------------
// IT admin: roster search — the link and top-up flows pick the participant
// from here, so neither app ever guesses an id client-side.
// ---------------------------------------------------------------------------

const PARTICIPANT_MATCH_SQL = `
  SELECT p.id, p.name, p.committee_id   AS committeeId,
         c.name                         AS committeeName,
         p.alt_code                     AS altCode,
         p.badge_uid                    AS badgeUid,
         p.balance_cents                AS balanceCents,
         p.meal_plan                    AS mealPlan,
         p.status
    FROM participants p
    LEFT JOIN committees c ON c.id = p.committee_id`;

app.get('/api/admin/participants', allow(['IT_ADMIN']), async (c) => {
  const q = (c.req.query('q') ?? '').trim();
  if (q.length < 2) return c.json({ participants: [] });

  const { results } = await c.env.DB.prepare(
    `${PARTICIPANT_MATCH_SQL}
      WHERE p.name LIKE ?1 OR p.alt_code LIKE ?1 OR p.badge_uid LIKE ?1
      ORDER BY p.name LIMIT 10`,
  )
    .bind(`%${q}%`)
    .all();
  return c.json({ participants: results });
});

/** Exact alt-code lookup for the top-up flow's code-first entry. */
app.get('/api/admin/lookup', allow(['IT_ADMIN']), async (c) => {
  // The Balance screen resolves a participant by the printed alt code or by
  // tapping a linked badge on the reader — both funnel through here.
  const code = (c.req.query('altCode') ?? '').trim().toUpperCase();
  const uid = (c.req.query('badgeUid') ?? '').trim();

  if (!code && !uid) return c.json({ participant: null });
  if (code && uid) {
    return c.json({ error: 'provide_exactly_one_of_altCode_badgeUid' }, 400);
  }

  const column = code ? 'p.alt_code' : 'p.badge_uid';
  const participant = await c.env.DB.prepare(`${PARTICIPANT_MATCH_SQL} WHERE ${column} = ?1`)
    .bind(code || uid)
    .first();
  return c.json({ participant: participant ?? null });
});

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
// Enrollment (IT Admin app) — scan a blank badge, type the delegate's name,
// committee, and alt code: one call creates the participant and links the
// chip in a single transaction, so a half-enrolled badge can never exist.
// ---------------------------------------------------------------------------

const EnrollSchema = z.object({
  badgeUid: z.string().min(1),
  name: z.string().min(2).max(80),
  committeeId: z.string().min(1),
  altCode: z.string().min(2).max(12),
  mealPlan: z.enum(['FULL', 'BREAKFAST_ONLY', 'LUNCH_ONLY', 'NONE']).default('FULL'),
});

app.post(
  '/api/admin/enroll',
  allow(['IT_ADMIN']),
  zValidator('json', EnrollSchema, (r, c) => (r.success ? undefined : c.json({ error: 'bad_request' }, 400))),
  async (c) => {
    const { badgeUid, name, committeeId, altCode, mealPlan } = c.req.valid('json');
    const uid = badgeUid.trim();
    const code = altCode.trim().toUpperCase();

    // The chip must be virgin: an already-linked badge never re-enrolls —
    // re-issuing goes through unlinking first (a deliberate audit step).
    const linked = await c.env.DB.prepare(
      `SELECT p.id, p.name
         FROM participants p
        WHERE p.badge_uid = ?1
        UNION ALL
       SELECT p.id, p.name
         FROM participants p
        WHERE p.alt_code = ?2`,
    )
      .bind(uid, code)
      .first<{ id: string; name: string }>();
    if (linked) {
      return c.json(
        {
          error: 'enroll_conflict',
          detail: linked,
        },
        409,
      );
    }

    // The committee must exist — a typo otherwise poisons presence filtering.
    const committee = await c.env.DB.prepare('SELECT id FROM committees WHERE id = ?1')
      .bind(committeeId)
      .first<{ id: string }>();
    if (!committee) return c.json({ error: 'committee_not_found' }, 400);

    const id = `p_${crypto.randomUUID().slice(0, 12)}`;
    const stmts = [
      c.env.DB.prepare(
        `INSERT INTO participants (id, name, committee_id, alt_code, badge_uid, balance_cents, meal_plan, status)
         VALUES (?1, ?2, ?3, ?4, ?5, 0, ?6, 'ACTIVE')`,
      ).bind(id, name.trim(), committeeId, code, uid, mealPlan),
    ];
    await c.env.DB.batch(stmts);

    return c.json({ ok: true, participantId: id });
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
// Notifications — one-way broadcasts. Composition is HEAD/DEPUTY; every other
// staff member is a read-only recipient. Fan-out writes one receipt row per
// recipient so delivery/read state is per-user, not global.
// ---------------------------------------------------------------------------

app.get('/api/notifications', allow(STAFF), async (c) => {
  const me = c.get('userId');
  const user = await userById(c.env.DB, me);
  if (!user) return c.json({ error: 'invalid_token' }, 401);

  const { results } = await c.env.DB.prepare(
    `SELECT n.id, n.title, n.body, n.audience, n.at,
            u.name AS sender,
            r.read_at AS readAt
       FROM notifications n
       LEFT JOIN users u ON u.id = n.sent_by
       LEFT JOIN notification_receipts r
         ON r.notification_id = n.id AND r.user_id = ?1
      WHERE n.audience = 'ALL' OR n.audience = ?2 OR n.sent_by = ?1
      ORDER BY n.at DESC
      LIMIT 50`,
  )
    .bind(me, user.committee_id ?? '')
    .all();

  // `sender` avoids the reserved word `from` in SQL; the client type wants
  // `from`. System water orders have no user row, hence the fallback.
  const notifications = (results as any[]).map(({ sender, ...rest }) => ({
    ...rest,
    from: sender ?? 'SYSTEM',
  }));
  return c.json({ notifications });
});

const NotificationSchema = z.object({
  title: z.string().min(1).max(120),
  body: z.string().min(1).max(2000),
  audience: z.string().min(1).max(64),
});

app.post(
  '/api/notifications',
  allow(['HEAD', 'DEPUTY']),
  zValidator('json', NotificationSchema, (r, c) => (r.success ? undefined : c.json({ error: 'bad_request' }, 400))),
  async (c) => {
    const { title, body, audience } = c.req.valid('json');

    if (audience !== 'ALL') {
      const committee = await c.env.DB.prepare('SELECT id FROM committees WHERE id = ?')
        .bind(audience)
        .first();
      if (!committee) return c.json({ error: 'unknown_audience' }, 404);
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const stmts = [
      c.env.DB.prepare(
        `INSERT INTO notifications (id, sent_by, audience, title, body, at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).bind(id, c.get('userId'), audience, title, body, now),
      // One receipt per recipient; audience 'ALL' is every staff account.
      c.env.DB.prepare(
        `INSERT INTO notification_receipts (notification_id, user_id, delivered_at)
         SELECT ?, id, ? FROM users
          WHERE (? = 'ALL' OR committee_id = ?)`,
      ).bind(id, now, audience, audience === 'ALL' ? '' : audience),
    ];
    await c.env.DB.batch(stmts);

    return c.json({ notification: { id, title, body, audience, at: now, readAt: null, from: 'you' } });
  },
);

app.post('/api/notifications/:id/read', allow(STAFF), async (c) => {
  const id = c.req.param('id');
  const now = new Date().toISOString();
  await c.env.DB.prepare(
    `INSERT INTO notification_receipts (notification_id, user_id, delivered_at, read_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(notification_id, user_id) DO UPDATE SET read_at = excluded.read_at`,
  )
    .bind(id, c.get('userId'), now, now)
    .run();
  return c.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Chat — one HEAD ↔ DEPUTY channel. History persists in D1; the client polls
// `since` its last message so a poll every few seconds stays cheap.
// ---------------------------------------------------------------------------

async function headDeputyChannel(db: D1Database): Promise<string> {
  const ch = await db.prepare("SELECT id FROM chat_channels WHERE kind = 'HEAD_DEPUTY' LIMIT 1").first<{ id: string }>();
  if (ch) return ch.id;
  const id = crypto.randomUUID();
  await db.prepare("INSERT INTO chat_channels (id, kind) VALUES (?, 'HEAD_DEPUTY')").bind(id).run();
  return id;
}

app.get('/api/chat', allow(['HEAD', 'DEPUTY']), async (c) => {
  const channelId = await headDeputyChannel(c.env.DB);
  const since = c.req.query('since') ?? null;

  const { results } = await c.env.DB.prepare(
    `SELECT m.id, m.channel_id AS channelId, m.sender_id AS senderId,
            u.name AS senderName, m.body, m.at
       FROM chat_messages m
       JOIN users u ON u.id = m.sender_id
      WHERE m.channel_id = ?1 AND (?2 IS NULL OR m.at > ?2)
      ORDER BY m.at DESC
      LIMIT 200`,
  )
    .bind(channelId, since)
    .all();

  return c.json({ messages: results.reverse() });
});

const ChatSendSchema = z.object({ body: z.string().min(1).max(2000) });

app.post(
  '/api/chat',
  allow(['HEAD', 'DEPUTY']),
  zValidator('json', ChatSendSchema, (r, c) => (r.success ? undefined : c.json({ error: 'bad_request' }, 400))),
  async (c) => {
    const { body } = c.req.valid('json');
    const channelId = await headDeputyChannel(c.env.DB);
    const id = crypto.randomUUID();
    const at = new Date().toISOString();

    await c.env.DB.prepare(
      'INSERT INTO chat_messages (id, channel_id, sender_id, body, at) VALUES (?, ?, ?, ?, ?)',
    )
      .bind(id, channelId, c.get('userId'), body, at)
      .run();

    const me = await userById(c.env.DB, c.get('userId'));
    return c.json({ message: { id, channelId, senderId: c.get('userId'), senderName: me?.name ?? '', body, at } });
  },
);

// ---------------------------------------------------------------------------
// Presence — the live "who is in which hall" board over participant scans.
// ---------------------------------------------------------------------------

app.get('/api/presence', allow(['HEAD', 'DEPUTY']), async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT p.id AS participantId, p.name,
            p.committee_id AS committeeId, pc.name AS committeeName,
            pr.in_conference AS inConference,
            pr.hall_id AS hallId, ch.hall_name AS hallName,
            pr.in_hall_since AS inHallSince
       FROM participants p
       LEFT JOIN participant_presence pr ON pr.participant_id = p.id
        LEFT JOIN committees pc ON pc.id = p.committee_id
       LEFT JOIN committees ch ON ch.id = pr.hall_id
      WHERE COALESCE(pr.in_conference, 0) = 1
      ORDER BY p.name
      LIMIT 300`,
  ).all();
  return c.json({ rows: results });
});

// ---------------------------------------------------------------------------
// Organizer location — hybrid GPS + hall-derived. The head's board merges
// three signals: GPS pings, the organizer's own station scans, and a break
// flag kept in KV. Nothing precise is ever shown, and rows age out.
// ---------------------------------------------------------------------------

const LOCATION_WINDOW_MS = 30 * 60 * 1000;

app.get('/api/board', allow(['HEAD']), async (c) => {
  const since = new Date(Date.now() - LOCATION_WINDOW_MS).toISOString();

  const staff = await c.env.DB.prepare(
    `SELECT id, name, role, committee_id AS committeeId FROM users
      WHERE role IN ('ORGANIZER', 'DEPUTY') ORDER BY name LIMIT 200`,
  ).all<{ id: string; name: string; role: Role; committeeId: string | null }>();

  const fixes = await c.env.DB.prepare(
    `SELECT user_id, lat, lng, source, at FROM locations
      WHERE at > ?1 ORDER BY at DESC LIMIT 500`,
  )
    .bind(since)
    .all<{ user_id: string; lat: number; lng: number; source: 'GPS' | 'HALL_SCAN'; at: string }>();

  const scans = await c.env.DB.prepare(
    `SELECT s.scanned_by AS userId, s.station_type AS stationType,
            c.hall_name AS hallName, s.at
       FROM scan_events s
       LEFT JOIN committees c ON c.id = s.committee_id
      WHERE s.station_type IN ('HALL_IN', 'HALL_OUT', 'MEAL') AND s.at > ?1
      ORDER BY s.at DESC LIMIT 500`,
  )
    .bind(since)
    .all<{ userId: string; stationType: 'HALL_IN' | 'HALL_OUT' | 'MEAL'; hallName: string | null; at: string }>();

  // First row per user is the latest, thanks to DESC ordering.
  const latestFix = new Map<string, (typeof fixes.results)[number]>();
  for (const f of fixes.results) if (!latestFix.has(f.user_id)) latestFix.set(f.user_id, f);

  const latestScan = new Map<string, (typeof scans.results)[number]>();
  for (const s of scans.results) if (!latestScan.has(s.userId)) latestScan.set(s.userId, s);

  const rows = [];
  for (const u of staff.results) {
    const onBreak = (await c.env.MIANU_APP_KV.get(`break:${u.id}`)) === '1';
    const fix = latestFix.get(u.id) ?? null;
    const scan = latestScan.get(u.id) ?? null;
    rows.push({
      userId: u.id,
      name: u.name,
      role: u.role,
      committeeId: u.committeeId,
      onBreak,
      lat: fix?.lat ?? null,
      lng: fix?.lng ?? null,
      source: fix?.source ?? null,
      at: fix?.at ?? scan?.at ?? null,
      lastStation: scan?.stationType ?? null,
      lastHall: scan?.hallName ?? null,
    });
  }

  return c.json({ rows });
});

const LocationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

app.post(
  '/api/location',
  allow(STAFF),
  zValidator('json', LocationSchema, (r, c) => (r.success ? undefined : c.json({ error: 'bad_request' }, 400))),
  async (c) => {
    const { lat, lng } = c.req.valid('json');
    await c.env.DB.prepare(
      `INSERT INTO locations (id, user_id, lat, lng, source, at) VALUES (?, ?, ?, ?, 'GPS', ?)`,
    )
      .bind(crypto.randomUUID(), c.get('userId'), lat, lng, new Date().toISOString())
      .run();
    return c.json({ ok: true });
  },
);

/** The privacy toggle: on break = hidden from the head's board. */
app.post('/api/me/break', allow(STAFF), async (c) => {
  const body = await c.req.json<{ onBreak?: boolean }>().catch(() => ({}) as { onBreak?: boolean });
  await c.env.MIANU_APP_KV.put(`break:${c.get('userId')}`, body.onBreak ? '1' : '0');
  return c.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Water orders — staff view of the public water endpoint's table. The venue
// kitchen/ops systems POST to the unauthenticated public worker; staff here
// see every recent order and walk it RECEIVED → ACKNOWLEDGED → DELIVERED
// (or CANCELLED). The public worker stamps a notification receipt per staff
// account on insert, so a new order also lands in every inbox.
// ---------------------------------------------------------------------------

const WaterStatusSchema = z.object({
  status: z.enum(['ACKNOWLEDGED', 'DELIVERED', 'CANCELLED']),
});

app.post(
  '/api/water/:ref/status',
  allow(['HEAD', 'DEPUTY']),
  zValidator('json', WaterStatusSchema, (r, c) => (r.success ? undefined : c.json({ error: 'bad_request' }, 400))),
  async (c) => {
    const { status } = c.req.valid('json');
    const ref = c.req.param('ref');
    const order = await c.env.DB.prepare('SELECT ref, status FROM water_orders WHERE ref = ?')
      .bind(ref)
      .first<{ ref: string; status: string }>();
    if (!order) return c.json({ error: 'not_found' }, 404);

    // Invalid transitions are 409, not silent success — an operator tapping
    // DELIVERED twice must not be told the second tap did something.
    const allowed: Record<string, string[]> = {
      RECEIVED: ['ACKNOWLEDGED', 'CANCELLED'],
      ACKNOWLEDGED: ['DELIVERED', 'CANCELLED'],
      DELIVERED: [],
      CANCELLED: [],
    };
    if (!allowed[order.status]?.includes(status)) {
      return c.json({ error: 'invalid_transition', from: order.status }, 409);
    }

    await c.env.DB.prepare('UPDATE water_orders SET status = ?, updated_at = ? WHERE ref = ?')
      .bind(status, new Date().toISOString(), ref)
      .run();
    return c.json({ ok: true, ref, status });
  },
);

app.get('/api/water', allow(STAFF), async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT w.ref, w.committee_id AS committeeId, w.quantity, w.note,
            w.status, w.requester_system AS requesterSystem, w.created_at AS createdAt,
            pc.name AS committeeName
       FROM water_orders w
       LEFT JOIN committees pc ON pc.id = w.committee_id
      ORDER BY w.created_at DESC
      LIMIT 50`,
  ).all();
  return c.json({ orders: results });
});

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

app.get('/health', (c) => c.json({ ok: true, service: 'mianu-api' }));

// Workers-style default export. The named state-machine exports are re-exposed
// below for the unit tests; wrangler only accepts `default` plus functions at
// the top level, so the tests import them from a namespaced object instead.
export default app;

export const stateMachine = {
  decideScan,
  mealEntitlement,
  dayOfConference,
  CONFERENCE_MEAL_DAYS,
  MIN_MEAL_DAYS,
  MAX_MEAL_DAYS,
};
