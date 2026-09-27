-- Session revocation: logout needs to invalidate the refresh-token session
-- row, and SQLite has no way to drop a session without a marker column.
-- Additive: existing sessions keep working, they just start with a NULL
-- revoked_at, which the refresh route treats as "not revoked".

ALTER TABLE sessions ADD COLUMN revoked_at TEXT;
