-- Disposable GaussDB O/A test database only. Run as the dedicated test user.
-- CREATE deliberately rejects existing fixtures. Do not use CREATE OR REPLACE.
BEGIN;
CREATE SCHEMA dbv_frames_20260930;
CREATE PROCEDURE dbv_frames_20260930.child_frame() AS DECLARE
v_shared integer := 222;
BEGIN
v_shared := v_shared + 1;
v_shared := v_shared + 2;
END;
/
CREATE PROCEDURE dbv_frames_20260930.parent_frame() AS DECLARE
v_shared integer := 111;
BEGIN
dbv_frames_20260930.child_frame();
v_shared := v_shared + 1;
END;
/
COMMIT;

-- GUI: Debug parent_frame, Step Into at child call. Child v_shared=222.
-- Double-click parent frame: v_shared=111 and Change Value is disabled.
-- Return to child, Change Value to 999. Parent still 111; child still 999.
-- Step Return: parent becomes current frame, v_shared remains 111.
-- End debug before cleanup. Execute cleanup separately, not with setup:
-- BEGIN;
-- DROP PROCEDURE dbv_frames_20260930.parent_frame() RESTRICT;
-- DROP PROCEDURE dbv_frames_20260930.child_frame() RESTRICT;
-- DROP SCHEMA dbv_frames_20260930 RESTRICT;
-- COMMIT;
-- On any cleanup error ROLLBACK; never replace RESTRICT with CASCADE.
