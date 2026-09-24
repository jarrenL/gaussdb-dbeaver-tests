import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyTablespacePreview} from './verify-tablespace-preview.mjs';

const valid = 'Text pg_default visible=true enabled=true\nStyledText CREATE TABLESPACE pg_default visible=true enabled=true\nOK\n';
test('visible matching preview passes', () => assert.equal(verifyTablespacePreview(valid, 'pg_default').preview, 'passed'));
test('hidden stale preview does not pass', () => assert.throws(() => verifyTablespacePreview(valid.replace('pg_default visible=true enabled=true\nOK', 'pg_default visible=false enabled=true\nOK'), 'pg_default')));
test('source error does not pass', () => assert.throws(() => verifyTablespacePreview('ERROR WHILE READING SOURCE\n' + valid, 'pg_default')));
test('wrong object does not pass', () => assert.throws(() => verifyTablespacePreview(valid, 'pg_global')));
test('truncated result does not pass', () => assert.throws(() => verifyTablespacePreview(valid.replace('OK\n', ''), 'pg_default')));
