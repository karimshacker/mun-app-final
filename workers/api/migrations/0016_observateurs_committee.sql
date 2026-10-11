-- OBSERVATEURS joins the venue-wide committees: a real conference team
-- (delegates enrollable, broadcast/water audience) bound to no hall, so the
-- station picker renders no HALL_IN / HALL_OUT rows for it. Same contract as
-- 0014/0015 — hall_name stays the empty string.
--
-- Idempotent: re-running refreshes the same row instead of duplicating.

INSERT INTO committees (id, name, hall_name) VALUES
  ('c_observateurs', 'OBSERVATEURS', '')
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name, hall_name = excluded.hall_name;
