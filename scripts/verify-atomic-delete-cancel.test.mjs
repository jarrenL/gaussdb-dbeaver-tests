import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyAtomicDeleteCancel} from './verify-atomic-delete-cancel.mjs';

const evidence = () => ({
    confirmation: '1 Shell 删除多个对象 visible=true enabled=true\n'
        + ' row=[dbv_gui_batch_20260924.batch_first, 表, ]\n'
        + ' row=[dbv_gui_batch_20260924.batch_second, 表, ]\nOK\n',
    waiting: '1 Label 在隔离事务中删除多个对象 visible=true enabled=true\n'
        + '2 ToolItem\n tooltip=取消操作 enabled=true\nOK\n',
    canceled: '0 Shell DBeaver 26.1.5 visible=true enabled=true\n'
        + '5 Shell 发生了问题 visible=true enabled=true\n'
        + '6 Text SQL 错误 [10490] [57014]: Statements canceled visible=true enabled=true\nOK\n'
});

test('accepts a single cancellation report without claiming database verification', () => {
    assert.deepEqual(verifyAtomicDeleteCancel(evidence()), {
        uiCancellationEvidence: 'passed', duplicateErrorDialogs: false,
        databaseLocks: 'not_checked', databaseRollback: 'not_checked'
    });
});

for (const [name, change] of [
    ['duplicate dialogs', e => { e.canceled = e.canceled.replace('\nOK', '\n7 Shell 删除对象 visible=true enabled=true\nOK'); }],
    ['missing error report', e => { e.canceled = e.canceled.replace('5 Shell 发生了问题 visible=true enabled=true\n', ''); }],
    ['generic error instead of cancellation', e => { e.canceled = e.canceled.replace('[57014]', '[2BP01]'); }],
    ['job still waiting', e => { e.canceled = e.canceled.replace('\nOK', '\n7 Label 在隔离事务中删除多个对象 visible=true enabled=true\nOK'); }],
    ['disabled cancellation', e => { e.waiting = e.waiting.replace('取消操作 enabled=true', '取消操作 enabled=false'); }],
    ['wrong table selected', e => { e.confirmation = e.confirmation.replace('batch_second', 'batch_keep'); }],
    ['extra table selected', e => { e.confirmation = e.confirmation.replace('\nOK', '\n row=[dbv_gui_batch_20260924.batch_keep, 表, ]\nOK'); }],
    ['missing job', e => { e.waiting = '\nOK\n'; }],
    ['unresponsive main window', e => { e.canceled = e.canceled.replace('DBeaver 26.1.5 visible=true enabled=true', 'DBeaver 26.1.5 visible=true enabled=false'); }],
    ['failed command', e => { e.waiting = 'FAIL\n' + e.waiting; }],
    ['truncated output', e => { e.canceled = e.canceled.replace(/OK\n$/, ''); }]
]) {
    test(`rejects ${name}`, () => {
        const e = evidence();
        change(e);
        assert.throws(() => verifyAtomicDeleteCancel(e));
    });
}
