import fs from 'node:fs';
import assert from 'node:assert/strict';

function rows(path) {
    const lines = fs.readFileSync(path, 'utf8').split('\n');
    const at = lines.findIndex((line, i) => /Text  visible=true enabled=true/.test(line)
        && /Table  visible=true enabled=true/.test(lines[i + 2] ?? ''));
    assert(at >= 0, 'Unfiltered history table missing');
    const values = [];
    for (let i = at + 3; lines[i]?.trim().startsWith('row=['); i++) values.push(lines[i].trim());
    return values;
}
assert.equal(process.argv.length, 6, 'Pass before, deleted, refreshed and new-query snapshots');
const [before, deleted, refreshed, added] = process.argv.slice(2).map(rows);
assert.equal(before.length, 1);
assert(before[0].includes('history_delete_gui_20260924_keep'));
assert.deepEqual(deleted, []);
assert.deepEqual(refreshed, [], 'Deleted query must not return on refresh');
assert.equal(added.length, 1);
assert(added[0].includes('history_delete_gui_20260924_new'));
assert(added[0].includes(', 1, 成功, distributed_acceptance,'));
console.log(JSON.stringify({singleQueryDeletion: 'passed', refreshDoesNotResurrect: 'passed',
    newQueriesStillCollected: 'passed', restartPersistence: 'not_checked'}));
