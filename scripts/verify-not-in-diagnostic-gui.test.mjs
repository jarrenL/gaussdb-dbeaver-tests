import test from 'node:test';
import assert from 'node:assert/strict';
import { verify } from './verify-not-in-diagnostic-gui.mjs';

const sql = 'SELECT 1 WHERE 1 NOT IN (2, NULL);';
const good = 'diagnostic offset=17 length=16 severity=1 text=NOT IN 包含显式 NULL 候选值。若实际返回 NULL，未匹配比较可能得到 UNKNOWN 而非 TRUE，请核对筛选意图。\ndiagnostic-count=1\nOK\n';
test('accept warning range and conditional wording', () => verify(good, sql));
test('reject wrong range', () => assert.throws(() => verify(good.replace('offset=17', 'offset=18'), sql)));
test('reject error severity', () => assert.throws(() => verify(good.replace('severity=1', 'severity=2'), sql)));
test('reject missing completion', () => assert.throws(() => verify(good.replace('OK', ''), sql)));
test('accept clean state', () => verify('diagnostic-count=0\nOK\n', sql, true));
test('reject stale warning', () => assert.throws(() => verify(good, sql, true)));
