-- Disposable transaction-local syntax probe. No persistent objects or grants.
-- This does not verify the DBeaver confirmation dialog.
BEGIN;
CREATE TEMP TABLE dbv_safety_only_20260923 (id integer, amount integer);
INSERT INTO dbv_safety_only_20260923 VALUES (1, 10), (2, 20);
UPDATE ONLY dbv_safety_only_20260923 SET amount=30;
SELECT count(*) AS updated_rows FROM dbv_safety_only_20260923 WHERE amount=30;
DELETE FROM ONLY dbv_safety_only_20260923;
SELECT count(*) AS remaining_rows FROM dbv_safety_only_20260923;
ROLLBACK;
