-- Disposable acceptance schema only; create the schema before using this file.
CREATE TABLE dbv_hist_gui_20260923.csv_cancel_probe (id integer PRIMARY KEY, label text);
CREATE FUNCTION dbv_hist_gui_20260923.csv_cancel_delay() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    PERFORM pg_sleep(0.1);
    RETURN NEW;
END;
$$;
CREATE TRIGGER csv_cancel_delay BEFORE INSERT ON dbv_hist_gui_20260923.csv_cancel_probe
FOR EACH ROW EXECUTE PROCEDURE dbv_hist_gui_20260923.csv_cancel_delay();
-- Execute as the acceptance user, or explicitly grant it access to these objects.
-- Import 500 records: id=1..500, label=cancel-fixture-<id>.
-- Use transactions, commit interval 10000, disable batching, no truncate.
-- During active INSERT, cancel from the wizard; expected committed count is 0.
