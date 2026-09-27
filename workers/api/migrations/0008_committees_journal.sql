-- The real committee list for MIANU-SM IV, and the once-per-day free item
-- (the conference journal). The free item is a daily handout, NOT a meal: it
-- never touches the meal grid or the ledger, so nobody's meal allowance can
-- be consumed by it.

INSERT INTO committees (id, name, hall_name) VALUES
  ('c_ag1',    'AG1',    'Hall 1'),
  ('c_ag4',    'AG4',    'Hall 1'),
  ('c_cs',     'CS',     'Hall 2'),
  ('c_csh',    'CSH',    'Hall 2'),
  ('c_ams',    'AMS',    'Hall 3'),
  ('c_hrc',    'HRC',    'Hall 3'),
  ('c_cij',    'CIJ',    'Hall 4'),
  ('c_ecosoc', 'ECOSOC', 'Hall 4')
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name, hall_name = excluded.hall_name;

-- One row per (delegate, conference day) once the journal is handed over.
-- The primary key is the double-handout guard, same pattern as meal_serve_log:
-- even two devices racing on the same badge cannot hand the journal out twice
-- in one day.
CREATE TABLE IF NOT EXISTS free_item_log (
  participant_id TEXT NOT NULL REFERENCES participants(id),
  item           TEXT NOT NULL,
  meal_day       INTEGER NOT NULL,
  served_at      TEXT NOT NULL,
  PRIMARY KEY (participant_id, item, meal_day)
);
