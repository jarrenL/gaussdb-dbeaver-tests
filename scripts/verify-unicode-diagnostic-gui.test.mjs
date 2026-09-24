import test from 'node:test';
import assert from 'node:assert/strict';
import { verify } from './verify-unicode-diagnostic-gui.mjs';

const sql = "-- 中文😀🧪\nSELECT '𠀀' WHERE 1 = NULL;\n";
const good = 'diagnostic offset=28 length=8 severity=1 text=判断空值请使用 IS NULL 或 IS NOT NULL\ndiagnostic-count=1\nOK\n';
test('UTF16 range is accepted', () => verify(good, sql));
test('codepoint range is rejected', () => assert.throws(() => verify(good.replace('offset=28', 'offset=25'), sql)));
test('wrong length is rejected', () => assert.throws(() => verify(good.replace('length=8', 'length=7'), sql)));
test('error is not warning', () => assert.throws(() => verify(good.replace('severity=1', 'severity=2'), sql)));
test('cleared annotations accepted', () => verify('diagnostic-count=0\nOK\n', sql, true));
test('stale annotation rejected', () => assert.throws(() => verify(good, sql, true)));
