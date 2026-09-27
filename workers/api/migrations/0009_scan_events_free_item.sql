-- station_type gains FREE_ITEM (the once-per-day journal handout). SQLite
-- cannot alter a CHECK constraint, so the table is rebuilt: copy → drop →
-- rename → recreate indexes. The foreign key to participants is preserved.

CREATE TABLE scan_events_new (
  id              TEXT PRIMARY KEY,
  participant_id  TEXT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  station_type    TEXT NOT NULL CHECK (station_type IN ('CONFERENCE_IN','CONFERENCE_OUT','HALL_IN','HALL_OUT','MEAL','FREE_ITEM')),
  committee_id    TEXT REFERENCES committees(id) ON DELETE SET NULL,
  scanned_by      TEXT NOT NULL REFERENCES users(id),
  entry_method    TEXT NOT NULL CHECK (entry_method IN ('NFC', 'ALT_CODE')),
  client_scan_id  TEXT NOT NULL,
  at              TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(client_scan_id)
);

INSERT INTO scan_events_new
  (id, participant_id, station_type, committee_id, scanned_by, entry_method, client_scan_id, at)
SELECT id, participant_id, station_type, committee_id, scanned_by, entry_method, client_scan_id, at
  FROM scan_events;

DROP TABLE scan_events;
ALTER TABLE scan_events_new RENAME TO scan_events;

CREATE INDEX IF NOT EXISTS idx_scans_participant ON scan_events(participant_id, at);
CREATE INDEX IF NOT EXISTS idx_scans_station     ON scan_events(station_type, at);
CREATE INDEX IF NOT EXISTS idx_scans_committee   ON scan_events(committee_id);
