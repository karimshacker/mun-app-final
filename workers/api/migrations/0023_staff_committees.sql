-- CONSEILLERS, DIRECTEUR DE L'ÉTABLISSEMENT and FRÈRE SUPÉRIEUR join the
-- venue-wide committees: real conference teams (delegates enrollable,
-- broadcast/water audience) bound to no hall, so the station picker renders
-- no HALL_IN / HALL_OUT rows for them. Same contract as 0014/0015/0016 —
-- hall_name stays the empty string.
--
-- Idempotent: re-running refreshes the same rows instead of duplicating.

INSERT INTO committees (id, name, hall_name) VALUES
  ('c_conseillers',     'CONSEILLERS',                   ''),
  ('c_directeur',       'DIRECTEUR DE L''ÉTABLISSEMENT', ''),
  ('c_frere_superieur', 'FRÈRE SUPÉRIEUR',               '')
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name, hall_name = excluded.hall_name;
