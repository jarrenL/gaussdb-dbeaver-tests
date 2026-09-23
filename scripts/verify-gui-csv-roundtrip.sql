-- Run only after the dedicated GUI export/import fixture has been executed.
-- Read-only verification, including duplicate multiplicity and NULL semantics.
SELECT COUNT(*) AS imported_rows
FROM dbv_hist_gui_20260923.csv_import_probe;

SELECT COUNT(*) AS differences
FROM (
    (SELECT * FROM dbv_hist_gui_20260923.csv_export_probe
     EXCEPT ALL
     SELECT * FROM dbv_hist_gui_20260923.csv_import_probe)
    UNION ALL
    (SELECT * FROM dbv_hist_gui_20260923.csv_import_probe
     EXCEPT ALL
     SELECT * FROM dbv_hist_gui_20260923.csv_export_probe)
) differences;
-- Required results: imported_rows = 3 AND differences = 0.
