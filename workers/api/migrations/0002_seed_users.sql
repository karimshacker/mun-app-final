-- Seed the IT_ADMIN operational account for MIANU-SM IV.
-- PINs are SHA-256(pin:salt), never plaintext; run once against the remote DB.
-- idempotent: re-running will not duplicate rows.
--
-- The original placeholder accounts u_head (Yacine Amrani) and u_org
-- (Sara Benali) were removed from production by 0018 (2026-10-02); the live
-- accounts are u_it here, u_head_eg (0012), and Organizer1-20 (0017).

INSERT INTO users (id, name, role, committee_id, phone, pin_hash, pin_salt) VALUES
  -- u_it PIN rotated to '1111' on 2026-09-30 (matches the live DB).
  ('u_it',   'Mehdi Haddad',  'IT_ADMIN',  NULL, '+213555000003', 'lS-HaczB7A1auDnm9wW-UQbAHxEtiLVo-IaiM9koTXg', '160c50d546d8b5ba0fbad996a66bee19')
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name, role = excluded.role, phone = excluded.phone,
  pin_hash = excluded.pin_hash, pin_salt = excluded.pin_salt;
