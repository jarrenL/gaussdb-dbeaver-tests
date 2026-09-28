import test from 'node:test';
import assert from 'node:assert/strict';
import { verify } from './verify-unicode-rules-gui.mjs';

const sql = "-- 中文😀\nSELECT '𠀀' LIKE '%𠀀', 1=1, EXISTS (SELECT '🧪'), 1 NOT IN (2,NULL), CASE WHEN '😀'='🧪' THEN 0 WHEN '😀'='🧪' THEN 1 END;";
const rules = [
    ['LIKE ', "'%𠀀'"], ['比较两侧', '1=1'],
    ['EXISTS ', "EXISTS (SELECT '🧪')"], ['NOT IN ', 'NOT IN (2,NULL)'],
    ['CASE ', "'😀'='🧪'"]
];
const rows = rules.map(([prefix, marked]) =>
    `diagnostic offset=${sql.lastIndexOf(marked)} length=${marked.length} severity=1 text=${prefix}测试警告`);
const snapshot = list => `${list.join('\n')}\ndiagnostic-count=5\nOK\n`;

test('all five Unicode rules have exact UTF16 source ranges', () => verify(snapshot(rows), sql));
test('annotation order is irrelevant', () => verify(snapshot([...rows].reverse()), sql));
test('codepoint offset cannot substitute for UTF16 offset', () => {
    const offset = sql.lastIndexOf("'%𠀀'");
    const bad = rows[0].replace(`offset=${offset}`, `offset=${[...sql.slice(0, offset)].length}`);
    assert.throws(() => verify(snapshot([bad, ...rows.slice(1)]), sql));
});
test('first CASE occurrence cannot replace repeated occurrence', () => {
    const marked = "'😀'='🧪'";
    const bad = rows[4].replace(`offset=${sql.lastIndexOf(marked)}`, `offset=${sql.indexOf(marked)}`);
    assert.throws(() => verify(snapshot([...rows.slice(0, 4), bad]), sql));
});
test('missing rule is rejected', () => assert.throws(() => verify(snapshot(rows.slice(1)), sql)));
test('duplicate rule cannot stand in for missing rule', () =>
    assert.throws(() => verify(snapshot([rows[0], rows[0], ...rows.slice(2)]), sql)));
test('incorrect reported count is rejected', () =>
    assert.throws(() => verify(snapshot(rows).replace('diagnostic-count=5', 'diagnostic-count=4'), sql)));
test('error severity is not an advisory warning', () =>
    assert.throws(() => verify(snapshot(rows).replace('severity=1', 'severity=2'), sql)));
test('truncated result without completion is rejected', () =>
    assert.throws(() => verify(snapshot(rows).replace('\nOK\n', '\n'), sql)));
test('different source text cannot reuse the old snapshot', () =>
    assert.throws(() => verify(snapshot(rows), sql.replace('1=1', '1=2'))));
