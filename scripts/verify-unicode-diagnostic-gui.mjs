import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

export function verify(text, sql, clean = false) {
    assert.match(text, /(?:^|\n)OK\s*$/);
    const rows = [...text.matchAll(/^diagnostic offset=(\d+) length=(\d+) severity=(\d+) text=(.*)$/gm)];
    assert.equal(rows.length, clean ? 0 : 1);
    assert.match(text, new RegExp(`^diagnostic-count=${clean ? 0 : 1}$`, 'm'));
    if (clean) return;
    const row = rows[0];
    assert.equal(Number(row[3]), 1);
    assert.equal(Number(row[1]), sql.indexOf('1 = NULL'));
    assert.equal(sql.slice(Number(row[1]), Number(row[1]) + Number(row[2])), '1 = NULL');
    assert.match(row[4], /判断空值请使用 IS NULL 或 IS NOT NULL/);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const args = process.argv.slice(2);
    assert.equal(args.length, 5, 'Expected old result, fixed result, positive SQL, corrected result and SQL');
    const sql = fs.readFileSync(args[2], 'utf8');
    assert.throws(() => verify(fs.readFileSync(args[0], 'utf8'), sql));
    verify(fs.readFileSync(args[1], 'utf8'), sql);
    verify(fs.readFileSync(args[3], 'utf8'), fs.readFileSync(args[4], 'utf8'), true);
    console.log(JSON.stringify({ passed: true, oldRangeRejected: true, fixedRange: true, correctedClean: true }));
}
