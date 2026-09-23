import fs from 'node:fs';
import assert from 'node:assert/strict';
function rows(path) {
    const lines = fs.readFileSync(path, 'utf8').split('\n');
    const at = lines.findIndex((line, i) => /Text  visible=true enabled=true/.test(line)
        && /Table  visible=true enabled=true/.test(lines[i + 2] ?? ''));
    assert(at >= 0, 'History table missing');
    const values = [];
    for (let i = at + 3; lines[i]?.trim().startsWith('row=['); i++) values.push(lines[i]);
    return values;
}
assert.equal(process.argv.length, 7, 'Pass before, deleted, refreshed, cleared, refreshed snapshots');
const [before, deleted, refreshed, cleared, restored] = process.argv.slice(2).map(rows);
assert.equal(before.length, 2);
assert(before.every(row => row.includes('history_restart_20260924_new_session')));
assert.deepEqual(deleted, before.slice(0, 1), 'Only selected second record should disappear');
assert.deepEqual(refreshed, before, 'Observed deletion limitation must be reproducible');
assert.equal(cleared.length, 0);
assert.deepEqual(restored, before);
console.log(JSON.stringify({singleRowRemovedFromView: true, viewCleared: true,
    recordsReturnOnRefresh: true, durableDeletionAcceptance: 'not_passed'}));
