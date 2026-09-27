-- Local-only smoke-test seed: known PINs so the E2E script can sign in.
-- SHA-256('424242:saltyN') base64 per user.
INSERT INTO users (id, name, role, committee_id, phone, pin_hash, pin_salt) VALUES
  ('u_test_head', 'Test Head', 'HEAD', NULL, '+213999000001', 'xxGz7IA0kyQYcC18xcrOiVa03YwQFNADt4OlC4fG4cA=', 'salty1'),
  ('u_test_org', 'Test Organizer', 'ORGANIZER', NULL, '+213999000002', 'wCX/eC/i6DLESKmY3bkuDY6Ac7a22BqT6evvm80iql0=', 'salty3'),
  ('u_test_admin', 'Test Admin', 'IT_ADMIN', NULL, '+213999000003', 'XN3X+XPgDc0RL8QE98NNPuRsK/kihwCFJAQzekzki7M=', 'salty2'),
  ('u_test_deputy', 'Test Deputy', 'DEPUTY', NULL, '+213999000004', 'J1a3K9yQ5AEIdrfWD+U2FZmHFy/Qxmy7tlSujB8VOqY=', 'salty4')
ON CONFLICT(id) DO UPDATE SET pin_hash = excluded.pin_hash, pin_salt = excluded.pin_salt;

INSERT INTO participants (id, name, committee_id, alt_code, balance_cents, meal_plan, status) VALUES
  ('p_smoke1', 'Amelia Smoke', 'c_ag1', 'SMK1', 5000, 'FULL', 'ACTIVE'),
  ('p_smoke2', 'Bruno Smoke', 'c_cs', 'SMK2', 0, 'BREAKFAST_ONLY', 'ACTIVE')
ON CONFLICT(id) DO UPDATE SET name = excluded.name, alt_code = excluded.alt_code;
