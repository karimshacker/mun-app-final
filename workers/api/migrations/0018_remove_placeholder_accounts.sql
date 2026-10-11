-- Remove the placeholder seed accounts u_head (Yacine Amrani) and
-- u_org (Sara Benali), plus all pre-event water order test data.
--
-- Chosen 2026-10-02: the operational accounts are now u_it (IT_ADMIN),
-- u_head_eg (HEAD), and the 20 Organizer1-20 station accounts (0017).
--
-- FK order matters: scan_events.scanned_by, meal_ledger.station_user_id and
-- chat_messages.sender_id have no ON DELETE action, so their rows are removed
-- (or detached) first. sessions, notification_receipts, chat_channel_members
-- and locations cascade, but they are deleted explicitly so the cleanup does
-- not depend on pragma foreign_keys being enabled. meal_ledger rows that
-- merely *reference* a deleted scan (scan_event_id … ON DELETE SET NULL) are
-- detached up front so no dangling ids survive even with FKs off.
-- Idempotent: every statement is a no-op once the rows are gone.

-- Detach meal-ledger rows from the scans that are about to be deleted.
UPDATE meal_ledger SET scan_event_id = NULL
WHERE scan_event_id IN (SELECT id FROM scan_events WHERE scanned_by IN ('u_head', 'u_org'));

-- Drop the placeholder accounts' activity (all pre-event test data).
DELETE FROM meal_ledger      WHERE station_user_id IN ('u_head', 'u_org');
DELETE FROM scan_events      WHERE scanned_by      IN ('u_head', 'u_org');
DELETE FROM chat_messages    WHERE sender_id       IN ('u_head', 'u_org');

-- Drop dependent rows that would otherwise only be removed by cascade.
DELETE FROM sessions                WHERE user_id IN ('u_head', 'u_org');
DELETE FROM notification_receipts   WHERE user_id IN ('u_head', 'u_org');
DELETE FROM chat_channel_members    WHERE user_id IN ('u_head', 'u_org');
DELETE FROM locations               WHERE user_id IN ('u_head', 'u_org');

-- The accounts themselves.
DELETE FROM users WHERE id IN ('u_head', 'u_org');

-- Clear all pre-event water order test data (14 rows, Sep 26-29:
-- deploy smoke tests, verification scans and cancelled retries).
DELETE FROM water_orders;
