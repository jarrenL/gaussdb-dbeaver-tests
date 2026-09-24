import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

export function verify(text, sql, expected) {
    assert.match(text, /(?:^|\n)OK\s*$/);
    const rows = [...text.matchAll(/^diagnostic offset=(\d+) length=(\d+) severity=(\d+) text=(.*)$/gm)];
    assert.equal(rows.length, expected);
    assert.match(text, new RegExp(`^diagnostic-count=${expected}$`, 'm'));
    for (const row of rows) {
        assert.equal(Number(row[3]), 1);
        assert.equal(sql.slice(Number(row[1]), Number(row[1]) + Number(row[2])), '1 = NULL');
        assert.match(row[4], /与 NULL 直接比较/);
        assert.match(row[4], /IS NULL.*IS NOT NULL/);
    }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const args = process.argv.slice(2);
    assert.equal(args.length, 6, 'Expected three result/SQL path pairs');
    for (let i = 0; i < 3; i++) {
        verify(fs.readFileSync(args[i * 2], 'utf8'), fs.readFileSync(args[i * 2 + 1], 'utf8'), i === 1 ? 0 : 1);
    }
    console.log(JSON.stringify({ passed: true, scenarios: 3, checks: ['Chinese warning', 'cleared warning', 'multiline range'] }));
}
