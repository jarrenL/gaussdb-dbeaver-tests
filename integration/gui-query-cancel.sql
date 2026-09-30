-- Use an isolated ordinary-account SQL editor in Auto commit mode.
-- Run this statement, confirm it is active from an independent session,
-- then click Cancel in the result progress overlay before 120 seconds.
SELECT pg_sleep(120) /* dbv_gui_cancel_20260930 */;

-- After cancellation, run in the SAME editor. Verify same backend PID and
-- successful result fetching; a new independent connection is not proof.
SELECT 42 AS after_cancel /* dbv_gui_cancel_check_20260930 */;

-- Repeat the two phases. Do not run this file as a continuous SQL script:
-- the deliberate UI cancellation and independent checks are required.
-- No DDL/DML or persisted fixture is involved. End only after no tagged
-- query is active. Never cancel another user's query or restart the server.
