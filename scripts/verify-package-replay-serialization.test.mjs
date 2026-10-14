import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {verifyPackageReplaySerialization} from './verify-package-replay-serialization.mjs';

const packageOid = '1734092';
const lockKey = '-4886319740177508517';
const labels = [
    'initial committed package returns 42',
    'database schema and package identities are available',
    'connection A locked snapshot contains body 42',
    'connection B cannot enter the DBeaver package write section while A holds the lock',
    'connection A replay commits body 42 before the waiting writer',
    'connection B obtains the same lock after A commits',
    'connection B commits replacement body 84 after lock handoff',
    'observer sees connection B value 84 after serialized handoff',
    'both writer connections are reusable after commit',
    'package identity remains stable after serialized writes',
    'authoritative source remains connection B body 84',
    'isolated schema is cleaned with RESTRICT',
];

function fixture() {
    return {
        targetExitCode: 0,
        targetLog: [
            `PASS ${labels[0]}`,
            `PASS ${labels[1]}`,
            `PASS ${labels[2]}`,
            `LOCKED packageOid=${packageOid} key=${lockKey} value=42 isolation=REPEATABLE_READ`,
            `PASS ${labels[3]}`,
            `CONTENDED packageOid=${packageOid} key=${lockKey} secondWriterEntered=false`,
            `PASS ${labels[4]}`,
            `PASS ${labels[5]}`,
            `PASS ${labels[6]}`,
            `HANDOFF packageOid=${packageOid} key=${lockKey} value=84 committed=true`,
            ...labels.slice(7, 11).map(label => `PASS ${label}`),
            `FINAL packageOid=${packageOid} value=84 source=connection-B identityStable=true`,
            'SCOPE cooperativeDBeaverWriters=true externalWriters=false multiCn=false',
            `PASS ${labels[11]}`,
            'CLEANED schema=dbv_pkg_replay_serial',
            'TOTAL CHECKS 12 PASS 12 FAIL 0',
            'RESULT PASS test=package-replay-serialization scope=dbeaver-cooperative-advisory-lock' +
                ' gui=false osgi=false externalWriters=false multiCn=false',
        ].join('\n'),
    };
}

test('accepts one complete cooperative package-lock handoff run', () => {
    assert.deepEqual(verifyPackageReplaySerialization(fixture()), {
        packageOid,
        lockKey,
        finalValue: 84,
        scope: 'dbeaver-cooperative-advisory-lock',
        gui: false,
        osgi: false,
        externalWriters: false,
        multiCn: false,
        passed: true,
    });
});

