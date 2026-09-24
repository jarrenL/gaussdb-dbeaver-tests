// Dedicated local GaussDB 507 backend contract probe; not a DBeaver GUI test.
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';

if (process.env.GAUSSDB_TABLESPACE_ALLOW_DDL !== 'YES') {
    throw new Error('Set GAUSSDB_TABLESPACE_ALLOW_DDL=YES for the dedicated local test container');
}
const container = 'gaussdb-507-ha-lab';
const id = randomBytes(6).toString('hex');
const name = `dbv_ts_${id}`;
const schema = `dbv_ts_probe_${id}`;
const docker = (...args) => execFileSync('docker', ['exec', container, ...args], {
    encoding: 'utf8', timeout: 30000, stdio: ['ignore', 'pipe', 'pipe']
});
const sql = text => docker('env', 'LD_LIBRARY_PATH=/opt/gaussdb/ha-app/lib',
    '/opt/gaussdb/ha-app/bin/gsql', '-p55452', '-d', 'postgres', '-A', '-t',
    '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose', '-c', text).trim();
const quote = value => `'${value.replaceAll("'", "''")}'`;
const cases = [];
function rejected(text, state) {
    assert.throws(() => sql(text), error => String(error.stderr).includes(`SQLSTATE: ${state}`));
}
const root = docker('mktemp', '-d', '/tmp/dbv_tablespace_XXXXXXXX').trim();
assert.match(root, /^\/tmp\/dbv_tablespace_[A-Za-z0-9]+$/);
const paths = [root + "/O'Brien", root + '/中文 空间', root + '/plain'];
let currentName = name;
try {
    for (const path of paths) docker('mkdir', path);
    assert.equal(sql(`SELECT count(*) FROM pg_tablespace WHERE spcname IN ('${name}','${name}_renamed')`), '0');
    assert.equal(sql(`SELECT count(*) FROM pg_namespace WHERE nspname='${schema}'`), '0');
    rejected(`CREATE TABLESPACE ${name} LOCATION ${quote(paths[0])}`, '42602');
    cases.push('apostrophe path rejected with 42602');
    rejected(`CREATE TABLESPACE ${name} LOCATION ${quote(paths[1])}`, '42P17');
    cases.push('unicode/space path rejected with 42P17');
    assert.equal(sql(`SELECT count(*) FROM pg_tablespace WHERE spcname='${name}'`), '0');
    cases.push('failed creation leaves no catalog entry');
    sql(`CREATE TABLESPACE ${name} OWNER gausscore LOCATION ${quote(paths[2])}`);
    assert.equal(sql(`SELECT pg_tablespace_location(oid) FROM pg_tablespace WHERE spcname='${name}'`), paths[2]);
    cases.push('create and location metadata');
    sql(`CREATE SCHEMA ${schema}`);
    sql(`CREATE TABLE ${schema}.payload(id integer PRIMARY KEY,label varchar(40)) TABLESPACE ${name}`);
    sql(`INSERT INTO ${schema}.payload VALUES (7,'中文 ''值'),(8,NULL)`);
    assert.equal(sql(`SELECT id,coalesce(label,'<NULL>') FROM ${schema}.payload ORDER BY id`), "7|中文 '值\n8|<NULL>");
    cases.push('table data roundtrip including unicode quote and NULL');
    assert.equal(sql(`SELECT t.spcname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_tablespace t ON t.oid=c.reltablespace WHERE n.nspname='${schema}' AND c.relname='payload'`), name);
    cases.push('table tablespace association');
    rejected(`DROP TABLESPACE ${name}`, '55000');
    assert.equal(sql(`SELECT count(*) FROM ${schema}.payload`), '2');
    cases.push('nonempty drop rejected without data loss');
    sql(`ALTER TABLESPACE ${name} RENAME TO ${name}_renamed`);
    currentName = `${name}_renamed`;
    assert.equal(sql(`SELECT count(*) FROM pg_tablespace WHERE spcname='${currentName}'`), '1');
    assert.equal(sql(`SELECT count(*) FROM ${schema}.payload`), '2');
    cases.push('rename preserves stored data');
} finally {
    // Exact random fixtures only; never recursively remove server directories.
    sql(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    sql(`DROP TABLESPACE IF EXISTS ${currentName}`);
    assert.equal(sql(`SELECT count(*) FROM pg_tablespace WHERE spcname IN ('${name}','${name}_renamed')`), '0');
    assert.equal(sql(`SELECT count(*) FROM pg_namespace WHERE nspname='${schema}'`), '0');
    for (const path of paths) docker('rmdir', path);
    docker('rmdir', root);
}
cases.push('drop and exact fixture cleanup');
console.log(JSON.stringify({layer: 'GaussDB 507 gsql backend contract', passed: cases.length, cases}, null, 2));
