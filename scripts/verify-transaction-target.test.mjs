import {test} from 'node:test';
import assert from 'node:assert/strict';
import {verifyTransactionTarget} from './verify-transaction-target.mjs';

function fixture() {
    return {
        targetExitCode: 0,
        targetLog: [
            'TARGET dbv_gui_tx_case PID=140210765559552',
            'BEFORE targetRows=2 observerRows=1 schema=dbv_gui_tx_4049c471cbce42db8079d686112b8fc5',
            'INTERRUPTED SQLSTATE=57P01',
            'PASS terminate transaction: baseline kept, uncommitted row absent, fresh write committed',
            'CLEANED dbv_gui_tx_4049c471cbce42db8079d686112b8fc5'
        ].join('\n')
    };
}

test('accepts one complete successful transaction target run', () => {
    const result = verifyTransactionTarget(fixture());
    assert.equal(result.pid, '140210765559552');
    assert.equal(result.passed, true);
});

for (const [name, change] of [
    ['nonzero exit', f => { f.targetExitCode = 1; }],
    ['missing exit', f => { delete f.targetExitCode; }],
    ['partial target-only log', f => { f.targetLog = f.targetLog.split('\n')[0]; }],
    ['missing final result', f => { f.targetLog = f.targetLog.replace(/^PASS .*$/m, ''); }],
    ['duplicate final result', f => { f.targetLog += '\nPASS terminate transaction: baseline kept, uncommitted row absent, fresh write committed'; }],
    ['missing cleanup', f => { f.targetLog = f.targetLog.replace(/^CLEANED .*$/m, ''); }],
    ['wrong cleanup schema', f => { f.targetLog = f.targetLog.replace(/CLEANED .*/, 'CLEANED dbv_gui_tx_other'); }],
    ['cancel state', f => { f.targetLog = f.targetLog.replace('57P01', '57014'); }],
    ['failure line', f => { f.targetLog += '\nFAIL stale assertion'; }],
    ['uncaught exception', f => { f.targetLog += '\nCaused by: java.sql.SQLException'; }],
    ['duplicate identity', f => { f.targetLog += '\nTARGET dbv_gui_tx_case PID=140210765559552'; }]
]) test('rejects ' + name, () => {
    const value = fixture();
    change(value);
    assert.throws(() => verifyTransactionTarget(value));
});
