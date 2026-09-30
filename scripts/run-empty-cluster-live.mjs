import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';

export function withEmptyCluster({directory, initialize, start, stop, remove, run}) {
    if (!/^\/tmp\/gauss-review-cluster-[A-Za-z0-9]+$/.test(directory)) throw Error('Unsafe disposable directory');
    let startAttempted = false;
    let failure;
    let result;
    try {
        initialize();
        startAttempted = true;
        start();
        result = run();
    } catch (error) { failure = error; }
    finally {
        // Never remove a data directory if stopping its possible server fails.
        try {
            if (startAttempted) stop();
            remove();
        } catch (cleanup) {
            throw new AggregateError([...(failure ? [failure] : []), cleanup], `Cleanup not confirmed; inspect fixture: ${directory}`);
        }
    }
    if (failure) throw failure;
    return result;
}

function main() {
    const repo = process.argv[2];
    if (!repo?.startsWith('/') || process.env.GAUSSDB_HISTORY_ALLOW_DDL !== 'YES') throw Error('Explicit isolated test consent required');
    const container = 'gaussdb-507-ha-lab';
    const command = (args, input, timeout = 30000) => {
        const r = spawnSync('docker', args, {input, encoding: 'utf8', timeout});
        if (r.status !== 0) {
            const operation = args.find(value => value.startsWith('/opt/gaussdb/ha-app/bin/')) || args[0];
            throw Error(`Disposable cluster command failed (${path.basename(operation)}, exit ${r.status}); raw output withheld`);
        }
        return r.stdout;
    };
    const tool = (name, args, input, timeout) => command(['exec', '-i', container, 'env',
        'GAUSSHOME=/opt/gaussdb/ha-app', 'LD_LIBRARY_PATH=/opt/gaussdb/ha-app/lib',
        '/opt/gaussdb/ha-app/bin/' + name, ...args], input, timeout);
    // Refuse to use an existing listener on the dedicated native-test port.
    const listening = command(['exec', container, 'cat', '/proc/net/tcp', '/proc/net/tcp6']);
    if (listening.split('\n').some(line => /:D8A6\s/.test(line) && /\s0A\s/.test(line))) throw Error('Port 55462 already occupied');
    const directory = command(['exec', container, 'mktemp', '-d', '/tmp/gauss-review-cluster-XXXXXXXX']).trim();
    if (!/^\/tmp\/gauss-review-cluster-[A-Za-z0-9]+$/.test(directory)) throw Error('Unexpected allocated directory');
    const local = fs.mkdtempSync(path.join(os.tmpdir(), 'dbv-empty-cluster-'));
    fs.chmodSync(local, 0o700);
    const secret = path.join(local, 'password');
    const config = path.join(local, 'connection.properties');
    const password = 'Dbv!' + randomBytes(12).toString('hex') + '9a';
    fs.writeFileSync(secret, password + '\n', {mode: 0o600});
    fs.writeFileSync(config, 'password=' + password + '\n', {mode: 0o600});
    try {
        process.exitCode = withEmptyCluster({directory,
            initialize() {
                command(['cp', secret, `${container}:${directory}/password`]);
                command(['exec', '-u', 'root', container, 'chown', 'gausscore:dbgrp', directory + '/password']);
                tool('gs_initdb', ['-D', directory + '/data', '--nodename=review_native', '-U', 'gausscore',
                    '--auth-local=trust', '--auth-host=sha256', '--locale=C', '-E', 'UTF8', '--pwfile=' + directory + '/password'], undefined, 60000);
                command(['exec', container, 'rm', '--', directory + '/password']);
                for (const setting of ['port=55462', "listen_addresses='127.0.0.1'", 'shared_buffers=32MB',
                    'max_connections=30', 'enable_thread_pool=off']) {
                    tool('gs_guc', ['set', '-D', directory + '/data', '-c', setting]);
                }
            },
            start() {
                tool('gs_ctl', ['start', '-D', directory + '/data', '-l', directory + '/server.log', '-w', '-t', '30'], undefined, 45000);
                tool('gsql', ['-p55462', '-d', 'postgres', '-At', '-v', 'ON_ERROR_STOP=1'],
                    `CREATE ROLE synthetic_dump_role PASSWORD '${password}';\nCREATE TABLE review_dump_lock(id integer);\nINSERT INTO review_dump_lock VALUES(1);\n`);
            },
            stop() {
                const r = spawnSync('docker', ['exec', container, 'env', 'LD_LIBRARY_PATH=/opt/gaussdb/ha-app/lib',
                    '/opt/gaussdb/ha-app/bin/gs_ctl', 'status', '-D', directory + '/data'], {encoding: 'utf8', timeout: 10000});
                if (r.status === 0) tool('gs_ctl', ['stop', '-D', directory + '/data', '-m', 'fast', '-w', '-t', '30'], undefined, 45000);
                else if (r.status !== 3) throw Error('Cannot verify disposable server stopped');
            },
            remove() {
                // A timed-out docker exec can leave its initdb process alive in the container.
                const processes = command(['exec', container, 'ps', '-eo', 'args']);
                if (processes.split('\n').some(line => line.includes(directory))) {
                    throw Error('Owned cluster process still running; retaining its directory');
                }
                command(['exec', container, 'rm', '-rf', '--', directory]);
            },
            run() {
                const r = spawnSync('node', [new URL('./run-centralized-live.mjs', import.meta.url).pathname, repo, '--review', '--native'], {
                    stdio: 'inherit', env: {...process.env, GAUSSDB_REVIEW_EMPTY_CLUSTER: 'true', GAUSSDB_DUMPALL_CONNECTION: config}
                });
                return r.status ?? 1;
            }});
        console.log('Disposable synthetic cluster stopped and removed: ' + directory);
    } finally {
        for (const file of [secret, config]) if (fs.existsSync(file)) fs.unlinkSync(file);
        fs.rmdirSync(local);
    }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
