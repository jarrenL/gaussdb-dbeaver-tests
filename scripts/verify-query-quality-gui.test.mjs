import test from 'node:test';
import assert from 'node:assert/strict';
import { verify } from './verify-query-quality-gui.mjs';

const sql = 'VALUES (1) * 1';
const good = 'diagnostic offset=0 length=10 severity=1 text=INSERT 未显式列出目标列\n'
    + 'diagnostic offset=11 length=1 severity=1 text=SELECT * 建议显式列出查询列\n'
    + 'diagnostic offset=13 length=1 severity=1 text=ORDER BY 使用查询列序号\ndiagnostic-count=3\nOK\n';
test('accepts three distinct diagnostics with exact ranges', () => verify(good, sql));
test('rejects missing rule', () => assert.throws(() => verify(good.replace(/^diagnostic offset=0.*\n/, ''), sql)));
test('rejects wrong range', () => assert.throws(() => verify(good.replace('offset=11', 'offset=12'), sql)));
test('rejects stale warnings after correction', () => assert.throws(() => verify(good, sql, true)));
test('accepts corrected document', () => verify('diagnostic-count=0\nOK\n', '', true));
test('rejects driver failure', () => assert.throws(() => verify(good.replace('OK', 'FAIL'), sql)));
