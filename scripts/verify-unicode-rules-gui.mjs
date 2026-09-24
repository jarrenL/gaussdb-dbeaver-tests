import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

export function verify(text, sql) {
    assert.match(text, /(?:^|\n)OK\s*$/);
    const rows = [...text.matchAll(/^diagnostic offset=(\d+) length=(\d+) severity=(\d+) text=(.*)$/gm)];
    const expected = [
        ['LIKE ', "'%𠀀'"], ['比较两侧', '1=1'],
        ['EXISTS ', "EXISTS (SELECT '🧪')"], ['NOT IN ', 'NOT IN (2,NULL)'],
        ['CASE ', "'😀'='🧪'"]
    ];
    assert.equal(rows.length, expected.length);
    assert.match(text, /^diagnostic-count=5$/m);
    for (const [prefix, marked] of expected) {
        const matching = rows.filter(r => r[4].startsWith(prefix));
        assert.equal(matching.length, 1, prefix);
        const row = matching[0];
        assert.equal(Number(row[3]), 1);
        assert.equal(Number(row[1]), sql.lastIndexOf(marked), prefix);
        assert.equal(sql.slice(Number(row[1]), Number(row[1]) + Number(row[2])), marked);
    }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    assert.equal(process.argv.length, 4);
    verify(fs.readFileSync(process.argv[2], 'utf8'), fs.readFileSync(process.argv[3], 'utf8'));
    console.log(JSON.stringify({ passed: true, rules: 5, utf16Ranges: true }));
}
