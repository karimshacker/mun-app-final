-- Meal entitlement: 2 meals per day (breakfast + lunch) for a 3-day conference.
--
-- The old meal_serve_log keyed on (participant, meal_type, served_at), where
-- served_at was a fresh timestamp per request — that deduped nothing, because
-- two real scans never share a timestamp. The grid is now (participant,
-- meal_day, meal_type): one slot per meal per day, so a second breakfast on
-- day 2 is rejected while day 3's breakfast is served.

CREATE TABLE conference_config (
  id              INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  start_date      TEXT NOT NULL,             -- 'YYYY-MM-DD', day 1 of the conference
  meal_days       INTEGER NOT NULL DEFAULT 3 CHECK (meal_days BETWEEN 1 AND 14),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- MIANU-SM IV opens 2026-09-26. IT can UPDATE this row if the dates move.
INSERT INTO conference_config (id, start_date, meal_days) VALUES (1, '2026-09-26', 3);

CREATE TABLE meal_serve_log_new (
  participant_id  TEXT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  meal_day        INTEGER NOT NULL CHECK (meal_day BETWEEN 1 AND 14),  -- 1 = first day
  meal_type       TEXT NOT NULL CHECK (meal_type IN ('BREAKFAST', 'LUNCH')),
  served_at       TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (participant_id, meal_day, meal_type)
);

-- Carry any existing servings across, deriving their day from the start date.
-- The old PK allowed a genuine double-serve (same participant + meal type
-- twice on one day, differing only in timestamp), and a bare INSERT of both
-- rows would collide with the new PK and fail the whole migration — so the
-- backfill groups them and keeps the earliest serving, which is when the meal
-- was actually handed over. Dates at or before the start clamp to day 1, and
-- anything beyond day 14 clamps to 14, so a stray timestamp can never violate
-- the CHECK and abort the migration; historical rows are never lost.
INSERT INTO meal_serve_log_new (participant_id, meal_day, meal_type, served_at)
SELECT
  participant_id,
  MIN(14, MAX(1, CAST(julianday(date(served_at)) - julianday((SELECT start_date FROM conference_config)) AS INTEGER) + 1)) AS meal_day,
  meal_type,
  MIN(served_at)
FROM meal_serve_log
GROUP BY participant_id, meal_day, meal_type;

DROP TABLE meal_serve_log;
ALTER TABLE meal_serve_log_new RENAME TO meal_serve_log;

CREATE INDEX idx_meal_serve_log_day ON meal_serve_log(participant_id, meal_day);
