"""Verify the dedicated ORA GUI export fixture, never arbitrary customer data.

Export csv_export_probe through the DBeaver CSV wizard with UTF-8, no BOM,
top header, comma delimiter and <NULL> null marker. The fixture's empty SQL
string is stored as NULL in the tested ORA database.
"""

import csv
import io
import pathlib
import sys


def verify(path):
    raw = pathlib.Path(path).read_bytes()
    if raw.startswith(b"\xef\xbb\xbf"):
        raise AssertionError("Unexpected UTF-8 BOM")
    rows = list(csv.reader(io.StringIO(raw.decode("utf-8"), newline="")))
    expected = [
        ["1", '中文,"引号"\n第二行', "123.4500", "00123"],
        ["2", "<NULL>", "-0.0100", "00000"],
        ["3", "<NULL>", "<NULL>", "<NULL>"],
    ]
    if not rows or rows[0] != ["id", "label", "amount", "postal"]:
        raise AssertionError("Header mismatch")
    if sorted(rows[1:]) != expected:
        raise AssertionError("Record values/count mismatch")
    print("PASS: GUI CSV fixture, 3 records, UTF-8, quoting, NULL, scale and leading zeros")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Usage: python3 verify-gui-csv-export.py EXPORTED_CSV")
    verify(sys.argv[1])
