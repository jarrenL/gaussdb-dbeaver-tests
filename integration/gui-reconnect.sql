-- Disposable acceptance schema only. Run each phase manually in the named session.
-- Abort if this schema already exists: never reuse an unknown object's data.
-- Writer: DBeaver SQL editor, ordinary account, initially Auto commit.
CREATE SCHEMA dbv_reconnect_gui_20260930;
CREATE TABLE dbv_reconnect_gui_20260930.audit (id integer PRIMARY KEY, note text);

-- Writer: use toolbar to select manual commit, then execute only this INSERT.
INSERT INTO dbv_reconnect_gui_20260930.audit VALUES (1,'uncommitted');
-- Observer on a separate connection must see zero; writer must see one.
SELECT count(*) AS audit_count FROM dbv_reconnect_gui_20260930.audit;

-- UI: Disconnect -> Cancel; same writer remains in transaction.
-- UI: Disconnect -> No (rollback); observer still sees zero, writer backend ends.
-- UI: Connect; then manual commit and repeat the INSERT above.
-- Record writer's own PID before the insert. Termination is a separate controlled
-- admin operation, only after matching PID, account and this fixture's SQL.
SELECT pg_backend_pid();
-- Do not terminate by username alone and do not stop the database/container.

-- Writer after controlled termination: query must report connection failure.
SELECT count(*) AS audit_count FROM dbv_reconnect_gui_20260930.audit;
-- UI: Disconnect/reconnect -> No; repeat query. Observer must still see zero.
INSERT INTO dbv_reconnect_gui_20260930.audit VALUES (2,'after_reconnect');
-- UI: toolbar Commit. Observer must see exactly this new row, never id 1.
SELECT id,note FROM dbv_reconnect_gui_20260930.audit ORDER BY id;

-- Cleanup only after ending all fixture transactions. RESTRICT prevents
-- removal of unexpected dependencies; investigate rather than using CASCADE.
BEGIN;
DROP TABLE dbv_reconnect_gui_20260930.audit RESTRICT;
DROP SCHEMA dbv_reconnect_gui_20260930 RESTRICT;
COMMIT;
