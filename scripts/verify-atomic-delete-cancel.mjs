import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

function successfulSnapshot(value, name) {
    assert(!/^FAIL$/m.test(value), `${name}: UI command failed`);
    assert(/\nOK\s*$/.test(value), `${name}: incomplete UI snapshot`);
}

/** UI-only evidence. A caller must separately verify locks, transaction outcome and rows. */
export function verifyAtomicDeleteCancel({confirmation, waiting, canceled}) {
    for (const [name, value] of Object.entries({confirmation, waiting, canceled})) {
        successfulSnapshot(value, name);
    }
    const targets = [...confirmation.matchAll(/^\s*row=\[(dbv_gui_batch_20260924\.[^,]+), 表, \]$/gm)]
        .map(match => match[1]).sort();
    assert.deepEqual(targets, ['dbv_gui_batch_20260924.batch_first', 'dbv_gui_batch_20260924.batch_second'],
        'Confirmation must contain exactly the two intended tables');
    assert(/Label 在隔离事务中删除多个对象 visible=true enabled=true/.test(waiting), 'Active atomic job missing');
    assert(/tooltip=取消操作 enabled=true/.test(waiting), 'Job cancellation is unavailable');
    assert(/\[57014\]/.test(canceled), 'Server cancellation SQLSTATE missing');
    assert(!/Label 在隔离事务中删除多个对象 visible=true enabled=true/.test(canceled), 'Atomic job is still active');
    const shells = [...canceled.matchAll(/^\d+ Shell (.*?) visible=true enabled=true$/gm)].map(match => match[1]);
    const errors = shells.filter(name => name === '删除对象' || name === '发生了问题');
    assert.equal(errors.length, 1, 'Cancellation must have one error report, not duplicate dialogs');
    assert(shells.some(name => name.startsWith('DBeaver ')), 'Main client is not responsive');
    return {uiCancellationEvidence: 'passed', duplicateErrorDialogs: false,
        databaseLocks: 'not_checked', databaseRollback: 'not_checked'};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    assert.equal(process.argv.length, 5, 'Pass confirmation, waiting and canceled SWTBot snapshots');
    const [confirmation, waiting, canceled] = process.argv.slice(2).map(path => readFileSync(path, 'utf8'));
    console.log(JSON.stringify(verifyAtomicDeleteCancel({confirmation, waiting, canceled})));
}
