-- Seed a small participant roster so the dry run can scan against real data
-- out of the box. One participant per meal plan, including an exhausted FULL
-- plan, so every receipt branch is reachable at the stations. IT can extend
-- this list or replace it when the real roster is imported.
--
-- PIN-style salts are not needed here; alt codes are the typed fallback and
-- badge_uid is bound later at the linking desk.

INSERT INTO participants (id, name, committee_id, alt_code, balance_cents, meal_plan, status) VALUES
  ('p_demo_1', 'Amina Kerboubi',   'c_ga',     'DM01', 50000, 'FULL',           'ACTIVE'),
  ('p_demo_2', 'Yacine Brahimi',   'c_sochum', 'DM02', 12000, 'BREAKFAST_ONLY', 'ACTIVE'),
  ('p_demo_3', 'Nadir Belkacem',   'c_hrc',    'DM03',  8000, 'LUNCH_ONLY',     'ACTIVE'),
  ('p_demo_4', 'Lina Mokrani',     'c_unsc',   'DM04',     0, 'NONE',           'ACTIVE'),
  ('p_demo_5', 'Sofiane Ouali',    'c_ga',     'DM05',  3500, 'FULL',           'ACTIVE')
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name, committee_id = excluded.committee_id,
  alt_code = excluded.alt_code, balance_cents = excluded.balance_cents,
  meal_plan = excluded.meal_plan, status = excluded.status;

-- Mark Amina's grid full (day 1-3, breakfast + lunch) so a scan lands on
-- MEAL_PLAN_EXHAUSTED without any setup. served_at derives the day from the
-- conference start date (2026-09-26).
INSERT INTO meal_serve_log (participant_id, meal_day, meal_type, served_at)
SELECT 'p_demo_1', d.day, m.meal_type, datetime('now')
  FROM (SELECT 1 AS day UNION SELECT 2 UNION SELECT 3) d
  CROSS JOIN (SELECT 'BREAKFAST' AS meal_type UNION SELECT 'LUNCH') m
WHERE NOT EXISTS (
  SELECT 1 FROM meal_serve_log x
   WHERE x.participant_id = 'p_demo_1'
     AND x.meal_day = d.day AND x.meal_type = m.meal_type
);

-- And start Lina at zero with no plan: the station refuses her outright.
