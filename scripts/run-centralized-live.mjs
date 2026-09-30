import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomBytes, createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';

// Only a newly created, local disposable database is owned by this runner.
export function withCentralFixture({database, password, review, sql, installAccess, removeAccess, run}) {
    if (!/^dbv_hist_central_[0-9]{8}$/.test(database)
        || !/^Dbv![a-f0-9]{24}9a$/.test(password)) throw Error('Invalid isolated fixture');
    if (review && (!/^dbv_debug_[a-f0-9]{16}$/.test(review.role)
        || !/^Dbv![a-f0-9]{24}9a$/.test(review.password))) throw Error('Invalid review fixture');
    let roleCreated = false;
    let databaseCreated = false;
    let reviewCreated = false;
    let accessAttempted = false;
    let failure;
    let result;
    try {
        if (sql(`SELECT count(*) FROM pg_database WHERE datname='${database}';`).trim() !== '0'
            || sql(`SELECT count(*) FROM pg_roles WHERE rolname='${database}';`).trim() !== '0') {
            throw Error('Fixture already exists; refusing to adopt or delete it');
        }
        sql(`CREATE ROLE ${database} LOGIN PASSWORD '${password}';`);
        roleCreated = true;
        sql(`CREATE DATABASE ${database} OWNER ${database} DBCOMPATIBILITY = 'A';`);
        databaseCreated = true;
        if (review) {
            // Never elevate the ordinary account used by the historical scenarios.
            sql(`CREATE ROLE ${review.role} LOGIN SYSADMIN PASSWORD '${review.password}';`);
            reviewCreated = true;
        }
        accessAttempted = true;
        installAccess();
        result = run();
    } catch (error) { failure = error; }
    finally {
        const errors = [];
        const cleanup = action => { try { action(); } catch (error) { errors.push(error); } };
        if (accessAttempted) cleanup(removeAccess);
        if (databaseCreated) cleanup(() => sql(`DROP DATABASE ${database};`));
        if (reviewCreated) cleanup(() => sql(`DROP ROLE ${review.role};`));
        if (roleCreated) cleanup(() => sql(`DROP ROLE ${database};`));
        if (errors.length) throw new AggregateError([...(failure ? [failure] : []), ...errors],
            `Fixture cleanup incomplete: ${database}`);
    }
    if (failure) throw failure;
    return result;
}

function main() {
    const repo = process.argv[2];
    if (!repo?.startsWith('/') || process.env.GAUSSDB_HISTORY_ALLOW_DDL !== 'YES') {
        throw Error('Absolute repository and explicit GAUSSDB_HISTORY_ALLOW_DDL=YES required');
    }
    for (const key of ['GAUSSDB_HISTORY_CONNECTION', 'GAUSSDB_HISTORY_JDBC']) {
        if (!fs.existsSync(process.env[key] || '')) throw Error(`Missing ${key}`);
    }
    const container = 'gaussdb-507-ha-lab';
    const hba = '/opt/gaussdb/ha-data/gs_hba.conf';
    const database = 'dbv_hist_central_' + new Date().toISOString().slice(0, 10).replaceAll('-', '');
    const password = 'Dbv!' + randomBytes(12).toString('hex') + '9a';
    const review = process.argv.includes('--review') ? {
        role: 'dbv_debug_' + randomBytes(8).toString('hex'),
        password: 'Dbv!' + randomBytes(12).toString('hex') + '9a'
    } : undefined;
    const native = process.argv.includes('--native');
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'dbv-central-live-'));
    fs.chmodSync(temporary, 0o700);
    const properties = path.join(temporary, 'connection.properties');
    const reviewProperties = path.join(temporary, 'review.properties');
    const staging = path.join(temporary, 'hba');
    const docker = (args, input) => {
        const result = spawnSync('docker', args, {input, encoding: 'utf8', timeout: 30000});
        if (result.status !== 0) throw Error('Local fixture command failed; raw output withheld');
        return result.stdout;
    };
    const exec = args => docker(['exec', container, ...args]);
    const sql = input => docker(['exec', '-i', container, 'env',
        'LD_LIBRARY_PATH=/opt/gaussdb/ha-app/lib', '/opt/gaussdb/ha-app/bin/gsql',
        '-p55452', '-d', 'postgres', '-At', '-v', 'ON_ERROR_STOP=1'], input);
    const original = exec(['cat', hba]);
    const ownerMode = exec(['stat', '-c', '%u:%g %a', hba]).trim().split(' ');
    if (!/^\d+:\d+$/.test(ownerMode[0]) || !/^[0-7]{3,4}$/.test(ownerMode[1])) throw Error('Invalid HBA metadata');
    const addition = `\n# isolated acceptance ${database}\nhost ${database} ${database} 172.17.0.1/32 sha256\n`
        + (review ? `host ${database} ${review.role} 172.17.0.1/32 sha256\n` : '');
    const installed = original + addition;
    const hash = value => createHash('sha256').update(value).digest('hex');
    const writeHba = value => {
        fs.writeFileSync(staging, value, {mode: 0o600});
        docker(['cp', staging, `${container}:${hba}`]);
        docker(['exec', '-u', 'root', container, 'chown', ownerMode[0], hba]);
        docker(['exec', '-u', 'root', container, 'chmod', ownerMode[1], hba]);
        exec(['env', 'LD_LIBRARY_PATH=/opt/gaussdb/ha-app/lib',
            '/opt/gaussdb/ha-app/bin/gs_ctl', 'reload', '-D', '/opt/gaussdb/ha-data']);
    };
    fs.writeFileSync(properties,
        `url=jdbc:gaussdb://127.0.0.1:55452/${database}\nuser=${database}\npassword=${password}\ndriverClass=com.huawei.gauss200.jdbc.Driver\n`,
        {mode: 0o600});
    if (review) fs.writeFileSync(reviewProperties,
        `url=jdbc:gaussdb://127.0.0.1:55452/${database}\nuser=${review.role}\npassword=${review.password}\ndriverClass=com.huawei.gauss200.jdbc.Driver\n`,
        {mode: 0o600});
    try {
        process.exitCode = withCentralFixture({database, password, review, sql,
            installAccess() {
                if (exec(['cat', hba]) !== original) throw Error('HBA changed before setup');
                writeHba(installed);
            },
            removeAccess() {
                const current = exec(['cat', hba]);
                if (current !== original && current !== installed) throw Error('Concurrent HBA change; refusing overwrite');
                writeHba(original);
                if (hash(exec(['cat', hba])) !== hash(original)) throw Error('HBA restore mismatch');
            },
            run() {
                const result = spawnSync('node', [new URL('./run-role-access.mjs', import.meta.url).pathname, repo], {
                    stdio: 'inherit', env: {...process.env, GAUSSDB_HISTORY_CENTRAL_CONNECTION: properties,
                        ...(review ? {GAUSSDB_REVIEW_CONNECTION: reviewProperties,
                            GAUSSDB_REVIEW_JDBC: process.env.GAUSSDB_HISTORY_JDBC} : {}),
                        ...(native ? {GAUSSDB_NATIVE_CONNECTION: properties,
                            GAUSSDB_NATIVE_JDBC: process.env.GAUSSDB_HISTORY_JDBC, GAUSSDB_REVIEW_NATIVE: 'true'} : {})}
                });
                return result.status ?? 1;
            }});
        console.log(`Central fixture removed and original HBA restored: ${database}`);
        if (review) console.log(`Independent review role removed: ${review.role}`);
    } finally {
        for (const file of [properties, reviewProperties, staging]) if (fs.existsSync(file)) fs.unlinkSync(file);
        fs.rmdirSync(temporary);
    }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
