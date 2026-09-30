import test from 'node:test';
import assert from 'node:assert/strict';
import {withEmptyCluster} from './run-empty-cluster-live.mjs';
const directory = '/tmp/gauss-review-cluster-Abc123';
function fixture(overrides = {}) {
    const events = [];
    return {events, args: {directory, initialize() { events.push('init'); }, start() { events.push('start'); },
        stop() { events.push('stop'); }, remove() { events.push('remove'); }, run() { events.push('run'); return 0; }, ...overrides}};
}
test('normal and failing runs stop before deletion', () => {
    for (const code of [0, 1]) {
        const f = fixture({run: () => code});
        assert.equal(withEmptyCluster(f.args), code);
        assert.deepEqual(f.events, ['init', 'start', 'stop', 'remove']);
    }
});
test('initialization failure cleans only new files without stopping another server', () => {
    const f = fixture({initialize() { throw Error('init'); }});
    assert.throws(() => withEmptyCluster(f.args), /init/);
    assert.deepEqual(f.events, ['remove']);
});
test('partial startup still requires verified stop', () => {
    const f = fixture({start() { throw Error('start'); }});
    assert.throws(() => withEmptyCluster(f.args), /start/);
    assert.deepEqual(f.events, ['init', 'stop', 'remove']);
});
test('stop failure retains data and preserves original failure', () => {
    const f = fixture({run() { throw Error('run'); }, stop() { throw Error('stop'); }});
    assert.throws(() => withEmptyCluster(f.args), e => e instanceof AggregateError && e.errors.length === 2);
    assert(!f.events.includes('remove'));
});
test('broad or untrusted paths are rejected before effects', () => {
    for (const target of ['/tmp', '/', '/tmp/gauss-review-cluster-x/../other', '/tmp/gauss-review-cluster-']) {
        const f = fixture({directory: target});
        assert.throws(() => withEmptyCluster(f.args), /Unsafe/);
        assert.equal(f.events.length, 0);
    }
});
