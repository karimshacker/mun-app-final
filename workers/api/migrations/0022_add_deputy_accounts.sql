-- Add four DEPUTY accounts (requested 2026-10-02 via WhatsApp list).
-- Egyptian phones stored in +20 international form (leading 0 dropped), same
-- convention as u_head_eg. PINs 2222/3333/4444/5555 with fresh per-user
-- salts; hashes are base64url(SHA-256('<pin>:<salt>')), matching hashPin().
-- committee_id NULL: deputies see all committees/halls.
-- Idempotent: re-running updates the same rows instead of duplicating.

INSERT INTO users (id, name, role, committee_id, phone, pin_hash, pin_salt) VALUES
  ('u_dep_ammar',   'Ammar Hossam', 'DEPUTY', NULL, '+201275700653', 'lirbRLguUISsxa_LT5xHpdPJjIG6dV4OjxZH9U7cxSU', 'abd2674a2ad957d1796dfdb5eb9a7319'),
  ('u_dep_youssef', 'Youssef',      'DEPUTY', NULL, '+201092004868', 'uIJKF3Xf5pOquNxkpWCC-FKHbGA04YxE9WEWb-Hk-MY', '975084ba253bacfd234988c627ff9757'),
  ('u_dep_nour',    'Nour',         'DEPUTY', NULL, '+201007780227', 'impHFsUui-cP6V3mQfZpcGH7rM8An_Nho1_jjlPWrms', '2692a9423785a894fc1d96f2c6b80fae'),
  ('u_dep_omar',    'Omar Negm',    'DEPUTY', NULL, '+201009879821', 'la-9wJUkGWmn6ujowDI1SDJV5VHAzUl-P-k2Gcxw6YM', 'cf14be4014b325f9d8a4d289d037f014')
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name, role = excluded.role, phone = excluded.phone,
  pin_hash = excluded.pin_hash, pin_salt = excluded.pin_salt;
