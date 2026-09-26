-- Seed the three operational accounts for MIANU-SM IV.
-- PINs are SHA-256(pin:salt), never plaintext; run once against the remote DB.
-- idempotent: re-running will not duplicate rows.

INSERT INTO users (id, name, role, committee_id, phone, pin_hash, pin_salt) VALUES
  ('u_head', 'Yacine Amrani', 'HEAD',     NULL, '+213555000001', 'eZDl7O_dW8sBgBg1QD9t1JdeBmB9OW-Sr2fbLU7SkLg', '42aaf25a2c397a3d4452e2ed8ce50065'),
  ('u_org',  'Sara Benali',   'ORGANIZER', NULL, '+213555000002', 'VV-Oe3daWAWTz314JuRdY1l49spB31TZ4uEkcvs242Q', 'a260cb3388f072b3ac86cbf6a0090bed'),
  ('u_it',   'Mehdi Haddad',  'IT_ADMIN',  NULL, '+213555000003', '31zrp-GAXKVYnnA3GgMJU2G4sCrUmxEb01_mfMnWMiE', 'fbdf48abc513d88f52c32a2ae370812f')
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name, role = excluded.role, phone = excluded.phone,
  pin_hash = excluded.pin_hash, pin_salt = excluded.pin_salt;
