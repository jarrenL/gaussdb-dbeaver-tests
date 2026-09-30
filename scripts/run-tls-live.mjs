import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';

export function redactDiagnostic(raw, secrets) {
    let text = raw;
    for (const secret of secrets) if (secret) text = text.split(secret).join('[REDACTED]');
    return text.split('\n').filter(line => !/password|secret/i.test(line)).slice(-4).join('\n');
}

export function cleanupLocal(files, directory, primary, io = fs) {
    if (files.some(file => path.dirname(file) !== directory)) throw Error('Local cleanup target is outside owned directory');
    const errors = [];
    for (const file of files) {
        try { if (io.existsSync(file)) io.unlinkSync(file); } catch (error) { errors.push(error); }
    }
    try { io.rmdirSync(directory); } catch (error) { errors.push(error); }
    if (errors.length) throw new AggregateError([...(primary ? [primary] : []), ...errors],
        `Local TLS cleanup incomplete: ${directory}`);
}

export function ownedContainer(id) {
    if (!/^[a-f0-9]{64}$/.test(id)) throw Error('Invalid owned container identity');
    return id;
}

export function publishedEndpoint(bindings, port, {dynamicPort = false} = {}) {
    const entries = bindings?.[String(port) + '/tcp'];
    if (!Array.isArray(entries) || entries.length !== 1
        || entries[0].HostIp !== '127.0.0.1'
        || typeof entries[0].HostPort !== 'string'
        || !/^[1-9][0-9]{0,4}$/.test(entries[0].HostPort)
        || Number(entries[0].HostPort) > 65535
        || (!dynamicPort && entries[0].HostPort !== String(port))) {
        throw Error('Missing or unexpected loopback TLS binding for port ' + port
            + ': ' + JSON.stringify(entries ?? null));
    }
    return '127.0.0.1:' + entries[0].HostPort;
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

export function waitForPublishedEndpoint(read, port, wait, attempts = 30, options = {}) {
    for (let attempt = 0; attempt < attempts; attempt++) {
        const bindings = read();
        const entries = bindings?.[String(port) + '/tcp'];
        // Docker may return empty runtime bindings shortly after start. Only
        // absence is retryable; wrong interfaces/ports remain immediate errors.
        if (Array.isArray(entries) && entries.length > 0) return publishedEndpoint(bindings, port, options);
        if (attempt + 1 < attempts) wait();
    }
    throw Error('Timed out waiting for loopback TLS binding for port ' + port);
}

function main() {
    const repo = process.argv[2];
    const encoding = process.argv.includes('--encoding');
    const expiryOnly = process.argv.includes('--expiry-only');
    if (encoding && expiryOnly) throw Error('Encoding requires the normal trusted endpoint');
    const endpoints = expiryOnly ? [['expired', 55492]]
        : [['trusted', 55472], ['wrong', 55482], ['expired', 55492]];
    if (!repo?.startsWith('/') || process.env.GAUSSDB_HISTORY_ALLOW_DDL !== 'YES') throw Error('Explicit isolated test consent required');
    const local = fs.mkdtempSync(path.join(os.tmpdir(), 'dbv-tls-'));
    fs.chmodSync(local, 0o700);
    const secrets = [];
    const command = (binary, args, input, timeout = 30000) => {
        const r = spawnSync(binary, args, {input, encoding: 'utf8', timeout});
        const operation = args.find(value => value.startsWith('/opt/gaussdb/ha-app/bin/')) || binary;
        if (r.status !== 0) {
            const diagnostic = redactDiagnostic((r.stdout || '') + '\n' + (r.stderr || '')
                + (r.error ? '\n' + r.error.code : ''), secrets);
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
    let primary;
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
        // Expired leaf signed by a CURRENT trusted CA. An expired self-signed
        // trust anchor does not reliably exercise certificate validity checks.
        const expiredKey = path.join(local, 'expired.key');
        const expiredCsr = path.join(local, 'expired.csr');
        const expiredCert = path.join(local, 'expired.crt');
        files.push(expiredKey, expiredCsr, expiredCert);
        const expiredExtensions = write('expired-ext.cnf', '[server]\nbasicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\nsubjectAltName=IP:127.0.0.1\n');
        command('openssl', ['req', '-new', '-nodes', '-newkey', 'rsa:2048', '-subj', '/CN=expired-leaf',
            '-keyout', expiredKey, '-out', expiredCsr]);
        command('openssl', ['x509', '-req', '-in', expiredCsr, '-CA', certificates.trusted.cert,
            '-CAkey', certificates.trusted.key, '-set_serial', '20260930', '-not_before', '20200101000000Z',
            '-not_after', '20200102000000Z', '-extfile', expiredExtensions, '-extensions', 'server', '-out', expiredCert]);
        for (const file of [expiredKey, expiredCsr, expiredCert]) fs.chmodSync(file, 0o600);
        certificates.expired = {key: expiredKey, cert: expiredCert};
        const password = 'Dbv!' + randomBytes(12).toString('hex') + '9a';
        secrets.push(password);
        const secret = write('password', password + '\n');
        const configs = {};
        process.exitCode = withTlsFixture({
            create: () => docker(['create', '--label', 'dbeaver.acceptance=tls-disposable',
                ...endpoints.flatMap(([, port]) => ['-p', `127.0.0.1::${port}`]),
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
                docker(['exec', id, 'chmod', '600', '/tmp/tls-acceptance/password']);
                // GaussDB also reserves adjacent internal ports; leave a gap between instances.
                for (const [name, port] of endpoints) {
                    const directory = '/tmp/tls-acceptance/' + name;
                    tool('gs_initdb', ['-D', directory, '--nodename=tls_' + name, '-U', 'gausscore',
                        '--auth-local=trust', '--auth-host=sha256', '--locale=C', '-E', 'UTF8',
                        '--pwfile=/tmp/tls-acceptance/password'], undefined, 60000);
                    for (const [suffix, file] of [['crt', certificates[name].cert], ['key', certificates[name].key]]) {
                        docker(['cp', file, `${id}:${directory}/server.${suffix}`]);
                        docker(['exec', id, 'chown', 'gausscore:dbgrp', `${directory}/server.${suffix}`]);
                        docker(['exec', id, 'chmod', '600', `${directory}/server.${suffix}`]);
                    }
                    const settings = [`port=${port}`, "listen_addresses='*'", 'ssl=on', 'shared_buffers=32MB',
                        'max_connections=30', 'enable_thread_pool=off'];
                    tool('gs_guc', ['set', '-D', directory, ...settings.flatMap(setting => ['-c', setting])]);
                    const databases = name === 'trusted' && encoding ? 'tls_acceptance,tls_encoding' : 'tls_acceptance';
                    tool('gs_guc', ['set', '-D', directory, '-h', `hostssl ${databases} tls_client 0.0.0.0/0 sha256`]);
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
                    if (name === 'trusted' && encoding) {
                        tool('gsql', ['-p', String(port), '-d', 'postgres', '-At', '-v', 'ON_ERROR_STOP=1'],
                            "CREATE DATABASE tls_encoding OWNER tls_client TEMPLATE template0 ENCODING 'GB18030' LC_COLLATE 'C' LC_CTYPE 'C' DBCOMPATIBILITY='A';\n");
                    }
                    const published = waitForPublishedEndpoint(
                        () => JSON.parse(docker(['inspect', id, '--format', '{{json .NetworkSettings.Ports}}'])), port,
                        () => command('sleep', ['1']), 30, {dynamicPort: true});
                    configs[name] = write(name + '.properties', `url=jdbc:gaussdb://${published}/tls_acceptance\nuser=tls_client\npassword=${password}\ndriverClass=com.huawei.gauss200.jdbc.Driver\nsslmode=verify-full\nsslrootcert=${certificates[name].cert}\n`);
                }
            },
            run() {
                const r = spawnSync('node', [new URL('./run-empty-cluster-live.mjs', import.meta.url).pathname, repo], {
                    stdio: 'inherit', env: {...process.env,
                        GAUSSDB_HISTORY_TLS_CONNECTION: configs.trusted,
                        GAUSSDB_HISTORY_TLS_WRONG_HOST_CONNECTION: configs.wrong,
                        GAUSSDB_HISTORY_TLS_CA: configs.trusted ? certificates.trusted.cert : undefined,
                        GAUSSDB_HISTORY_TLS_WRONG_HOST_CA: configs.wrong ? certificates.wrong.cert : undefined,
                        GAUSSDB_HISTORY_TLS_UNRELATED_CA: configs.trusted ? certificates.unrelated.cert : undefined,
                        GAUSSDB_HISTORY_TLS_EXPIRED_CONNECTION: configs.expired,
                        GAUSSDB_HISTORY_TLS_EXPIRED_CA: certificates.trusted.cert,
                        ...(encoding ? {GAUSSDB_HISTORY_ENCODING_DATABASE: 'tls_encoding',
                            GAUSSDB_HISTORY_ENCODING_CONNECTION: configs.trusted} : {})}
                });
                return r.status ?? 1;
            },
            remove: id => {
                try {
                    console.log('TLS container state (running, OOM, exit): ' + docker(['inspect', id, '--format',
                        '{{.State.Running}} {{.State.OOMKilled}} {{.State.ExitCode}}']));
                } catch (ignored) { console.error('TLS container state unavailable before cleanup'); }
                docker(['rm', '-f', ownedContainer(id)]);
                console.log('Owned disposable TLS container removed: ' + id);
            }
        });
    } catch (failure) {
        primary = failure;
        throw failure;
    } finally {
        cleanupLocal(files, local, primary);
    }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
