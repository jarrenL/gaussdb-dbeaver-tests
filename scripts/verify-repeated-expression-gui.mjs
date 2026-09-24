import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

export function verify(text, sql, clean = false) {
    assert.match(text, /(?:^|\n)OK\s*$/);
    const rows = [...text.matchAll(/^diagnostic offset=(\d+) length=(\d+) severity=(\d+) text=(.*)$/gm)];
    assert.equal(rows.length, clean ? 0 : 2);
    assert.match(text, new RegExp(`^diagnostic-count=${clean ? 0 : 2}$`, 'm'));
    if (clean) return;
    const caseRow = rows.find(r => r[4].startsWith('CASE '));
    const comparison = rows.find(r => r[4].startsWith('比较两侧'));
    assert(caseRow && comparison);
    for (const row of rows) assert.equal(Number(row[3]), 1);
    assert.equal(Number(caseRow[1]), sql.lastIndexOf('1=2'));
    assert.equal(Number(caseRow[2]), 3);
    assert.equal(sql.slice(Number(comparison[1]), Number(comparison[1]) + Number(comparison[2])), '3=3');
    assert.match(caseRow[4], /重复求值仍可能得到不同结果/);
    assert.match(comparison[4], /不代表结果必然为常量/);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const args = process.argv.slice(2);
    assert.equal(args.length, 6, 'Expected positive, corrected and token-boundary result/SQL pairs');
    for (let i = 0; i < 3; i++) verify(fs.readFileSync(args[i * 2], 'utf8'), fs.readFileSync(args[i * 2 + 1], 'utf8'), i > 0);
    console.log(JSON.stringify({ passed: true, cases: 3, duplicateBranchRange: true, correctedAndBoundaryClean: true }));
}
