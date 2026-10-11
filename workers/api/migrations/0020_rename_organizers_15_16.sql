-- Rename the next two organizer accounts to real staff names
-- (provided 2026-10-02). Phones and PINs unchanged — display name only.
-- Idempotent: re-running is a no-op.

UPDATE users SET name = 'Ezz Ramy'      WHERE id = 'u_org15';
UPDATE users SET name = 'Malek Shoukry' WHERE id = 'u_org16';
