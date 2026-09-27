import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';

/**
 * Public water-order endpoint.
 *
 * No authentication. The endpoint is consumed by internal conference systems
 * on a closed network, so there is no key to obtain, rotate, or leak — the
 * integration is just a POST. Rate limiting is gone with it; if this is ever
 * exposed beyond the conference network, reintroduce auth before doing that.
 *
 * Integration docs: docs/WATER_API.md
 */

interface Env {
  DB: D1Database;
}

// Inlined at build time via the Text rule in wrangler.toml — the repo's single
// copy of the integration doc is what the endpoint serves.
// @ts-expect-error virtual module provided by wrangler's build pipeline
import waterApiDoc from '../../../docs/WATER_API.md';

const app = new Hono<{ Bindings: Env }>();

const ORDER_PREFIX = 'WO-';

const OrderSchema = z.object({
  committee: z.string().min(1),
  quantity: z.number().int().min(1).max(200),
  note: z.string().max(500).optional(),
  /** Which system is calling, for the kitchen's ticket trail. Optional. */
  from: z.string().max(100).optional(),
});

app.post(
  '/order',
  zValidator('json', OrderSchema, (r, c) => (r.success ? undefined : c.json({ error: 'bad_request' }, 400))),
  async (c) => {
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
       VALUES (?, ?, ?, ?, 'RECEIVED', ?, NULL, ?, ?)`,
    )
      .bind(ref, committee.id, body.quantity, body.note ?? null, body.from ?? 'external', now, now)
      .run();

    // Fan-out: one notification + one receipt per staff member, so the order
    // lands in every inbox (organizers' phones and the head's staff) without
    // anyone polling. Same rows the API's broadcast route writes.
    const id = crypto.randomUUID();
    await c.env.DB.batch([
      c.env.DB.prepare(
        `INSERT INTO notifications (id, sent_by, audience, title, body, at)
         VALUES (?, NULL, ?, ?, ?, ?)`,
      ).bind(
        id,
        'ALL',
        `Water for ${committee.name}`,
        `${body.quantity} units requested${body.from ? ` by ${body.from}` : ''}${body.note ? ` — ${body.note}` : ''}. Ref ${ref}.`,
        now,
      ),
      c.env.DB.prepare(
        `INSERT INTO notification_receipts (notification_id, user_id, delivered_at)
         SELECT ?, id, ? FROM users`,
      ).bind(id, now),
    ]);

    // 201 per docs/WATER_API.md — the caller keeps `ref` as the only handle.
    return c.json(
      {
        ref,
        committee: committee.name,
        quantity: body.quantity,
        status: 'RECEIVED',
        createdAt: now,
      },
      201,
    );
  },
);

app.get('/order/:ref', async (c) => {
  const order = await c.env.DB.prepare(
    `SELECT ref, committee_id, quantity, note, status, requester_system, created_at
       FROM water_orders WHERE ref = ?`,
  )
    .bind(c.req.param('ref'))
    .first<any>();

  if (!order) return c.json({ error: 'not_found' }, 404);

  return c.json(order);
});

app.get('/health', (c) => c.json({ ok: true, service: 'mianu-public' }));

app.get('/', (c) =>
  c.json({
    service: 'mianu-public',
    docs: 'https://mianu-public.karimshacker1234.workers.dev/docs/WATER_API.md',
  }),
);

/** Serve the integration README itself — PLAN.md promises it at the endpoint. */
app.get('/docs/WATER_API.md', (c) =>
  c.text(waterApiDoc, 200, { 'Content-Type': 'text/markdown; charset=utf-8' }),
);

export default app;
