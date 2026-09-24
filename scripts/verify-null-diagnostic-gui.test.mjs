import test from 'node:test';
import assert from 'node:assert/strict';
import { verify } from './verify-null-diagnostic-gui.mjs';

const sql = 'SELECT 1 WHERE 1 = NULL;';
const result = 'diagnostic offset=15 length=8 severity=1 text=与 NULL 直接比较，IS NULL 或 IS NOT NULL\ndiagnostic-count=1\nOK\n';
test('accepts matching warning and source range', () => verify(result, sql, 1));
test('rejects wrong offset', () => assert.throws(() => verify(result.replace('offset=15', 'offset=14'), sql, 1)));
test('rejects stale warning after correction', () => assert.throws(() => verify(result, 'SELECT 1 WHERE 1 IS NOT NULL;', 0)));
test('rejects driver failure', () => assert.throws(() => verify(result.replace('OK', 'FAIL'), sql, 1)));
test('accepts zero diagnostics for corrected SQL', () => verify('diagnostic-count=0\nOK\n', 'SELECT 1 WHERE 1 IS NOT NULL;', 0));
