import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {createHash, randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';

function requirePrivateRegularFile(file) {
    if (typeof process.getuid !== 'function') {
        throw Error('POSIX owner and 0600 validation is required for centralized review connection files');
    }
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.uid !== process.getuid()
        || stat.nlink !== 1 || (stat.mode & 0o777) !== 0o600) {
        throw Error('Input must be an owner-only 0600 regular file');
    }
}

export function rewriteReviewProperties(source, manifest, prefix) {
    if (!/^review_0917_[a-f0-9]{8}_$/.test(prefix)) throw Error('Invalid review prefix');
    const central = manifest.centralized;
    if (central?.phase !== 'bound') throw Error('Centralized instance is not bound');
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]{15,127}$/.test(central.instance_id ?? '')) {
        throw Error('Centralized instance identity is invalid');
    }
    const manifestEndpoint = central.endpoint;
    if (!manifestEndpoint || typeof manifestEndpoint !== 'object' || Array.isArray(manifestEndpoint)) {
        throw Error('Bound centralized manifest must declare endpoint.host and endpoint.port');
    }
    const manifestHost = normalizeHost(manifestEndpoint.host, 'Centralized manifest endpoint host');
    const manifestPort = normalizePort(manifestEndpoint.port, 'Centralized manifest endpoint port');
    const database = `${prefix}ora`;
    const lines = source.split(/\r?\n/);
    const values = new Map();
    const counts = new Map();
    for (const line of lines) {
        if (line.includes('\0') || /(?<!\\)(?:\\\\)*\\$/.test(line)) {
            throw Error('Multiline or binary Java properties are not supported');
        }
        const match = line.match(/^\s*([^#!\s][^=:\s]*)\s*[=:]\s*(.*)$/);
        if (match) {
            values.set(match[1], match[2]);
            counts.set(match[1], (counts.get(match[1]) ?? 0) + 1);
        }
    }
    const url = values.get('url');
    const host = values.get('host');
    const port = values.get('port');
    const driverClass = values.get('driverClass');
    const sourceDatabase = values.get('database');
    if (!url || !host || !port || !driverClass || !sourceDatabase) {
        throw Error('Source connection is incomplete');
    }
    for (const key of ['url', 'host', 'port', 'driverClass', 'database']) {
        if (counts.get(key) !== 1) throw Error(`Source connection has ambiguous ${key}`);
    }
    if (!url.startsWith('jdbc:gaussdb://')) throw Error('Source URL must use jdbc:gaussdb');
    let parsed;
    try {
        parsed = new URL(url.slice('jdbc:'.length));
    } catch {
        throw Error('Source URL is invalid');
    }
    const credentialKeys = new Set(['user', 'username', 'password', 'passwd', 'sslpassword']);
    const queryContainsCredentials = [...parsed.searchParams.keys()]
        .some(key => credentialKeys.has(key.toLowerCase()));
    if (parsed.protocol !== 'gaussdb:' || !parsed.hostname || parsed.username || parsed.password || parsed.hash
        || queryContainsCredentials) {
        throw Error('Source URL must be an absolute credential-free GaussDB URL');
    }
    if (!/^[1-9]\d{0,4}$/.test(port) || Number(port) > 65535 || parsed.port !== port) {
        throw Error('Source URL port does not match the connection properties');
    }
    const normalizedPropertyHost = normalizeHost(host, 'Source connection host');
    const normalizedUrlHost = normalizeHost(parsed.hostname, 'Source URL host');
    if (normalizedPropertyHost !== normalizedUrlHost) {
        throw Error('Source URL host does not match the connection properties');
    }
    if (!/^[A-Za-z_][A-Za-z0-9_$]{0,62}$/.test(sourceDatabase)
        || parsed.pathname !== `/${sourceDatabase}`) {
        throw Error('Source URL database does not match the connection properties');
    }
    if (!/^[A-Za-z_$][A-Za-z0-9_.$]*$/.test(driverClass)) {
        throw Error('Source driver class is invalid');
    }
    if (manifestHost !== normalizedUrlHost || manifestPort !== port) {
        throw Error('Source connection endpoint does not match the bound centralized instance');
    }
    parsed.pathname = `/${database}`;
    const endpoint = canonicalEndpoint(normalizedUrlHost, port);
    const endpointBinding = createHash('sha256')
        .update(central.instance_id, 'utf8')
        .update('\0', 'utf8')
        .update(endpoint, 'utf8')
        .digest('hex');
    const controlled = new Set([
        'url', 'database', 'instanceId', 'review.databasePrefix', 'review.endpoint',
        'review.endpointBinding', 'review.deployment', 'review.driverClass', 'review.modes'
    ]);
    const preserved = lines.filter(line => {
        const key = line.match(/^\s*([^#!\s][^=:\s]*)\s*[=:]/)?.[1];
        return !key || !controlled.has(key);
    });
    while (preserved.at(-1) === '') preserved.pop();
    preserved.push(
        `url=jdbc:${parsed.toString()}`,
        `database=${database}`,
        `instanceId=${central.instance_id}`,
        `review.databasePrefix=${prefix}`,
        `review.endpoint=${endpoint}`,
        `review.endpointBinding=${endpointBinding}`,
        'review.deployment=centralized',
        `review.driverClass=${driverClass}`,
        'review.modes=ora'
    );
    return `${preserved.join('\n')}\n`;
}

function normalizeHost(value, description) {
    if (typeof value !== 'string') throw Error(`${description} is invalid`);
    const host = value.trim().replace(/^\[|\]$/g, '').toLowerCase();
    if (!host || /[\s/?#@]/.test(host)) throw Error(`${description} is invalid`);
    return host;
}

function normalizePort(value, description) {
    const port = typeof value === 'number' ? String(value) : value;
    if (typeof port !== 'string' || !/^[1-9]\d{0,4}$/.test(port) || Number(port) > 65535) {
        throw Error(`${description} is invalid`);
    }
    return port;
}

function canonicalEndpoint(host, port) {
    return `${host.includes(':') ? `[${host}]` : host}:${port}`;
}

function atomicWritePrivate(file, contents) {
    const parent = path.dirname(file);
    const temporary = path.join(parent, `.${path.basename(file)}.${process.pid}.${randomUUID()}.tmp`);
    const descriptor = fs.openSync(temporary, 'wx', 0o600);
    try {
        fs.writeFileSync(descriptor, contents, {encoding: 'utf8'});
        fs.fsyncSync(descriptor);
        fs.closeSync(descriptor);
        fs.renameSync(temporary, file);
        fs.chmodSync(file, 0o600);
        const directory = fs.openSync(parent, 'r');
        try {
            fs.fsyncSync(directory);
        } finally {
            fs.closeSync(directory);
        }
    } catch (error) {
        try {
            fs.closeSync(descriptor);
        } catch {
            // The descriptor was already closed after the successful write.
        }
        try {
            fs.unlinkSync(temporary);
        } catch {
            // Nothing remains to remove after a successful rename.
        }
        throw error;
    }
}

function main() {
    const [sourceFile, manifestFile, outputFile, prefix] = process.argv.slice(2);
    if (![sourceFile, manifestFile, outputFile].every(value => value?.startsWith('/'))) {
        throw Error('Absolute source, manifest and output paths are required');
    }
    requirePrivateRegularFile(sourceFile);
    requirePrivateRegularFile(manifestFile);
    if (fs.existsSync(outputFile)) requirePrivateRegularFile(outputFile);
    const inputs = new Set([fs.realpathSync(sourceFile), fs.realpathSync(manifestFile)]);
    const normalizedOutput = path.resolve(outputFile);
    const outputIdentity = fs.existsSync(normalizedOutput)
        ? fs.realpathSync(normalizedOutput)
        : path.join(fs.realpathSync(path.dirname(normalizedOutput)), path.basename(normalizedOutput));
    if (inputs.has(outputIdentity)) throw Error('Output must not replace an input file');
    const source = fs.readFileSync(sourceFile, 'utf8');
    const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
    atomicWritePrivate(outputFile, rewriteReviewProperties(source, manifest, prefix));
    console.log('Centralized review connection prepared in an owner-only file');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    try {
        main();
    } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
    }
}
