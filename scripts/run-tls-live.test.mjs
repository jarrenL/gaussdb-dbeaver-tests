import {test} from 'node:test';
import assert from 'node:assert/strict';
import {withTlsFixture, ownedContainer} from './run-tls-live.mjs';
const id = 'a'.repeat(64);
test('successful and failed suites remove only the container they created', () => {
    for (const result of [0, 1]) {
        const removed = [];
        assert.equal(withTlsFixture({create: () => id, prepare: () => {}, run: () => result, remove: value => removed.push(value)}), result);
        assert.deepEqual(removed, [id]);
    }
});
test('partial setup failure still removes the owned container', () => {
    const failure = Error('setup'); const removed = [];
    assert.throws(() => withTlsFixture({create: () => id, prepare: () => {throw failure;}, remove: value => removed.push(value)}), e => e === failure);
    assert.deepEqual(removed, [id]);
});
test('invalid identity and failed creation never target another container', () => {
    for (const create of [() => 'gaussdb-507-ha-lab', () => {throw Error('create');}]) {
        assert.throws(() => withTlsFixture({create, remove: () => assert.fail('must not remove')}));
    }
    for (const value of ['', '--all', id + '\n', '/']) assert.throws(() => ownedContainer(value));
});
test('cleanup failure preserves setup error and is never success', () => {
    const first = Error('setup'), last = Error('remove');
    assert.throws(() => withTlsFixture({create: () => id, prepare: () => {throw first;}, remove: () => {throw last;}}),
        error => error instanceof AggregateError && error.errors[0] === first && error.errors[1] === last);
});
test('unexpected runner exception is preserved after container removal', () => {
    const failure = Error('runner'); const removed = [];
    assert.throws(() => withTlsFixture({create: () => id, prepare: () => {}, run: () => {throw failure;},
        remove: value => removed.push(value)}), error => error === failure);
    assert.deepEqual(removed, [id]);
});
