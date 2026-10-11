-- Seed 20 generic ORGANIZER accounts (Organizer1 … Organizer20) for station
-- check-in devices at MIANU-SM IV.
--
-- Login = POST /api/auth/login { phone, pin }. Each account has a unique
-- random 4-digit PIN (documented below in plain text for distribution) and a
-- fresh per-user 32-hex salt; pin_hash is base64url(SHA-256('<pin>:<salt>'))
-- with padding stripped, matching hashPin() in workers/api/src/index.ts
-- (the login route canonicalizes base64 variants anyway).
-- committee_id is NULL so the organizer sees every hall station.
-- Idempotent: re-running updates the same rows instead of duplicating.

INSERT INTO users (id, name, role, committee_id, phone, pin_hash, pin_salt) VALUES
  ('u_org1',  'Organizer1',  'ORGANIZER', NULL, '+213555010001', 'a4JWzGcWPMZcW9PlsdJmOKnT9FGn7Tyy_SFWOgjqo_o', 'b3aafabf29f1ee72396d013be29abd45'),
  ('u_org2',  'Organizer2',  'ORGANIZER', NULL, '+213555010002', 'Q684bzm_u_86Vh9Hdf0B2XNnwFTxtXZbOWlwiJZf7PI', '2aab4aa31b0de4c5cc4844bd9433386d'),
  ('u_org3',  'Organizer3',  'ORGANIZER', NULL, '+213555010003', 'vww9rm_dVt3KX7Ks7ynWTPxuePqnulROg4Q3rgj8c8U', 'b49c9e13774dda527d44c7320600e683'),
  ('u_org4',  'Organizer4',  'ORGANIZER', NULL, '+213555010004', 'bzMtihONWnZLn1FDfw15b3R3xvW_eA8_M8GtEJPAnVU', 'ca8888bba7ab6b166b41fd47db1eaf50'),
  ('u_org5',  'Organizer5',  'ORGANIZER', NULL, '+213555010005', 'QVfwJiQymY58m9uCcivRRNKWZqIKDe8aplyg-Yujoas', '1baffabeb5cf9707deada00bc4464b47'),
  ('u_org6',  'Organizer6',  'ORGANIZER', NULL, '+213555010006', '00FdWqh7mZlp_O5xcWuA6wPjMk3imELZdMI-vEVWMc4', 'e6b5a5b389d709f1b8a69604e267ef26'),
  ('u_org7',  'Organizer7',  'ORGANIZER', NULL, '+213555010007', 'SzDfa_098MX_2MvnGv-vrpQBC73dxgXU-fvqTawXQjs', '89a9e25f757f29c3b7926549de6427be'),
  ('u_org8',  'Organizer8',  'ORGANIZER', NULL, '+213555010008', 'iYEynde2QwL0EXPWJ9eQ94IvueK3ztbjp76Bi3qxElo', '423fe6821ef16b73d0b9bc753a3bfe89'),
  ('u_org9',  'Organizer9',  'ORGANIZER', NULL, '+213555010009', 'XchYzC2Z7k0GzQ9qx9ZBXD6JkhttJ8gM9pZ5bdF7Zkg', '2caa3d4677b46bb983273d9eb8b30c2a'),
  ('u_org10', 'Organizer10', 'ORGANIZER', NULL, '+213555010010', 'FbJaQ4OuJGEJ4D_zsJmehL7BbKcdUe_7a8pYDiWTeRg', '79f8a4500dc83c8a934bf308a7c2e885'),
  ('u_org11', 'Organizer11', 'ORGANIZER', NULL, '+213555010011', 'Yynp48cpdaHFhcgEsY8-AQKIZekOlwCWSRCpohy4iGo', '21e3f965f7e4916f5e97fc74c9e11b64'),
  ('u_org12', 'Organizer12', 'ORGANIZER', NULL, '+213555010012', 'dafdZSIAjFW_7J_WPV3ytO7vW-DT8EIsmFDOUn3b8Dc', '93de78e0083771ca70bb3cd1d07cdbc3'),
  ('u_org13', 'Organizer13', 'ORGANIZER', NULL, '+213555010013', 'qn6t56ozmmZbbMX3T-SPOqWNBSAHOegK7OJqMpIVdEM', 'efa0d005252c63c1c37cebb5eaf17385'),
  ('u_org14', 'Organizer14', 'ORGANIZER', NULL, '+213555010014', 'YSFILafG_dGS2qVV6WuZOdch4zYBKDN6-VDi9390kNc', 'fb54069fa503e587af57f284d3c8e24f'),
  ('u_org15', 'Organizer15', 'ORGANIZER', NULL, '+213555010015', 'gX4US7FEIE8NR300GJ5y95h56kTBWIXRc8TLqOJqxJM', '56c6f77e9f4522cc19c1fa95d8fbdab5'),
  ('u_org16', 'Organizer16', 'ORGANIZER', NULL, '+213555010016', 'SEv0BTLxu-WYeqO0bzCYK8UM9eVhqLheaBMcg0C4wPA', '857a2777b824de702d7ed4d5d4c95177'),
  ('u_org17', 'Organizer17', 'ORGANIZER', NULL, '+213555010017', 'lzl4rBKtXlazrTVG-cLxYSKLoo_5YJTGxCCJokWuBsw', '3014e711ceb61b11003173e8f59f19c4'),
  ('u_org18', 'Organizer18', 'ORGANIZER', NULL, '+213555010018', 'OkspgnWeB8tRBFunuOtFG57Xxw0gunXZa7TNP3EjnEY', '3dab32bc3bb75d06be40ceb129892fca'),
  ('u_org19', 'Organizer19', 'ORGANIZER', NULL, '+213555010019', 'Lj_RaiFKt5vaFZLYv6YN8MYbJs7w8F1GMv7z4o0Z7hk', '1cef2bdc5ce688e32a2432869485cefc'),
  ('u_org20', 'Organizer20', 'ORGANIZER', NULL, '+213555010020', 'YnMX5uF8wZKfhO8ygo1Nj8NR65kPIQrlr0g-LCxiN8g', '5bbe043091b35ae13f5cbda0fee7df80')
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name, role = excluded.role, phone = excluded.phone,
  pin_hash = excluded.pin_hash, pin_salt = excluded.pin_salt;
