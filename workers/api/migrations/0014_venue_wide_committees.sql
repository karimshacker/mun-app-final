-- Venue-wide committees: real conference teams that exist everywhere and are
-- bound to no hall. Delegates CAN be enrolled into them (roster, meals,
-- badges all work), and they are valid broadcast / water-order audiences —
-- but they are not rooms, so the station picker renders no HALL_IN / HALL_OUT
-- rows for them: hall_name is the empty string, which the hall door list
-- filters out. Presence-wise their delegates simply sit under NOT SEATED
-- until a room hall checks them in.
--
-- Idempotent: re-running refreshes the same rows instead of duplicating.

INSERT INTO committees (id, name, hall_name) VALUES
  ('c_media',        'MEDIA',            ''),
  ('c_journalisme',  'JOURNALISME',      ''),
  ('c_bureau',       'BUREAU',           ''),
  ('c_bureau_sup',   'BUREAU SUPÉRIEUR', ''),
  ('c_it',           'IT',               ''),
  ('c_organisation', 'ORGANISATION',     '')
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name, hall_name = excluded.hall_name;
