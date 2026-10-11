-- Add a second HEAD account (+20 country code).
-- PIN 1954 with a fresh per-user salt; hash is SHA-256('1954:salt') base64,
-- matching hashPin() in workers/api/src/index.ts (padding-stripped — the
-- login route canonicalizes both variants).
-- Idempotent: re-running updates the same row instead of duplicating.
-- NOTE: 'Event Head' is a placeholder display name — update it with the
-- person's real name (one UPDATE, or edit here before applying remotely).

INSERT INTO users (id, name, role, committee_id, phone, pin_hash, pin_salt) VALUES
  ('u_head_eg', 'Event Head', 'HEAD', NULL, '+201062499318', 'GcWQdHtz04SGJbCqP/tMMOe9XrWrFc/0JAuACMmWmGQ', '2c4b2c8fd2f595018bb1d362ddef886d')
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name, role = excluded.role, phone = excluded.phone,
  pin_hash = excluded.pin_hash, pin_salt = excluded.pin_salt;
