import test from 'node:test';
import assert from 'node:assert/strict';
import { verify } from './verify-like-diagnostic-gui.mjs';
const result = 'diagnostic offset=0 length=5 severity=1 text=LIKE 模式以通配符开头，可能影响索引，请检查执行计划\ndiagnostic-count=1\nOK\n';
test('accepts exact Chinese pattern warning', () => verify(result, "'%尾部'"));
test('rejects incorrect range', () => assert.throws(() => verify(result.replace('length=5', 'length=4'), "'%尾部'")));
test('rejects stale warning for escaped pattern', () => assert.throws(() => verify(result, "'%%尾部'", true)));
test('rejects incomplete command', () => assert.throws(() => verify(result.replace('OK', 'FAIL'), "'%尾部'")));
test('accepts cleared annotations', () => verify('diagnostic-count=0\nOK\n', "'%%尾部'", true));
