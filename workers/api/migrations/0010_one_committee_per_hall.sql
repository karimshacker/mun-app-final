-- One committee per hall, and the original GA/SOCHUM/UNSC seeds removed.
-- Demo participants are re-pointed at the real committees before the seed
-- rows are deleted; scan_events.committee_id / users.committee_id are ON
-- DELETE SET NULL, so history survives the delete as unscoped rows.

-- Re-point the demo roster (and any dry-run participant still on a seed).
UPDATE participants SET committee_id = 'c_ag1'    WHERE committee_id = 'c_ga';
UPDATE participants SET committee_id = 'c_cs'     WHERE committee_id = 'c_sochum';
UPDATE participants SET committee_id = 'c_cij'    WHERE committee_id = 'c_unsc';
-- water_orders.committee_id has no ON DELETE rule: re-point before deleting.
UPDATE water_orders SET committee_id = 'c_ag1'    WHERE committee_id = 'c_ga';
UPDATE water_orders SET committee_id = 'c_cs'     WHERE committee_id = 'c_sochum';
UPDATE water_orders SET committee_id = 'c_cij'    WHERE committee_id = 'c_unsc';
UPDATE users      SET committee_id = NULL         WHERE committee_id IN ('c_ga','c_sochum','c_unsc');

-- Each committee chairs its own hall: eight committees, eight halls.
UPDATE committees SET hall_name = 'Hall 1' WHERE id = 'c_ag1';
UPDATE committees SET hall_name = 'Hall 2' WHERE id = 'c_ag4';
UPDATE committees SET hall_name = 'Hall 3' WHERE id = 'c_cs';
UPDATE committees SET hall_name = 'Hall 4' WHERE id = 'c_csh';
UPDATE committees SET hall_name = 'Hall 5' WHERE id = 'c_ams';
UPDATE committees SET hall_name = 'Hall 6' WHERE id = 'c_hrc';
UPDATE committees SET hall_name = 'Hall 7' WHERE id = 'c_cij';
UPDATE committees SET hall_name = 'Hall 8' WHERE id = 'c_ecosoc';

-- Remove the seeds. Presence rows referencing them are deleted (a delegate
-- cannot be "in" a hall that no longer exists); scan history keeps its
-- committee_id only as historical data via SET NULL.
DELETE FROM participant_presence WHERE hall_id IN ('c_ga','c_sochum','c_unsc');
DELETE FROM committees WHERE id IN ('c_ga','c_sochum','c_unsc');
