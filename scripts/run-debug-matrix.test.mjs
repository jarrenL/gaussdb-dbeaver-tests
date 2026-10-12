import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {analyzeDebugCapability, REQUIRED_DEBUG_SIGNATURES, runCapabilityMatrix} from './run-debug-matrix.mjs';

function signatures(overrides = {}) {
    const rows = Object.entries(REQUIRED_DEBUG_SIGNATURES).map(([name, accepted]) => ({
        name, arguments: accepted[0], executable: true,
    }));
    for (const [name, change] of Object.entries(overrides)) {
        const index = rows.findIndex(item => item.name === name);
        if (change === null) rows.splice(index, 1);
        else rows[index] = {...rows[index], ...change};
    }
    return rows;
}

function probe(overrides = {}) {
    return {driverClass: 'com.vendor.gaussdb.Driver', driverVersion: '9.1.4',
        serverVersion: 'GaussDB Kernel 9.1.0 build 42', compatibility: 'A',
        apiSignatures: signatures(), ...overrides};
}

function entry(id = 'native-a') {
    return {id, connection: `/private/${id}.properties`, jdbc: `/private/${id}.jar`, expect: {
        driverClass: 'com.vendor.gaussdb.Driver', driverVersionPattern: '^9\\.1\\.',
        serverVersionPattern: '^GaussDB Kernel 9\\.1\\.', compatibility: 'A', debugSupported: true,
    }};
}

test('exact current debugger signatures produce a supported capability cell', () => {
    const result = analyzeDebugCapability(probe());
    assert.equal(result.debugSupported, true);
    assert.equal(result.breakpointArgumentType, 'oid');
    assert.deepEqual(result.missingSignatures, []);
    assert.deepEqual(result.deniedSignatures, []);
    assert.match(result.signatureFingerprint, /^[a-f0-9]{64}$/);
});

test('documented text breakpoint overload is a distinct supported signature', () => {
    const result = analyzeDebugCapability(probe({apiSignatures: signatures({
        add_breakpoint: {arguments: '  25   23 '},
    })}));
    assert.equal(result.debugSupported, true);
    assert.equal(result.breakpointArgumentType, 'text');
});

test('missing and non-executable API signatures fail closed', () => {
    const missing = analyzeDebugCapability(probe({apiSignatures: signatures({step: null})}));
    assert.equal(missing.debugSupported, false);
    assert.deepEqual(missing.missingSignatures, ['step']);
    const denied = analyzeDebugCapability(probe({apiSignatures: signatures({abort: {executable: false}})}));
    assert.equal(denied.debugSupported, false);
    assert.deepEqual(denied.deniedSignatures, ['abort']);
});

test('M compatibility remains an explicit negative cell even when API functions exist', () => {
    const result = analyzeDebugCapability(probe({compatibility: 'm'}));
    assert.equal(result.compatibility, 'M');
    assert.equal(result.debugSupported, false);
    assert.deepEqual(result.missingSignatures, []);
});

test('an unknown compatibility value cannot become a supported cell from signatures alone', () => {
    const result = analyzeDebugCapability(probe({compatibility: 'future-mode'}));
    assert.equal(result.compatibilityRecognized, false);
    assert.equal(result.debugSupported, false);
});

test('signature fingerprint is stable across catalog row order', () => {
    const forward = analyzeDebugCapability(probe());
    const reverse = analyzeDebugCapability(probe({apiSignatures: signatures().reverse()}));
    assert.equal(forward.signatureFingerprint, reverse.signatureFingerprint);
});

