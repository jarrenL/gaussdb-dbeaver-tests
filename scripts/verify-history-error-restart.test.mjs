import {test} from 'node:test';
import assert from 'node:assert/strict';
import {verifyHistoryErrorRestart as verify} from './verify-history-error-restart.mjs';

const error = ' row=[dbv_persistent_error_20260924, [12050] Division by zero., distributed_acceptance]';
const success = ' row=[dbv_persistent_history_20260924, 成功, distributed_acceptance]';
const before = `1 Table visible=true\n${error}\n${success}\n2 Composite`;
const after = `3 Table visible=true\n${error}\n${success}\n4 Table visible=true\n5 Composite`;
test('accepts unchanged error and success history with empty current session', () => {
  assert.equal(verify(before, after, 1, 3, 4).passed, true);
});
test('rejects a missing restored error', () => {
  assert.throws(() => verify(before, after.replace(error, ''), 1, 3, 4));
});
test('rejects changed error details', () => {
  assert.throws(() => verify(before, after.replace('Division by zero.', 'other'), 1, 3, 4));
});
test('rejects duplicates', () => {
  assert.throws(() => verify(before, after.replace(error, `${error}\n${error}`), 1, 3, 4));
});
test('rejects history leaking into current session', () => {
  assert.throws(() => verify(before, after.replace('4 Table visible=true', `4 Table visible=true\n${error}`), 1, 3, 4));
});
test('rejects missing table evidence', () => {
  assert.throws(() => verify(before, after, 1, 9, 4));
});
