// Dedicated local GaussDB 507 backend contract probe; not a DBeaver GUI test.
import {execFileSync, spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';

if (process.env.GAUSSDB_TABLESPACE_ALLOW_DDL !== 'YES') {
    throw new Error('Set GAUSSDB_TABLESPACE_ALLOW_DDL=YES for the dedicated local test container');
}
const container = 'gaussdb-507-ha-lab';
const id = randomBytes(6).toString('hex');
const name = `dbv_ts_${id}`;
const schema = `dbv_ts_probe_${id}`;
const role = `dbv_ts_role_${id}`;
const password = `Dbv!${randomBytes(10).toString('hex')}9a`;
const docker = (...args) => execFileSync('docker', ['exec', container, ...args], {
    encoding: 'utf8', timeout: 30000, stdio: ['ignore', 'pipe', 'pipe']
});
const sql = text => {
    const result = spawnSync('docker', ['exec', '-i', container, 'env', 'LD_LIBRARY_PATH=/opt/gaussdb/ha-app/lib',
    '/opt/gaussdb/ha-app/bin/gsql', '-p55452', '-d', 'postgres', '-A', '-t',
    '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose'], {input: text, encoding: 'utf8', timeout: 30000});
    if (result.status !== 0) {
        // Never echo SQL, commands, or stderr containing the generated role secret.
        const state = result.stderr?.match(/SQLSTATE: ([A-Z0-9]{5})/)?.[1] ?? 'unknown';
        throw new Error(`Fixture SQL failed; SQLSTATE: ${state}`);
    }
    return result.stdout.trim().replace(/\ntotal time:.*$/s, '');
};
const quote = value => `'${value.replaceAll("'", "''")}'`;
const cases = [];
function rejected(text, state) {
    assert.throws(() => sql(text), error => error.message.includes(`SQLSTATE: ${state}`));
}
const asRole = text => `SET ROLE ${role} PASSWORD '${password}'; ${text}`;
const root = docker('mktemp', '-d', '/tmp/dbv_tablespace_XXXXXXXX').trim();
assert.match(root, /^\/tmp\/dbv_tablespace_[A-Za-z0-9]+$/);
const paths = [root + "/O'Brien", root + '/中文 空间', root + '/plain', root + '/occupied'];
let currentName = name;
let roleCreated = false;
try {
    for (const path of paths) docker('mkdir', path);
    docker('mkdir', paths[3] + '/sentinel');
    assert.equal(sql(`SELECT count(*) FROM pg_tablespace WHERE spcname IN ('${name}','${name}_renamed')`), '0');
    assert.equal(sql(`SELECT count(*) FROM pg_namespace WHERE nspname='${schema}'`), '0');
    rejected(`CREATE TABLESPACE ${name} LOCATION ${quote(paths[0])}`, '42602');
    cases.push('apostrophe path rejected with 42602');
    rejected(`CREATE TABLESPACE ${name} LOCATION ${quote(paths[1])}`, '42P17');
    cases.push('unicode/space path rejected with 42P17');
    assert.equal(sql(`SELECT count(*) FROM pg_tablespace WHERE spcname='${name}'`), '0');
    cases.push('failed creation leaves no catalog entry');
    sql(`CREATE TABLESPACE ${name} LOCATION ${quote(paths[3])}`);
    assert.equal(sql(`SELECT pg_tablespace_location(oid) FROM pg_tablespace WHERE spcname='${name}'`), paths[3]);
    sql(`DROP TABLESPACE ${name}`);
    docker('test', '-d', paths[3] + '/sentinel');
    cases.push('parent with unrelated subdirectory accepted and sentinel preserved after drop');
    sql(`CREATE ROLE ${role} NOLOGIN PASSWORD '${password}'`);
    roleCreated = true;
    rejected(asRole(`CREATE TABLESPACE ${name} LOCATION ${quote(paths[2])}`), '42501');
    assert.equal(sql(`SELECT count(*) FROM pg_tablespace WHERE spcname='${name}'`), '0');
    cases.push('nonadministrator create denied without catalog residue');
    sql(`CREATE TABLESPACE ${name} OWNER gausscore LOCATION ${quote(paths[2])}`);
    assert.equal(sql(`SELECT pg_tablespace_location(oid) FROM pg_tablespace WHERE spcname='${name}'`), paths[2]);
    cases.push('create and location metadata');
    sql(`CREATE SCHEMA ${schema}`);
    sql(`GRANT USAGE,CREATE ON SCHEMA ${schema} TO ${role}`);
    rejected(asRole(`CREATE TABLE ${schema}.denied(id integer) TABLESPACE ${name}`), '42501');
    assert.equal(sql(`SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='${schema}' AND c.relname='denied'`), '0');
    cases.push('tablespace CREATE privilege required without partial table');
    sql(`GRANT CREATE ON TABLESPACE ${name} TO ${role}`);
    sql(asRole(`CREATE TABLE ${schema}.allowed(id integer) TABLESPACE ${name}`));
    sql(asRole(`INSERT INTO ${schema}.allowed VALUES(42)`));
    assert.equal(sql(`SELECT id FROM ${schema}.allowed`), '42');
    sql(asRole(`DROP TABLE ${schema}.allowed`));
    sql(`REVOKE CREATE ON TABLESPACE ${name} FROM ${role}`);
    rejected(asRole(`CREATE TABLE ${schema}.denied(id integer) TABLESPACE ${name}`), '42501');
    cases.push('grant enables create and revoke prevents subsequent create');
    rejected(asRole(`ALTER TABLESPACE ${name} RENAME TO ${name}_forbidden`), '42501');
    rejected(asRole(`DROP TABLESPACE ${name}`), '42501');
    assert.equal(sql(`SELECT count(*) FROM pg_tablespace WHERE spcname='${name}'`), '1');
    cases.push('nonowner rename and drop denied with original preserved');
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
    if (roleCreated) sql(`DROP ROLE ${role}`);
    assert.equal(sql(`SELECT count(*) FROM pg_tablespace WHERE spcname IN ('${name}','${name}_renamed')`), '0');
    assert.equal(sql(`SELECT count(*) FROM pg_namespace WHERE nspname='${schema}'`), '0');
    assert.equal(sql(`SELECT count(*) FROM pg_roles WHERE rolname='${role}'`), '0');
    docker('rmdir', paths[3] + '/sentinel');
    for (const path of paths) docker('rmdir', path);
    docker('rmdir', root);
}
cases.push('drop and exact fixture cleanup');
console.log(JSON.stringify({layer: 'GaussDB 507 gsql backend contract', passed: cases.length, cases}, null, 2));
