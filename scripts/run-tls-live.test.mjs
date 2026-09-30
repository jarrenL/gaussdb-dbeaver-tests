import {test} from 'node:test';
import assert from 'node:assert/strict';
import {withTlsFixture, ownedContainer, publishedEndpoint, waitForPublishedEndpoint, cleanupLocal, redactDiagnostic} from './run-tls-live.mjs';
const id = 'a'.repeat(64);
test('allocated runtime port is accepted only with explicit dynamic option', () => {
    const bindings = {'55492/tcp': [{HostIp: '127.0.0.1', HostPort: '64095'}]};
    assert.throws(() => publishedEndpoint(bindings, 55492));
    assert.equal(publishedEndpoint(bindings, 55492, {dynamicPort: true}), '127.0.0.1:64095');
    assert.equal(waitForPublishedEndpoint(() => bindings, 55492, () => assert.fail('no wait'), 1,
        {dynamicPort: true}), '127.0.0.1:64095');
});
test('dynamic ports still reject unsafe or ambiguous runtime publication', () => {
    for (const port of ['', '0', '65536', '-1', '1.5', ' 443', '00443', null, 443]) {
        assert.throws(() => publishedEndpoint({'55492/tcp': [{HostIp: '127.0.0.1', HostPort: port}]},
            55492, {dynamicPort: true}));
    }
    for (const entries of [[], [{HostIp: '0.0.0.0', HostPort: '64095'}],
        [{HostIp: '127.0.0.1', HostPort: '64095'}, {HostIp: '::', HostPort: '64095'}]]) {
        assert.throws(() => publishedEndpoint({'55492/tcp': entries}, 55492, {dynamicPort: true}));
    }
});
test('runtime port publication tolerates absence then checks actual binding', () => {
    let reads = 0, waits = 0;
    assert.equal(waitForPublishedEndpoint(() => ++reads < 3 ? {'55472/tcp': []}
        : {'55472/tcp': [{HostIp: '127.0.0.1', HostPort: '55472'}]}, 55472, () => waits++, 3), '127.0.0.1:55472');
    assert.equal(reads, 3); assert.equal(waits, 2);
});
test('runtime binding wait is bounded and never accepts configured-only ports', () => {
    let waits = 0;
    assert.throws(() => waitForPublishedEndpoint(() => ({}), 55472, () => waits++, 3), /Timed out/);
    assert.equal(waits, 2);
});
test('unexpected runtime interface is never retried into a passing result', () => {
    assert.throws(() => waitForPublishedEndpoint(() => ({'55472/tcp': [{HostIp: '0.0.0.0', HostPort: '55472'}]}),
        55472, () => assert.fail('must not wait')), /unexpected/);
});
test('bare credential values are redacted, not only SQL password lines', () => {
    assert.equal(redactDiagnostic('DETAIL: abc123\nPASSWORD abc123\nretry abc123', ['abc123']),
        'DETAIL: [REDACTED]\nretry [REDACTED]');
});
test('all local cleanup actions run and the primary failure is preserved', () => {
    const primary = Error('original'), first = Error('unlink'), last = Error('directory');
    const actions = [];
    assert.throws(() => cleanupLocal(['/owned/a', '/owned/key'], '/owned', primary, {
        existsSync: () => true,
        unlinkSync(file) { actions.push(file); if (file.endsWith('/a')) throw first; },
        rmdirSync(file) { actions.push(file); throw last; }
    }), error => error instanceof AggregateError && error.errors[0] === primary
        && error.errors[1] === first && error.errors[2] === last);
    assert.deepEqual(actions, ['/owned/a', '/owned/key', '/owned']);
});
test('local cleanup refuses an unowned file before deleting anything', () => {
    assert.throws(() => cleanupLocal(['/other/key'], '/owned', undefined, {
        existsSync: () => assert.fail('unexpected filesystem access')
    }));
});
test('runtime binding must be unique, explicit and loopback-only', () => {
    assert.equal(publishedEndpoint({'55472/tcp': [{HostIp: '127.0.0.1', HostPort: '55472'}]}, 55472), '127.0.0.1:55472');
    for (const entries of [null, [], [{HostIp: '0.0.0.0', HostPort: '55472'}],
        [{HostIp: '127.0.0.1', HostPort: '1'}], [{HostIp: '127.0.0.1', HostPort: '55472'}, {}]]) {
        assert.throws(() => publishedEndpoint({'55472/tcp': entries}, 55472));
    }
});
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
test('a successful suite cannot hide failed container removal', () => {
    const cleanup = Error('remove');
    assert.throws(() => withTlsFixture({create: () => id, prepare: () => {}, run: () => 0,
        remove: () => {throw cleanup;}}), error => error instanceof AggregateError
        && error.errors.length === 1 && error.errors[0] === cleanup);
});
test('local cleanup tolerates a file never created and removes remaining files', () => {
    const actions = [];
    cleanupLocal(['/owned/missing', '/owned/key'], '/owned', undefined, {
        existsSync: file => !file.endsWith('/missing'),
        unlinkSync: file => actions.push(file), rmdirSync: file => actions.push(file)
    });
    assert.deepEqual(actions, ['/owned/key', '/owned']);
});
test('unexpected runner exception is preserved after container removal', () => {
    const failure = Error('runner'); const removed = [];
    assert.throws(() => withTlsFixture({create: () => id, prepare: () => {}, run: () => {throw failure;},
        remove: value => removed.push(value)}), error => error === failure);
    assert.deepEqual(removed, [id]);
});
