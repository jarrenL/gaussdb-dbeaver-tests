import fs from 'node:fs';
import assert from 'node:assert/strict';
function historyRows(path) {
    const lines = fs.readFileSync(path, 'utf8').split('\n');
    const at = lines.findIndex((line, i) => /Text  visible=true enabled=true/.test(line)
        && /Table  visible=true enabled=true/.test(lines[i + 2] ?? ''));
    assert(at >= 0, 'History filter/table missing');
    const result = [];
    for (let i = at + 3; lines[i]?.trim().startsWith('row=['); i++) result.push(lines[i]);
    return result;
}
const [empty, fresh] = process.argv.slice(2);
assert(empty && fresh, 'Usage: verifier after-restart.dump new-session.dump');
assert.equal(historyRows(empty).length, 0);
const rows = historyRows(fresh);
assert.equal(rows.length, 2);
assert(rows.every(row => row.includes('history_restart_20260924_new_session') && row.includes(', 1, 成功,')));
// This verifies an observed limitation, NOT successful persistent history recovery.
console.log(JSON.stringify({newSessionLoggingWorks: true, oldHistoryRestored: false, persistenceAcceptance: 'not_passed'}));