test('matrix probes and runs every declared actual capability cell sequentially', async () => {
    const entries = [entry('native-a'), {...entry('postgres-pg'), expect: {...entry().expect,
        driverClass: 'org.postgresql.Driver', driverVersionPattern: '^42\\.7\\.', compatibility: 'PG'}}];
    const events = [];
    const summary = await runCapabilityMatrix(entries, {
        probe: async item => {
            events.push(`probe:${item.id}`);
            return item.id === 'native-a' ? probe() : probe({driverClass: 'org.postgresql.Driver',
                driverVersion: '42.7.3', serverVersion: 'GaussDB Kernel 9.1.0 build 43', compatibility: 'PG'});
        },
        run: async (item, capability) => { events.push(`run:${item.id}:${capability.compatibility}`); return 0; },
    });
    assert.equal(summary.cells, 2);
    assert.deepEqual(events, ['probe:native-a', 'run:native-a:A', 'probe:postgres-pg', 'run:postgres-pg:PG']);
});

test('negative cells still execute their regression command after expectations match', async () => {
    const negative = entry('native-m');
    negative.expect.compatibility = 'M';
    negative.expect.debugSupported = false;
    let runs = 0;
    const summary = await runCapabilityMatrix([negative], {
        probe: async () => probe({compatibility: 'M'}),
        run: async () => { runs++; return 0; },
    });
    assert.equal(summary.results[0].debugSupported, false);
    assert.equal(runs, 1);
});

test('driver, version, compatibility and support drift stop before test execution', async () => {
    for (const changed of [
        {driverClass: 'other.Driver'},
        {driverVersion: '10.0.0'},
        {serverVersion: 'Unexpected server'},
        {compatibility: 'PG'},
        {apiSignatures: signatures({continue: null})},
    ]) {
        let ran = false;
        await assert.rejects(() => runCapabilityMatrix([entry()], {
            probe: async () => probe(changed), run: async () => { ran = true; return 0; },
        }));
        assert.equal(ran, false);
    }
});

test('optional signature fingerprints pin an exact server debugger contract', async () => {
    const actual = analyzeDebugCapability(probe());
    const pinned = entry('pinned');
    pinned.expect.signatureFingerprint = actual.signatureFingerprint;
    await runCapabilityMatrix([pinned], {probe: async () => probe()});
    pinned.expect.signatureFingerprint = '0'.repeat(64);
    await assert.rejects(() => runCapabilityMatrix([pinned], {probe: async () => probe()}), /fingerprint changed/);
});

test('duplicate actual cells and duplicate ids are rejected', async () => {
    const first = entry('one'), second = entry('two');
    await assert.rejects(() => runCapabilityMatrix([first, second], {probe: async () => probe()}), /duplicates.*cell/);
    await assert.rejects(() => runCapabilityMatrix([first, {...second, id: first.id}], {probe: async () => probe()}),
        /Duplicate matrix entry id/);
});

test('a nonzero regression result fails the matrix', async () => {
    await assert.rejects(() => runCapabilityMatrix([entry()], {
        probe: async () => probe(), run: async () => 7,
    }), /status 7/);
});

test('invalid matrix declarations and malformed probes fail closed', async () => {
    await assert.rejects(() => runCapabilityMatrix([], {probe: async () => probe()}), /contain entries/);
    const invalid = entry('invalid');
    invalid.expect.serverVersionPattern = '[';
    await assert.rejects(() => runCapabilityMatrix([invalid], {probe: async () => probe()}), /Invalid/);
    assert.throws(() => analyzeDebugCapability({...probe(), apiSignatures: null}), /Missing debugger API/);
});

test('all property-file fixtures require an explicit driver class with no legacy fallback', () => {
    const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
    const files = ['GuiDebugTerminationFixture.java', 'GuiDebugTerminationFixtureTest.java',
        'GuiSessionTarget.java', 'GuiTransactionTarget.java'];
    for (const file of files) {
        const source = fs.readFileSync(path.join(repository, 'integration', file), 'utf8');
        assert.match(source, /required\([^\n]*"driverClass"\)/);
        assert.doesNotMatch(source, /getProperty\("driverClass",/);
        assert.doesNotMatch(source, /gauss200\.jdbc\.Driver/);
    }
});
