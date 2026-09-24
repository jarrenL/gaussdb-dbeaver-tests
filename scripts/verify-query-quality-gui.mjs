import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

export function verify(text, sql, corrected = false) {
    assert.match(text, /(?:^|\n)OK\s*$/);
    const rows = [...text.matchAll(/^diagnostic offset=(\d+) length=(\d+) severity=(\d+) text=(.*)$/gm)];
    assert.equal(rows.length, corrected ? 0 : 3);
    assert.match(text, new RegExp(`^diagnostic-count=${corrected ? 0 : 3}$`, 'm'));
    const expected = new Map([
        ['INSERT', ['VALUES (1)', '未显式列出目标列']],
        ['SELECT', ['*', '显式列出查询列']],
        ['ORDER', ['1', '查询列序号']],
    ]);
    for (const row of rows) {
        assert.equal(Number(row[3]), 1);
        const key = row[4].split(' ')[0];
        assert(expected.has(key), 'Unknown or duplicated rule');
        const [fragment, phrase] = expected.get(key);
        assert.equal(sql.slice(Number(row[1]), Number(row[1]) + Number(row[2])), fragment);
        assert(row[4].includes(phrase));
        expected.delete(key);
    }
    if (!corrected) assert.equal(expected.size, 0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const args = process.argv.slice(2);
    assert.equal(args.length, 4, 'Expected positive result/SQL and corrected result/SQL paths');
    verify(fs.readFileSync(args[0], 'utf8'), fs.readFileSync(args[1], 'utf8'));
    verify(fs.readFileSync(args[2], 'utf8'), fs.readFileSync(args[3], 'utf8'), true);
    console.log(JSON.stringify({ passed: true, rules: 3, cleared: true, rangesVerified: true }));
}
