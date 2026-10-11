-- Rename the organizer station accounts to the real staff names
-- (provided 2026-10-02). Phones and PINs are unchanged — display name only.
--
-- Note: the provided list skips 13 (numbered 1-12, then 14), so u_org13
-- keeps its placeholder name for now. Idempotent: re-running is a no-op.

UPDATE users SET name = 'Yazan'          WHERE id = 'u_org1';
UPDATE users SET name = 'Omar Adel'      WHERE id = 'u_org2';
UPDATE users SET name = 'Tayem Sweify'   WHERE id = 'u_org3';
UPDATE users SET name = 'Yassin Hussein' WHERE id = 'u_org4';
UPDATE users SET name = 'Ahmed Haitham'  WHERE id = 'u_org5';
UPDATE users SET name = 'Hassan Saqr'    WHERE id = 'u_org6';
UPDATE users SET name = 'Youssef Wael'   WHERE id = 'u_org7';
UPDATE users SET name = 'Ali Amr'        WHERE id = 'u_org8';
UPDATE users SET name = 'Malek Islam'    WHERE id = 'u_org9';
UPDATE users SET name = 'Belal Madien'   WHERE id = 'u_org10';
UPDATE users SET name = 'Mohannad Hesham' WHERE id = 'u_org11';
UPDATE users SET name = 'Youssef Ali'    WHERE id = 'u_org12';
UPDATE users SET name = 'Adam Ahmed'     WHERE id = 'u_org14';
