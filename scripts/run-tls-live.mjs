import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';

export function ownedContainer(id) {
    if (!/^[a-f0-9]{64}$/.test(id)) throw Error('Invalid owned container identity');
    return id;
}

export function withTlsFixture({create, prepare, run, remove}) {
    let id;
    let failure;
    let result;
    try {
        id = ownedContainer(create().trim());
        prepare(id);
        result = run();
    } catch (error) { failure = error; }
    finally {
        if (id) {
            try { remove(id); }
            catch (cleanup) { throw new AggregateError([...(failure ? [failure] : []), cleanup], `TLS fixture cleanup incomplete: ${id}`); }
        }
    }
    if (failure) throw failure;
    return result;
}

function main() {
    const repo = process.argv[2];
    if (!repo?.startsWith('/') || process.env.GAUSSDB_HISTORY_ALLOW_DDL !== 'YES') throw Error('Explicit isolated test consent required');
    const local = fs.mkdtempSync(path.join(os.tmpdir(), 'dbv-tls-'));
    fs.chmodSync(local, 0o700);
    const command = (binary, args, input, timeout = 30000) => {
        const r = spawnSync(binary, args, {input, encoding: 'utf8', timeout});
        const operation = args.find(value => value.startsWith('/opt/gaussdb/ha-app/bin/')) || binary;
        if (r.status !== 0) {
            const diagnostic = (r.stdout + '\n' + r.stderr).split('\n')
                .filter(line => !/password|secret/i.test(line))
                .slice(-4).join('\n');
            throw Error(`TLS fixture command failed (${path.basename(operation)} ${binary === 'docker' ? args[0] : ''}, exit ${r.status}): ${diagnostic}`);
        }
        return r.stdout.trim();
    };
    const docker = (args, input, timeout) => command('docker', args, input, timeout);
    const files = [];
    const write = (name, contents) => {
        const file = path.join(local, name);
        files.push(file);
        fs.writeFileSync(file, contents, {mode: 0o600});
        return file;
    };
    const certificates = {};
    try {
        for (const [name, san] of [['trusted', 'IP:127.0.0.1'], ['wrong', 'DNS:wrong.invalid'], ['unrelated', 'IP:127.0.0.1']]) {
            const cfg = write(name + '.cnf', `[req]\nprompt=no\ndistinguished_name=dn\nx509_extensions=ext\n[dn]\nCN=${name === 'wrong' ? 'wrong.invalid' : '127.0.0.1'}\n[ext]\nbasicConstraints=critical,CA:TRUE\nkeyUsage=critical,digitalSignature,keyEncipherment,keyCertSign\nsubjectAltName=${san}\n`);
            const key = path.join(local, name + '.key'), cert = path.join(local, name + '.crt');
            files.push(key, cert);
            command('openssl', ['req', '-new', '-x509', '-nodes', '-newkey', 'rsa:2048', '-days', '2', '-sha256',
                '-config', cfg, '-keyout', key, '-out', cert]);
            fs.chmodSync(key, 0o600); fs.chmodSync(cert, 0o600);
            certificates[name] = {key, cert};
        }
        const password = 'Dbv!' + randomBytes(12).toString('hex') + '9a';
        const secret = write('password', password + '\n');
        const configs = {};
        process.exitCode = withTlsFixture({
            create: () => docker(['create', '--label', 'dbeaver.acceptance=tls-disposable',
                '-p', '127.0.0.1:55472:55472', '-p', '127.0.0.1:55482:55482',
                '--entrypoint', 'sleep', 'gaussdb507-arm64:507.0.0', 'infinity']),
            prepare(id) {
                docker(['start', id]);
                // Copy only the verified centralized executables; never copy source database files.
                command('bash', ['-o', 'pipefail', '-c',
                    'docker exec gaussdb-507-ha-lab tar -C /opt/gaussdb -cf - ha-app | docker exec -i "$1" tar -C /opt/gaussdb -xf -',
                    'tls-binary-copy', ownedContainer(id)], undefined, 60000);
                const tool = (name, args, input, timeout) => docker(['exec', '-i', '-u', 'gausscore', id, 'env',
                    'GAUSSHOME=/opt/gaussdb/ha-app', 'LD_LIBRARY_PATH=/opt/gaussdb/ha-app/lib',
                    '/opt/gaussdb/ha-app/bin/' + name, ...args], input, timeout);
                docker(['exec', id, 'mkdir', '-m', '700', '/tmp/tls-acceptance']);
                docker(['exec', id, 'chown', 'gausscore:dbgrp', '/tmp/tls-acceptance']);
                docker(['cp', secret, id + ':/tmp/tls-acceptance/password']);
                docker(['exec', id, 'chown', 'gausscore:dbgrp', '/tmp/tls-acceptance/password']);
                // GaussDB also reserves adjacent internal ports; leave a gap between instances.
                for (const [name, port] of [['trusted', 55472], ['wrong', 55482]]) {
                    const directory = '/tmp/tls-acceptance/' + name;
                    tool('gs_initdb', ['-D', directory, '--nodename=tls_' + name, '-U', 'gausscore',
                        '--auth-local=trust', '--auth-host=sha256', '--locale=C', '-E', 'UTF8',
                        '--pwfile=/tmp/tls-acceptance/password'], undefined, 60000);
                    for (const [suffix, file] of [['crt', certificates[name].cert], ['key', certificates[name].key]]) {
                        docker(['cp', file, `${id}:${directory}/server.${suffix}`]);
                        docker(['exec', id, 'chown', 'gausscore:dbgrp', `${directory}/server.${suffix}`]);
                        docker(['exec', id, 'chmod', '600', `${directory}/server.${suffix}`]);
                    }
                    for (const setting of [`port=${port}`, "listen_addresses='*'", 'ssl=on', 'shared_buffers=32MB',
                        'max_connections=30', 'enable_thread_pool=off']) tool('gs_guc', ['set', '-D', directory, '-c', setting]);
                    tool('gs_guc', ['set', '-D', directory, '-h', 'hostssl tls_acceptance tls_client 0.0.0.0/0 sha256']);
                    try {
                        tool('gs_ctl', ['start', '-D', directory, '-l', directory + '/server.log', '-w', '-t', '30'], undefined, 45000);
                    } catch (failure) {
                        try {
                            const log = docker(['exec', id, 'tail', '-40', directory + '/server.log']);
                            console.error(log.split('\n').filter(line => /FATAL|ERROR|could not/i.test(line) && !/password|secret/i.test(line)).join('\n'));
                        } catch (diagnosticFailure) {
                            console.error('Server log unavailable; preserving original startup failure');
                        }
                        throw failure;
                    }
                    tool('gsql', ['-p', String(port), '-d', 'postgres', '-At', '-v', 'ON_ERROR_STOP=1'],
                        `CREATE ROLE tls_client LOGIN PASSWORD '${password}';\nCREATE DATABASE tls_acceptance OWNER tls_client DBCOMPATIBILITY='A';\n`);
                    const published = docker(['port', id, String(port) + '/tcp']);
                    if (!/^127\.0\.0\.1:\d+$/.test(published)) throw Error('Unexpected non-loopback TLS binding');
                    configs[name] = write(name + '.properties', `url=jdbc:gaussdb://${published}/tls_acceptance\nuser=tls_client\npassword=${password}\ndriverClass=com.huawei.gauss200.jdbc.Driver\n`);
                }
            },
            run() {
                const r = spawnSync('node', [new URL('./run-empty-cluster-live.mjs', import.meta.url).pathname, repo], {
                    stdio: 'inherit', env: {...process.env,
                        GAUSSDB_HISTORY_TLS_CONNECTION: configs.trusted,
                        GAUSSDB_HISTORY_TLS_WRONG_HOST_CONNECTION: configs.wrong,
                        GAUSSDB_HISTORY_TLS_CA: certificates.trusted.cert,
                        GAUSSDB_HISTORY_TLS_WRONG_HOST_CA: certificates.wrong.cert,
                        GAUSSDB_HISTORY_TLS_UNRELATED_CA: certificates.unrelated.cert}
                });
                return r.status ?? 1;
            },
            remove: id => { docker(['rm', '-f', ownedContainer(id)]); console.log('Owned disposable TLS container removed: ' + id); }
        });
    } finally {
        for (const file of files) if (fs.existsSync(file)) fs.unlinkSync(file);
        fs.rmdirSync(local);
    }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
