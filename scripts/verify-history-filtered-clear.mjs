import fs from 'node:fs';
import assert from 'node:assert/strict';

function rows(path, filter) {
    const lines = fs.readFileSync(path, 'utf8').split('\n');
    const at = lines.findIndex((line, i) => line.includes(`Text ${filter} visible=true enabled=true`)
        && /Table  visible=true enabled=true/.test(lines[i + 2] ?? ''));
    assert(at >= 0, 'History table/filter missing');
    const values = [];
    for (let i = at + 3; lines[i]?.trim().startsWith('row=['); i++) values.push(lines[i].trim());
    return values;
}

assert.equal(process.argv.length, 6, 'Pass before, filtered, cleared-and-refreshed, unfiltered snapshots');
const marker = 'history_delete_gui_20260924_';
const before = rows(process.argv[2], '');
const filtered = rows(process.argv[3], marker + 'drop');
const refreshed = rows(process.argv[4], marker + 'drop');
const survivor = rows(process.argv[5], '');
assert.equal(before.length, 2);
assert(before[0].includes(marker + 'drop'));
assert(before[1].includes(marker + 'keep'));
assert(before.every(row => row.includes(', 1, 成功, distributed_acceptance,')));
assert.deepEqual(filtered, before.slice(0, 1));
assert.deepEqual(refreshed, [], 'Deleted filtered history must not return on refresh');
assert.deepEqual(survivor, before.slice(1), 'Hidden history must survive filtered clearing');
console.log(JSON.stringify({filteredClear: 'passed', refreshDoesNotResurrect: 'passed',
    hiddenHistoryPreserved: 'passed', singleSelectionDeletion: 'not_checked', restartPersistence: 'not_checked'}));
