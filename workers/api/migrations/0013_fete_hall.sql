-- Add the "Fête" hall: the celebration room used for the gala and evening
-- events has its own door and therefore its own HALL_IN / HALL_OUT pair on
-- the station picker. Halls are modeled as committee rows (one per hall since
-- 0010), so the fête is a room row with no delegate ever enrolled into it —
-- but scans, presence, and the delegates-by-hall board all key off
-- committees.id / committees.hall_name, so everything downstream (presence,
-- reports, water orders, broadcast audience) just works for it.
--
-- Idempotent: re-running refreshes the same row instead of duplicating.

INSERT INTO committees (id, name, hall_name) VALUES
  ('c_fete', 'FÊTE', 'Fête')
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name, hall_name = excluded.hall_name;
