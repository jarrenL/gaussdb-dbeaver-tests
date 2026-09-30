-- Dedicated GaussDB 507 centralized O/A test database, ordinary package owner.
-- Run with a package-capable account. Existing schema intentionally causes failure.
-- gsql script; slash separators delimit package statements.
\set ON_ERROR_STOP on
BEGIN;
CREATE SCHEMA dbv_pkg_gui_20260930;
SET enable_force_create_obj=on;
SET plsql_show_all_error=off;
CREATE PACKAGE dbv_pkg_gui_20260930.gui_valid AS
 FUNCTION value_of RETURN INTEGER;
END gui_valid;
/
CREATE PACKAGE BODY dbv_pkg_gui_20260930.gui_valid AS
 FUNCTION value_of RETURN INTEGER AS
 BEGIN
 RETURN 42;
 END;
END gui_valid;
/
CREATE PACKAGE dbv_pkg_gui_20260930.gui_bad AS
 FUNCTION value_of RETURN INTEGER;
END gui_bad;
/
CREATE PACKAGE BODY dbv_pkg_gui_20260930.gui_bad AS
 FUNCTION value_of RETURN INTEGER AS
 missing dbv_pkg_gui_20260930.no_such_table.id%TYPE;
 BEGIN
 RETURN 1;
 END;
END gui_bad;
/
COMMIT;

-- GUI: refresh schemas, select gui_valid, Compile Specification/Body/All.
-- Each should succeed; independent SELECT below must return 42.
SELECT dbv_pkg_gui_20260930.gui_valid.value_of();
-- Compile gui_bad Body; verify diagnostic targets the missing type source line.
SELECT name,type,line,src FROM dbe_pldeveloper.gs_errors WHERE name='gui_bad';

-- Repair separately through SQL editor/JDBC, then recompile through GUI:
-- CREATE OR REPLACE PACKAGE BODY dbv_pkg_gui_20260930.gui_bad AS
--  FUNCTION value_of RETURN INTEGER AS
--  BEGIN
--  RETURN 43;
--  END;
-- END gui_bad;
-- /
-- Expect Normal state, no compiler errors, independent value_of()=43.

-- Cleanup only these owned test objects, in one transaction. Do not use schema CASCADE.
-- BEGIN;
-- DROP PACKAGE dbv_pkg_gui_20260930.gui_bad;
-- DROP PACKAGE dbv_pkg_gui_20260930.gui_valid;
-- DROP SCHEMA dbv_pkg_gui_20260930 RESTRICT;
-- COMMIT;
-- If any cleanup statement fails, ROLLBACK and inspect; do not broaden deletion.
