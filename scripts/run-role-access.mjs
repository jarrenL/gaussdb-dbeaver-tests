import fs from 'node:fs';
import {randomBytes} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';

export function withTemporaryRole({sql, run, role, password, account, group}) {
    for (const value of [role, account, group]) {
        if (!/^[a-z][a-z0-9_]+$/.test(value)) throw new Error('Unsafe fixture identifier');
    }
    if (!/^dbv_hist_grantee_[a-f0-9]+$/.test(role)) throw new Error('Dedicated random role required');
    if (!/^Dbv![a-f0-9]{20}9a$/.test(password)) throw new Error('Generated fixture password required');
    // Do not use IF NOT EXISTS: an existing role must never be adopted or removed.
    sql(`CREATE ROLE ${role} NOLOGIN PASSWORD '${password}';`);
    let member = false;
    let usage = false;
    let result;
    let failure;
    try {
        sql(`GRANT ${role} TO ${account};`);
        member = true;
        sql(`GRANT USAGE ON NODE GROUP ${group} TO ${role};`);
        usage = true;
        result = run(role, password);
    } catch (error) {
        failure = error;
    } finally {
        const errors = [];
        const cleanup = statement => { try { sql(statement); } catch { errors.push('Fixture cleanup failed'); } };
        if (usage) cleanup(`REVOKE USAGE ON NODE GROUP ${group} FROM ${role};`);
        if (member) cleanup(`REVOKE ${role} FROM ${account};`);
        cleanup(`DROP ROLE ${role};`);
        if (errors.length) throw new Error(`Cleanup incomplete for ${role}; inspect the isolated fixture`);
    }
    if (failure) throw failure;
    return result;
}

export function readConnectionAccount(propertiesText) {
    const match = propertiesText.match(/^\s*user\s*[:=]\s*([^\s#!]+)\s*$/m);
    if (!match || !/^[a-z][a-z0-9_]+$/.test(match[1])) {
        throw new Error('A safe explicit user is required in GAUSSDB_HISTORY_CONNECTION');
    }
    return match[1];
}

function main() {
    const repo = process.argv[2];
    if (!repo?.startsWith('/')) throw new Error('Pass the absolute DBeaver repository path');
    if (process.env.GAUSSDB_HISTORY_ALLOW_DDL !== 'YES') throw new Error('Explicit test DDL consent required');
    for (const key of ['GAUSSDB_HISTORY_CONNECTION', 'GAUSSDB_HISTORY_JDBC']) {
        if (!process.env[key]) throw new Error(`${key} is required`);
    }
    const role = `dbv_hist_grantee_${randomBytes(8).toString('hex')}`;
    const password = `Dbv!${randomBytes(10).toString('hex')}9a`;
    const account = readConnectionAccount(fs.readFileSync(process.env.GAUSSDB_HISTORY_CONNECTION, 'utf8'));
    const sql = input => {
        const result = spawnSync('docker', ['exec', '-i', 'gaussdb-507-cn-lab', 'env',
            'LD_LIBRARY_PATH=/opt/gaussdb/app/lib', '/opt/gaussdb/app/bin/gsql',
            '-p55432', '-d', 'distributed_acceptance', '-v', 'ON_ERROR_STOP=1'],
        {input, encoding: 'utf8', timeout: 30000});
        // Do not print raw SQL/error output: it may include the generated password.
        if (result.status !== 0) throw new Error(`Fixture SQL failed for ${role}`);
    };
    const status = withTemporaryRole({sql, role, password, account, group: 'dual_group',
        run: (grantee, secret) => {
            const result = spawnSync('bash', [new URL('./run-dbeaver-tests.sh', import.meta.url).pathname, repo], {
                stdio: 'inherit', env: {...process.env, GAUSSDB_HISTORY_VERIFY_ROLE_ACCESS: 'YES',
                    GAUSSDB_HISTORY_GRANTEE_ROLE: grantee, GAUSSDB_HISTORY_GRANTEE_PASSWORD: secret}
            });
            return result.status ?? 1;
        }});
    console.log(`Temporary role removed: ${role}`);
    process.exitCode = status;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
