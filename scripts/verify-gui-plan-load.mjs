// Verify the synthetic generate_series plan against a post-load SWTBot dump.
// This checks observed UI state, not whether an automation command returned OK.
import fs from 'node:fs';
import assert from 'node:assert/strict';

const [planPath, dumpPath] = process.argv.slice(2);
assert(planPath && dumpPath, 'Usage: node verify-gui-plan-load.mjs saved.dbplan post-load.dump');
const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
const dump = fs.readFileSync(dumpPath, 'utf8');
assert.equal(plan.version, '1');
assert.match(plan.sql, /generate_series\(1, 5\)/);
assert.doesNotMatch(dump, /Shell PostgreSQL 执行计划配置/);
const nodes = [plan.root[0], plan.root[0].child[0], plan.root[0].child[0].child[0]];
assert.deepEqual(nodes.map(n => n.type), ['Sort', 'WindowAgg', 'Function Scan']);
const escape = text => String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
for (const node of nodes) {
    const attrs = Object.assign({}, ...node.attributes);
    assert.equal(attrs['Actual-Rows'], '5');
    const row = dump.match(new RegExp(`TreeItem ${escape(node.type)}\\n((?:(?!TreeItem)[\\s\\S])*?)(?=\\n[^\\n]*TreeItem|$)`));
    assert(row, `Missing node ${node.type}`);
    assert.match(row[1], /column3=5(?:\r?\n|$)/);
    assert.match(row[1], new RegExp(`column4=${escape(attrs['Actual-Total-Time'])}(?:\\r?\\n|$)`));
}
const sort = Object.assign({}, ...nodes[0].attributes);
for (const key of ['Plan-Rows', 'Actual-Rows', 'Actual-Loops', 'Actual-Total-Time', 'Sort-Method']) {
    assert.match(dump, new RegExp(`TreeItem ${escape(key)}\\r?\\n[^\\n]*checked=false\\r?\\n[^\\n]*column1=${escape(sort[key])}(?:\\r?\\n|$)`));
}
console.log('PASS: loaded tree and selected Sort properties match saved plan statistics; no EXPLAIN dialog.');
