-- System-sent notifications: the public water worker stamps a "Water for
-- <committee>" notice into every inbox when an order arrives. Its sender is
-- the system, not a user row, so sent_by becomes nullable. SQLite cannot
-- alter a column constraint, so the table is rebuilt; receipt rows are
-- backed up first because dropping the parent cascades them away.
CREATE TABLE notifications_new (
  id              TEXT PRIMARY KEY,
  sent_by         TEXT REFERENCES users(id),  -- NULL = sent by the system
  audience        TEXT NOT NULL,
  title           TEXT NOT NULL,
  body            TEXT NOT NULL,
  at              TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE receipts_backup AS SELECT * FROM notification_receipts;

INSERT INTO notifications_new (id, sent_by, audience, title, body, at)
  SELECT id, sent_by, audience, title, body, at FROM notifications;

DROP TABLE notifications;  -- cascades receipt rows; restored below

ALTER TABLE notifications_new RENAME TO notifications;
CREATE INDEX idx_notifications_at ON notifications(at);

DELETE FROM notification_receipts;
INSERT INTO notification_receipts (notification_id, user_id, delivered_at, read_at)
  SELECT notification_id, user_id, delivered_at, read_at FROM receipts_backup;
DROP TABLE receipts_backup;
