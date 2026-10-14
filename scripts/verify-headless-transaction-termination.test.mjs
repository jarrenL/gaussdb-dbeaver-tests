import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {verifyHeadlessTransactionTermination} from './verify-headless-transaction-termination.mjs';

const marker = 'dbv_headless_tx_0123456789abcdef0123456789abcdef';
const schema = 'dbv_headless_tx_fedcba9876543210fedcba9876543210';
const pid = '140210765559552';
const labels = [
    'fixture visibility isolates the uncommitted row',
    'target identity is positive and marker-bound',
    'controller matched the exact active target',
    'server acknowledged target termination',
    'target reported a termination SQLSTATE',
    'terminated target connection is invalid',
    'uncommitted target row was rolled back',
    'fresh connection committed a replacement row',
    'isolated schema was cleaned',
];

function fixture() {
    return {
        targetExitCode: 0,
        targetLog: [
            'MODE HEADLESS test=transaction-termination scope=server-jdbc gui=false',
            'PASS ' + labels[0],
            'PASS ' + labels[1],
            `TARGET ${marker} PID=${pid}`,
            `BEFORE targetRows=2 observerRows=1 schema=${schema}`,
            'PASS ' + labels[2],
            `CONTROLLER MATCH marker=${marker} pid=${pid} state=active`,
            'PASS ' + labels[3],
            `TERMINATE ACK=true pid=${pid}`,
            'PASS ' + labels[4],
            'INTERRUPTED SQLSTATE=57P01',
            'PASS ' + labels[5],
            'PASS ' + labels[6],
            'PASS ' + labels[7],
            `CLEANED ${schema}`,
            'PASS ' + labels[8],
            'TOTAL CHECKS 9 PASS 9 FAIL 0',
            'RESULT PASS test=transaction-termination scope=server-jdbc gui=false',
        ].join('\n'),
    };
}

test('accepts one complete headless server/JDBC termination run', () => {
    const result = verifyHeadlessTransactionTermination(fixture());
    assert.deepEqual(result, {
        marker, pid, schema, sqlState: '57P01', scope: 'server-jdbc', gui: false, passed: true,
    });
});

test('fixture binds one PID and rechecks the exact target during failure cleanup', () => {
    const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
    const source = fs.readFileSync(
        path.join(repository, 'integration', 'HeadlessTransactionTerminationTest.java'), 'utf8');
    assert.match(source, /FROM pg_catalog\.pg_stat_activity WHERE pid=\?/);
    assert.match(source, /SELECT pg_catalog\.pg_terminate_backend\(\?\)/);
    assert.match(source, /if \(!matchesExactTarget\(snapshot, targetIdentity, SLEEP_SQL\)\)/);
    assert.doesNotMatch(source, /\bLIKE\b|pg_cancel_backend/i);
});

for (const [name, change] of [
    ['nonzero exit', value => { value.targetExitCode = 124; }],
    ['missing exit', value => { delete value.targetExitCode; }],
    ['target-only partial log', value => { value.targetLog = `TARGET ${marker} PID=${pid}`; }],
    ['GUI coverage claim', value => { value.targetLog += '\nMODE HEADLESS gui=true'; }],
    ['missing mode', value => { value.targetLog = value.targetLog.replace(/^MODE .*\n/m, ''); }],
    ['duplicate mode', value => { value.targetLog += '\nMODE HEADLESS test=transaction-termination scope=server-jdbc gui=false'; }],
    ['conflicting mode', value => { value.targetLog += '\nMODE GUI test=transaction-termination scope=dbeaver-ui gui=false'; }],
    ['wrong controller marker', value => { value.targetLog = value.targetLog.replace(
        `CONTROLLER MATCH marker=${marker}`, `CONTROLLER MATCH marker=${schema}`); }],
    ['wrong controller pid', value => { value.targetLog = value.targetLog.replace(
        `pid=${pid} state=active`, 'pid=42 state=active'); }],
    ['wrong acknowledgement pid', value => { value.targetLog = value.targetLog.replace(
        `TERMINATE ACK=true pid=${pid}`, 'TERMINATE ACK=true pid=42'); }],
    ['false acknowledgement', value => { value.targetLog = value.targetLog.replace(
        'TERMINATE ACK=true', 'TERMINATE ACK=false'); }],
    ['cancel SQLSTATE', value => { value.targetLog = value.targetLog.replace('57P01', '57014'); }],
    ['missing cleanup', value => { value.targetLog = value.targetLog.replace(/^CLEANED .*\n/m, ''); }],
    ['wrong cleanup schema', value => { value.targetLog = value.targetLog.replace(
        `CLEANED ${schema}`, `CLEANED ${marker}`); }],
    ['missing check', value => { value.targetLog = value.targetLog.replace('PASS ' + labels[6] + '\n', ''); }],
    ['duplicate check', value => { value.targetLog += '\nPASS ' + labels[6]; }],
    ['inconsistent summary', value => { value.targetLog = value.targetLog.replace(
        'TOTAL CHECKS 9 PASS 9 FAIL 0', 'TOTAL CHECKS 9 PASS 8 FAIL 1'); }],
    ['failure line', value => { value.targetLog += '\nFAIL stale assertion'; }],
    ['uncaught exception', value => { value.targetLog += '\nException in thread "main" java.lang.AssertionError'; }],
    ['missing result', value => { value.targetLog = value.targetLog.replace(/^RESULT .*$/m, ''); }],
    ['duplicate result', value => { value.targetLog += '\nRESULT PASS test=transaction-termination scope=server-jdbc gui=false'; }],
    ['conflicting result', value => { value.targetLog += '\nRESULT FAIL test=transaction-termination scope=server-jdbc gui=false'; }],
]) {
    test('rejects ' + name, () => {
        const value = fixture();
        change(value);
        assert.throws(() => verifyHeadlessTransactionTermination(value));
    });
}
