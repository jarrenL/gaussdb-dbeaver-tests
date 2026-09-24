import test from 'node:test';
import assert from 'node:assert/strict';
import { verify } from './verify-exists-diagnostic-gui.mjs';

const sql = 'SELECT 1 WHERE EXISTS (SELECT 1 FROM (SELECT 1 AS a WHERE 1=2) s);';
const good = 'diagnostic offset=15 length=50 severity=1 text=EXISTS 中包含没有自身 WHERE 条件的 SELECT，请确认。\ndiagnostic-count=1\nOK\n';
test('accept exact Chinese warning and source range', () => verify(good, sql));
test('reject wrong source range', () => assert.throws(() => verify(good.replace('offset=15', 'offset=16'), sql)));
test('reject error severity', () => assert.throws(() => verify(good.replace('severity=1', 'severity=2'), sql)));
test('reject missing completion', () => assert.throws(() => verify(good.replace('OK', ''), sql)));
test('accept cleared state', () => verify('diagnostic-count=0\nOK\n', sql, true));
test('reject stale annotation after correction', () => assert.throws(() => verify(good, sql, true)));