test('fixture mirrors the production key algorithm and fails closed on lock contention', () => {
    const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
    const source = fs.readFileSync(
        path.join(repository, 'integration', 'PackageReplaySerializationFixture.java'), 'utf8');
    assert.match(source, /Connection\.TRANSACTION_REPEATABLE_READ/);
    assert.match(source, /pg_catalog\.pg_advisory_xact_lock\(\?\)/);
    assert.match(source, /pg_catalog\.pg_try_advisory_xact_lock\(\?\)/);
    assert.match(source, /FNV_OFFSET_BASIS = 0xcbf29ce484222325L/);
    assert.match(source, /FNV_PRIME = 0x100000001b3L/);
    assert.match(source, /hash = mixLong\(hash, bytes\.length\)/);
    assert.match(source, /hash = update\(hash, Long\.toString\(databaseOid\)\)/);
    assert.match(source, /hash = update\(hash, Long\.toString\(schemaOid\)\)/);
    assert.match(source, /checks\.require\(!bEnteredWhileLocked,/);
    assert.match(source, /DROP SCHEMA " \+ SCHEMA \+ " RESTRICT/);
    assert.doesNotMatch(source, /DROP SCHEMA[^;\n]*CASCADE/i);
});

for (const [name, change] of [
    ['nonzero exit', value => { value.targetExitCode = 1; }],
    ['missing exit', value => { delete value.targetExitCode; }],
    ['failure line', value => { value.targetLog += '\nFAIL lock handoff'; }],
    ['uncaught exception', value => { value.targetLog += '\nException in thread "main"'; }],
    ['missing locked marker', value => { value.targetLog = value.targetLog.replace(/^LOCKED.*\n/m, ''); }],
    ['duplicate locked marker', value => { value.targetLog += `\nLOCKED packageOid=${packageOid} key=${lockKey} value=42 isolation=REPEATABLE_READ`; }],
    ['wrong isolation', value => { value.targetLog = value.targetLog.replace('REPEATABLE_READ', 'READ_COMMITTED'); }],
    ['missing contention', value => { value.targetLog = value.targetLog.replace(/^CONTENDED.*\n/m, ''); }],
    ['second writer entered', value => { value.targetLog = value.targetLog.replace('secondWriterEntered=false', 'secondWriterEntered=true'); }],
    ['missing handoff', value => { value.targetLog = value.targetLog.replace(/^HANDOFF.*\n/m, ''); }],
    ['uncommitted update', value => { value.targetLog = value.targetLog.replace('committed=true', 'committed=false'); }],
    ['changed key', value => { value.targetLog = value.targetLog.replace(
        `HANDOFF packageOid=${packageOid} key=${lockKey}`, `HANDOFF packageOid=${packageOid} key=99`); }],
    ['changed OID', value => { value.targetLog = value.targetLog.replace(
        `FINAL packageOid=${packageOid}`, 'FINAL packageOid=1734999'); }],
    ['stale final value', value => { value.targetLog = value.targetLog.replace(
        `FINAL packageOid=${packageOid} value=84`, `FINAL packageOid=${packageOid} value=42`); }],
    ['wrong final source', value => { value.targetLog = value.targetLog.replace('source=connection-B', 'source=connection-A'); }],
    ['identity changed', value => { value.targetLog = value.targetLog.replace('identityStable=true', 'identityStable=false'); }],
    ['missing scope', value => { value.targetLog = value.targetLog.replace(/^SCOPE.*\n/m, ''); }],
    ['external writer overclaim', value => { value.targetLog = value.targetLog.replace('externalWriters=false', 'externalWriters=true'); }],
    ['multi-CN overclaim', value => { value.targetLog = value.targetLog.replace('multiCn=false', 'multiCn=true'); }],
    ['missing cleanup', value => { value.targetLog = value.targetLog.replace(/^CLEANED.*\n/m, ''); }],
    ['wrong cleanup schema', value => { value.targetLog = value.targetLog.replace(
        'CLEANED schema=dbv_pkg_replay_serial', 'CLEANED schema=public'); }],
    ['CASCADE claim', value => { value.targetLog += '\ncleanup used CASCADE'; }],
    ['missing PASS label', value => { value.targetLog = value.targetLog.replace(`PASS ${labels[8]}\n`, ''); }],
    ['duplicate PASS label', value => { value.targetLog += `\nPASS ${labels[8]}`; }],
    ['wrong summary', value => { value.targetLog = value.targetLog.replace(
        'TOTAL CHECKS 12 PASS 12 FAIL 0', 'TOTAL CHECKS 12 PASS 11 FAIL 1'); }],
    ['missing result', value => { value.targetLog = value.targetLog.replace(/^RESULT .*$/m, ''); }],
    ['duplicate result', value => { value.targetLog += '\n' + value.targetLog.match(/^RESULT .*$/m)[0]; }],
    ['GUI scope claim', value => { value.targetLog = value.targetLog.replace('gui=false', 'gui=true'); }],
    ['OSGi scope claim', value => { value.targetLog = value.targetLog.replace('osgi=false', 'osgi=true'); }],
]) {
    test('rejects ' + name, () => {
        const value = fixture();
        change(value);
        assert.throws(() => verifyPackageReplaySerialization(value));
    });
}
