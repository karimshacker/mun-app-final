-- Remove the API-key requirement from water orders.
--
-- The endpoint now trusts the caller: it is consumed by internal conference
-- systems on a closed network, and the key ceremony was getting in the way of
-- integration. api_key_id is retained (nullable) so historical orders keep
-- pointing at the key that created them, but new rows write NULL.
--
-- SQLite cannot drop a NOT NULL constraint in place, so the table is rebuilt.

CREATE TABLE water_orders_new (
  ref             TEXT PRIMARY KEY,
  committee_id    TEXT NOT NULL REFERENCES committees(id),
  quantity        INTEGER NOT NULL CHECK (quantity > 0),
  note            TEXT,
  status          TEXT NOT NULL DEFAULT 'RECEIVED'
                  CHECK (status IN ('RECEIVED', 'ACKNOWLEDGED', 'DELIVERED', 'CANCELLED')),
  requester_system TEXT NOT NULL,
  api_key_id      TEXT REFERENCES api_keys(id),   -- now nullable
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO water_orders_new (ref, committee_id, quantity, note, status, requester_system, api_key_id, created_at, updated_at)
SELECT ref, committee_id, quantity, note, status, requester_system, api_key_id, created_at, updated_at FROM water_orders;

DROP TABLE water_orders;
ALTER TABLE water_orders_new RENAME TO water_orders;

CREATE INDEX idx_water_orders_status ON water_orders(status, created_at);
CREATE INDEX idx_water_orders_committee ON water_orders(committee_id);

-- Seed the committees the conference actually runs, so water orders and hall
-- scans have something to resolve against.
INSERT INTO committees (id, name, hall_name) VALUES
  ('c_ga',     'GA',     'Hall 1'),
  ('c_sochum', 'SOCHUM', 'Hall 2'),
  ('c_hrc',    'HRC',    'Hall 3'),
  ('c_unsc',   'UNSC',   'Hall 4')
ON CONFLICT(id) DO UPDATE SET name = excluded.name, hall_name = excluded.hall_name;
