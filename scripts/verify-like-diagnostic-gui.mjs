import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

export function verify(text, sql, corrected = false) {
    assert.match(text, /(?:^|\n)OK\s*$/);
    const rows = [...text.matchAll(/^diagnostic offset=(\d+) length=(\d+) severity=(\d+) text=(.*)$/gm)];
    assert.equal(rows.length, corrected ? 0 : 1);
    assert.match(text, new RegExp(`^diagnostic-count=${corrected ? 0 : 1}$`, 'm'));
    if (!corrected) {
        const row = rows[0];
        assert.equal(Number(row[3]), 1);
        assert.equal(sql.slice(Number(row[1]), Number(row[1]) + Number(row[2])), "'%尾部'");
        assert.match(row[4], /^LIKE 模式以通配符开头/);
        assert.match(row[4], /可能.*执行计划/);
    }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const args = process.argv.slice(2);
    assert.equal(args.length, 4, 'Expected positive result/SQL and corrected result/SQL paths');
    verify(fs.readFileSync(args[0], 'utf8'), fs.readFileSync(args[1], 'utf8'));
    verify(fs.readFileSync(args[2], 'utf8'), fs.readFileSync(args[3], 'utf8'), true);
    console.log(JSON.stringify({ passed: true, chineseWarning: true, patternRange: true, escapedPatternClearsWarning: true }));
}
