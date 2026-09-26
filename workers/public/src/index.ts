import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';

/**
 * Public water-order endpoint.
 *
 * Any external system holding an API key (issued by the IT Admin app) may
 * order water for a committee. Keys are scoped to this capability only and
 * never grant access to participant data.
 *
 * Integration docs: docs/WATER_API.md
 */

interface Env {
  DB: D1Database;
  KV: KVNamespace;
  PUBLIC_API_KEY_SALT: string;
}

const app = new Hono<{ Bindings: Env }>();

const ORDER_PREFIX = 'WO-';

async function hashApiKey(key: string, salt: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${key}:${salt}`),
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function authenticate(header: string | undefined, salt: string, db: D1Database) {
  if (!header || !header.startsWith('Bearer ')) return null;
  const key = header.slice(7);
  const hash = await hashApiKey(key, salt);

  const record = await db
    .prepare(
      `SELECT id, key_prefix, scopes, rate_limit_per_hour
         FROM api_keys
        WHERE key_hash = ? AND revoked_at IS NULL`,
    )
    .bind(hash)
    .first<any>();

  return record ?? null;
}

const OrderSchema = z.object({
  committee: z.string().min(1),
  quantity: z.number().int().min(1).max(200),
  note: z.string().max(500).optional(),
});

app.post(
  '/order',
  zValidator('json', OrderSchema, (r, c) => (r.success ? undefined : c.json({ error: 'bad_request' }, 400))),
  async (c) => {
    const keyRecord = await authenticate(
      c.req.header('Authorization'),
      c.env.PUBLIC_API_KEY_SALT,
      c.env.DB,
    );
    if (!keyRecord) return c.json({ error: 'unauthorized' }, 401);
    if (!keyRecord.scopes.split(',').includes('water.order')) {
      return c.json({ error: 'insufficient_scope' }, 403);
    }

    // Rate limit: hourly counter per key, stored in KV.
    const hour = new Date().toISOString().slice(0, 13); // 2026-09-26T14
    const rlKey = `rl:${keyRecord.id}:${hour}`;
    const count = Number((await c.env.KV.get(rlKey)) ?? 0);
    if (count >= keyRecord.rate_limit_per_hour) {
      return c.json({ error: 'rate_limited' }, 429);
    }
    await c.env.KV.put(rlKey, String(count + 1), { expirationTtl: 7200 });

    const body = c.req.valid('json');

    const committee = await c.env.DB.prepare(
      'SELECT id, name FROM committees WHERE id = ? OR name = ?',
    )
      .bind(body.committee, body.committee)
      .first<any>();
    if (!committee) return c.json({ error: 'unknown_committee' }, 404);

    const ref = `${ORDER_PREFIX}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const now = new Date().toISOString();

    await c.env.DB.prepare(
      `INSERT INTO water_orders
         (ref, committee_id, quantity, note, status, requester_system, api_key_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'RECEIVED', ?, ?, ?, ?)`,
    )
      .bind(
        ref,
        committee.id,
        body.quantity,
        body.note ?? null,
        keyRecord.key_prefix,
        keyRecord.id,
        now,
        now,
      )
      .run();

    // Phase 5: fan out to the committee's organizers and the head dashboard
    // over the realtime Durable Object + Web Push.

    return c.json({
      ref,
      committee: committee.name,
      quantity: body.quantity,
      status: 'RECEIVED',
      createdAt: now,
    });
  },
);

app.get('/order/:ref', async (c) => {
  const keyRecord = await authenticate(
    c.req.header('Authorization'),
    c.env.PUBLIC_API_KEY_SALT,
    c.env.DB,
  );
  if (!keyRecord) return c.json({ error: 'unauthorized' }, 401);

  const order = await c.env.DB.prepare(
    `SELECT ref, committee_id, quantity, note, status, requester_system, created_at
       FROM water_orders WHERE ref = ? AND api_key_id = ?`,
  )
    .bind(c.req.param('ref'), keyRecord.id)
    .first<any>();

  if (!order) return c.json({ error: 'not_found' }, 404);

  return c.json(order);
});

app.get('/', (c) =>
  c.json({
    service: 'mianu-public',
    docs: 'https://mianu-public.karimshacker1234.workers.dev/docs/WATER_API.md',
  }),
);

export default app;
