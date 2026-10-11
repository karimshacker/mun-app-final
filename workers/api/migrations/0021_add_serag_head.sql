-- Add a HEAD account for Serag (requested 2026-10-02).
-- Phone +201006850782 (Egyptian, stored in the same +20 international form
-- as u_head_eg); PIN 1111 with a fresh per-user salt; hash is
-- base64url(SHA-256('1111:salt')), matching hashPin() in src/index.ts.
-- committee_id NULL: heads see all committees/halls.
-- Idempotent: re-running updates the same row instead of duplicating.

INSERT INTO users (id, name, role, committee_id, phone, pin_hash, pin_salt) VALUES
  ('u_head_serag', 'Serag', 'HEAD', NULL, '+201006850782', 'gegiKvLwUQeZs2sVp4tuhvWyZqsiNdh6VGU3JoZAeLU', '97918bb0499199a94f227c6f299278de')
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name, role = excluded.role, phone = excluded.phone,
  pin_hash = excluded.pin_hash, pin_salt = excluded.pin_salt;
