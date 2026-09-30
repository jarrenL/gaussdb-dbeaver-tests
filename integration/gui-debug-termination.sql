-- Run as the dedicated ordinary acceptance user in an isolated O/A database.
-- An administrator must grant the required debugger role separately, and revoke
-- only the temporary grant after testing. Never run against a business schema.
-- Refuse an existing fixture: do not use IF NOT EXISTS or DROP before creation.
\set ON_ERROR_STOP on
BEGIN;
CREATE SCHEMA dbv_gui_f10_fixture;
CREATE TABLE dbv_gui_f10_fixture.audit(id integer);
INSERT INTO dbv_gui_f10_fixture.audit VALUES(1);
CREATE PROCEDURE dbv_gui_f10_fixture.write_then_wait(p_id integer)
AS
BEGIN
  INSERT INTO dbv_gui_f10_fixture.audit VALUES(p_id);
  PERFORM pg_sleep(300);
END;
/
COMMIT;
-- GUI: select procedure, input 2, launch, step INSERT, then step pg_sleep.
-- Independent observer must see only id=1 while target CALL is actively waiting.
-- Click debugger Terminate, then assert only id=1 and no matching active CALL.
-- Restart same configuration and repeat before cleanup.
-- After verifying no active target, explicitly run:
-- DROP SCHEMA dbv_gui_f10_fixture CASCADE;
-- Confirm schema absence and restore the debugger-role membership baseline.
