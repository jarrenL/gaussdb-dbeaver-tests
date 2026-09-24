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
    assert.equal(Number(row[1]), sql.indexOf('NOT IN'));
    assert.equal(sql.slice(Number(row[1]), Number(row[1]) + Number(row[2])), 'NOT IN (2, NULL)');
    assert.match(row[4], /^NOT IN 包含显式 NULL 候选值/);
    assert.match(row[4], /若实际返回 NULL/);
    assert.match(row[4], /可能得到 UNKNOWN 而非 TRUE/);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const args = process.argv.slice(2);
    assert.equal(args.length, 4, 'Expected positive and corrected result/SQL pairs');
    verify(fs.readFileSync(args[0], 'utf8'), fs.readFileSync(args[1], 'utf8'));
    verify(fs.readFileSync(args[2], 'utf8'), fs.readFileSync(args[3], 'utf8'), true);
    console.log(JSON.stringify({ passed: true, cases: 2, nullRange: true, correctedClean: true }));
}
