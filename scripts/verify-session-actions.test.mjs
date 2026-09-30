import {test} from 'node:test';
import assert from 'node:assert/strict';
import {verifySessionAction} from './verify-session-actions.mjs';
function fixture(mode = 'cancel') {
    return {mode,
        targetLog: 'TARGET dbv_gui_one PID=281469332076864 USER=lab\nINTERRUPTED SQLSTATE=' + (mode === 'cancel' ? '57014' : '57P01')
            + '\n' + (mode === 'cancel' ? 'PASS cancel: same connection still queries' : 'PASS terminate: old invalid, fresh connection queries'),
        targetSnapshot: '0 Shell DBeaver\n 250 TreeItem 281,469,332,076,864\n column1=lab\n column3=dbv_gui_one\n column4=active\n column6=SELECT pg_sleep(120)\nOK\n',
        confirmation: (mode === 'cancel' ? 'Cancel query of session' : 'Terminate session')
            + ' [281469332076864@distributed_acceptance]? visible=true enabled=true\nButton 是(&Y) visible=true enabled=true\nOK\n',
        refreshed: '0 Shell DBeaver 26.1.5 - Sessions - distributed_acceptance visible=true enabled=true\nOK\n'};
}
test('both actual action contracts can pass without narrowing 64-bit identities', () => {
    for (const mode of ['cancel', 'terminate']) assert.equal(verifySessionAction(fixture(mode)).pid, '281469332076864');
});
for (const [name, change] of [
    ['stale marker', f => { f.targetSnapshot = f.targetSnapshot.replace('dbv_gui_one', 'dbv_gui_old'); }],
    ['wrong PID', f => { f.confirmation = f.confirmation.replace('281469332076864', '123'); }],
    ['wrong user', f => { f.targetSnapshot = f.targetSnapshot.replace('column1=lab', 'column1=other'); }],
    ['idle target', f => { f.targetSnapshot = f.targetSnapshot.replace('active', 'idle'); }],
    ['missing JDBC proof', f => { f.targetLog = f.targetLog.replace('PASS cancel', 'NOT PASSED'); }],
    ['stale final row', f => { f.refreshed += '\ndbv_gui_one\nOK'; }],
    ['error dialog', f => { f.refreshed += '\n20 Shell Error\nOK'; }],
    ['truncated dump', f => { f.confirmation = f.confirmation.replace('OK\n', ''); }],
    ['duplicate target', f => { f.targetLog += '\nTARGET dbv_gui_one PID=281469332076864 USER=lab'; }]
]) test('rejects ' + name, () => { const f = fixture(); change(f); assert.throws(() => verifySessionAction(f)); });
