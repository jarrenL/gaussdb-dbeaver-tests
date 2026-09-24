import test from 'node:test';
import assert from 'node:assert/strict';
import { verify } from './verify-repeated-expression-gui.mjs';
const sql = '1=2 1=2 3=3';
const good = 'diagnostic offset=4 length=3 severity=1 text=CASE 重复求值仍可能得到不同结果\n'
    + 'diagnostic offset=8 length=3 severity=1 text=比较两侧；不代表结果必然为常量\ndiagnostic-count=2\nOK\n';
test('accepts second WHEN and comparison ranges', () => verify(good, sql));
test('rejects first WHEN highlighted instead of duplicate', () => assert.throws(() => verify(good.replace('offset=4', 'offset=0'), sql)));
test('rejects stale diagnostics', () => assert.throws(() => verify(good, sql, true)));
test('rejects severity mismatch', () => assert.throws(() => verify(good.replace('severity=1', 'severity=2'), sql)));
test('rejects failed command', () => assert.throws(() => verify(good.replace('OK', 'FAIL'), sql)));
test('accepts clean document', () => verify('diagnostic-count=0\nOK\n', '', true));
