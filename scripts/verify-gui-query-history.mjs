import fs from 'node:fs';
import assert from 'node:assert/strict';

// Read only the table following the observed query-manager filter control.
// Other panels also contain history rows and must not satisfy these assertions.
function rows(path, filter) {
    const text = fs.readFileSync(path, 'utf8');
    const lines = text.split('\n');
    const at = lines.findIndex((line, index) => line.includes(`Text ${filter} visible=true enabled=true`)
        && lines[index + 2]?.includes('Table '));
    assert(at >= 0, 'Query-manager filter/table not found');
    const result = [];
    for (let i = at + 3; i < lines.length && lines[i].trim().startsWith('row=['); i++) {
        result.push(lines[i]);
    }
    return result;
}
const [allFile, filteredFile, restoredFile, openedFile, replayedFile] = process.argv.slice(2);
assert(allFile && filteredFile && restoredFile, 'Usage: verifier all.dump filtered.dump restored.dump');
const all = rows(allFile, '');
const filtered = rows(filteredFile, 'history_gui_20260924_error');
const restored = rows(restoredFile, '');
function checkBoth(values) {
    assert(values.some(r => r.includes('history_gui_20260924_success') && r.includes(', 1, 成功,')));
    assert(values.some(r => r.includes('history_gui_20260924_error') && r.includes('Division by zero')));
}
checkBoth(all);
assert.equal(filtered.length, 1);
assert(filtered[0].includes('history_gui_20260924_error') && filtered[0].includes('Division by zero'));
checkBoth(restored);
assert.deepEqual(restored, all, 'Clearing filter must restore the same records');
let guiReplayVerified = false;
if (openedFile || replayedFile) {
    assert(openedFile && replayedFile, 'Both open and replay snapshots are required');
    const openedText = fs.readFileSync(openedFile, 'utf8');
    assert(openedText.includes('CTabItem <distributed_acceptance> QueryManager'));
    assert(openedText.includes("StyledText SELECT 'history_gui_20260924_success' AS marker, 7 AS expected;\\n visible=true"));
    assert.deepEqual(rows(openedFile, ''), restored, 'Opening a console must not add execution records');
    const replayed = rows(replayedFile, '');
    assert.equal(replayed.length, restored.length + 1);
    assert(replayed[0].includes('history_gui_20260924_success') && replayed[0].includes(', 1, 成功,'));
    assert(replayed[0].includes('SQLEditor <QueryManager>'));
    assert.deepEqual(replayed.slice(1), restored);
    guiReplayVerified = true;
}
console.log(JSON.stringify({successAndFailureVisible: true, filteredRows: filtered.length,
    restoredRows: restored.length, filterRestorationVerified: true, guiReplayVerified}));
