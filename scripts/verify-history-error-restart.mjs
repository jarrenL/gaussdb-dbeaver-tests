import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

function rows(snapshot, tableId) {
  assert.match(String(tableId), /^\d+$/);
  const lines = snapshot.split(/\r?\n/);
  const index = lines.findIndex(line => new RegExp(`^\\s*${tableId} Table .*visible=true`).test(line));
  assert.ok(index >= 0, 'Expected visible history table was not observed');
  const result = [];
  for (let i = index + 1; i < lines.length && /^\s*row=/.test(lines[i]); i++) {
    result.push(lines[i].trim());
  }
  return result;
}

export function verifyHistoryErrorRestart(before, after, beforeTable, afterTable, currentSessionTable) {
  const original = rows(before, beforeTable);
  const restored = rows(after, afterTable);
  assert.equal(original.length, 2, 'Fixture must contain exactly the error and successful queries');
  assert.equal(restored.length, 2, 'Restart must retain both fixture queries without duplicates');
  assert.deepEqual(restored, original, 'Visible history fields changed across restart');
  assert.ok(restored[0].includes('dbv_persistent_error_20260924'));
  assert.ok(restored[0].includes('[12050]') && restored[0].includes('Division by zero.'));
  assert.ok(restored[1].includes('dbv_persistent_history_20260924') && restored[1].includes('成功'));
  assert.ok(restored.every(row => row.includes('distributed_acceptance')));
  assert.equal(rows(after, currentSessionTable).length, 0, 'Previous history leaked into current session');
  return {passed: true, restoredQueries: 2, currentSessionQueries: 0};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [beforeFile, afterFile, beforeTable, afterTable, currentTable] = process.argv.slice(2);
  assert.ok(beforeFile && afterFile && currentTable,
    'Usage: node verify-history-error-restart.mjs before after beforeTable afterTable currentTable');
  console.log(JSON.stringify(verifyHistoryErrorRestart(
    readFileSync(beforeFile, 'utf8'), readFileSync(afterFile, 'utf8'), beforeTable, afterTable, currentTable)));
}
