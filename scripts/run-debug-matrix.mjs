import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath, pathToFileURL} from 'node:url';

export const REQUIRED_DEBUG_SIGNATURES = Object.freeze({
    turn_on: Object.freeze(['26']),
    turn_off: Object.freeze(['26']),
    attach: Object.freeze(['25 23']),
    continue: Object.freeze(['']),
    step: Object.freeze(['']),
    next: Object.freeze(['']),
    finish: Object.freeze(['']),
    abort: Object.freeze(['']),
    backtrace: Object.freeze(['']),
    info_locals: Object.freeze(['23']),
    info_code: Object.freeze(['26']),
    set_var: Object.freeze(['25 25']),
    add_breakpoint: Object.freeze(['26 23', '25 23']),
    delete_breakpoint: Object.freeze(['23']),
    enable_breakpoint: Object.freeze(['23']),
    disable_breakpoint: Object.freeze(['23']),
    info_breakpoints: Object.freeze(['']),
});
const RECOGNIZED_COMPATIBILITIES = new Set(['A', 'O', 'ORA', 'B', 'MYSQL', 'C', 'TD', 'PG', 'M']);

function reject(condition, message) {
    if (condition) throw new Error(message);
}

function text(value, label) {
    reject(typeof value !== 'string' || value.trim().length === 0, `Missing ${label}`);
    return value.trim();
}

function normalizeArguments(value) {
    return typeof value === 'string' ? value.trim().replaceAll(/\s+/g, ' ') : '';
}

export function analyzeDebugCapability(probe) {
    reject(!probe || typeof probe !== 'object', 'Malformed capability probe');
    const dimension = {
        driverClass: text(probe.driverClass, 'driver class'),
        driverVersion: text(probe.driverVersion, 'driver version'),
        serverVersion: text(probe.serverVersion, 'server version'),
        compatibility: text(probe.compatibility, 'compatibility mode').toUpperCase(),
    };
    reject(!Array.isArray(probe.apiSignatures), 'Missing debugger API signatures');
    const signatures = probe.apiSignatures.map((item, index) => {
        reject(!item || typeof item !== 'object', `Malformed debugger API signature at ${index}`);
        return {name: text(item.name, `signature ${index} name`).toLowerCase(),
            arguments: normalizeArguments(item.arguments), executable: item.executable === true};
    }).sort((a, b) => a.name.localeCompare(b.name) || a.arguments.localeCompare(b.arguments)
        || Number(a.executable) - Number(b.executable));
    const missingSignatures = [];
    const deniedSignatures = [];
    for (const [name, acceptedArguments] of Object.entries(REQUIRED_DEBUG_SIGNATURES)) {
        const matching = signatures.filter(item => item.name === name && acceptedArguments.includes(item.arguments));
        if (matching.length === 0) missingSignatures.push(name);
        else if (!matching.some(item => item.executable)) deniedSignatures.push(name);
    }
    const executableBreakpoint = signatures.find(item => item.name === 'add_breakpoint' && item.executable
        && REQUIRED_DEBUG_SIGNATURES.add_breakpoint.includes(item.arguments));
    const canonical = signatures.map(item => `${item.name}(${item.arguments})=${item.executable ? 'x' : '-'}`).join('\n');
    const signatureFingerprint = createHash('sha256').update(canonical).digest('hex');
    const compatibilityRecognized = RECOGNIZED_COMPATIBILITIES.has(dimension.compatibility);
    const debugSupported = compatibilityRecognized && dimension.compatibility !== 'M'
        && missingSignatures.length === 0 && deniedSignatures.length === 0;
    return {...dimension, apiSignatures: signatures, signatureFingerprint, missingSignatures,
        deniedSignatures, breakpointArgumentType: executableBreakpoint?.arguments.startsWith('26 ') ? 'oid'
            : executableBreakpoint?.arguments.startsWith('25 ') ? 'text' : null,
        compatibilityRecognized, debugSupported};
}

function expectedPattern(value, label) {
    const source = text(value, label);
    try { return new RegExp(source, 'u'); } catch (error) { throw new Error(`Invalid ${label}: ${error.message}`); }
}

function validateEntry(entry, ids) {
    reject(!entry || typeof entry !== 'object', 'Malformed matrix entry');
    const id = text(entry.id, 'matrix entry id');
    reject(!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(id), `Unsafe matrix entry id: ${id}`);
    reject(ids.has(id), `Duplicate matrix entry id: ${id}`);
    ids.add(id);
    text(entry.connection, `${id} connection file`);
    text(entry.jdbc, `${id} JDBC file`);
    reject(!entry.expect || typeof entry.expect !== 'object', `Missing expectations for ${id}`);
    const expect = {
        driverClass: text(entry.expect.driverClass, `${id} expected driver class`),
        driverVersion: expectedPattern(entry.expect.driverVersionPattern, `${id} driver version pattern`),
        serverVersion: expectedPattern(entry.expect.serverVersionPattern, `${id} server version pattern`),
        compatibility: text(entry.expect.compatibility, `${id} expected compatibility`).toUpperCase(),
        debugSupported: entry.expect.debugSupported,
        signatureFingerprint: entry.expect.signatureFingerprint,
    };
    reject(typeof expect.debugSupported !== 'boolean', `Missing ${id} expected debug support`);
    if (expect.signatureFingerprint !== undefined) {
        reject(typeof expect.signatureFingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(expect.signatureFingerprint),
            `Invalid ${id} expected signature fingerprint`);
    }
    return {id, expect};
}

function assertExpected(entry, expected, capability) {
    reject(capability.driverClass !== expected.driverClass,
        `${entry.id} driver class changed: ${capability.driverClass}`);
    reject(!expected.driverVersion.test(capability.driverVersion), `${entry.id} driver version is outside its declared range`);
    reject(!expected.serverVersion.test(capability.serverVersion), `${entry.id} server version is outside its declared range`);
    reject(capability.compatibility !== expected.compatibility,
        `${entry.id} compatibility changed: ${capability.compatibility}`);
    reject(capability.debugSupported !== expected.debugSupported,
        `${entry.id} debugger support changed: ${capability.debugSupported}`);
    if (expected.signatureFingerprint !== undefined) {
        reject(capability.signatureFingerprint !== expected.signatureFingerprint,
            `${entry.id} debugger API signature fingerprint changed`);
    }
}

export async function runCapabilityMatrix(entries, {probe, run = async () => 0} = {}) {
    reject(!Array.isArray(entries) || entries.length === 0, 'Capability matrix must contain entries');
    reject(typeof probe !== 'function' || typeof run !== 'function', 'Capability matrix requires probe and run functions');
    const ids = new Set();
    const cells = new Set();
    const results = [];
    for (const entry of entries) {
        const validated = validateEntry(entry, ids);
        const capability = analyzeDebugCapability(await probe(entry));
        assertExpected(entry, validated.expect, capability);
        const cell = JSON.stringify([capability.driverClass, capability.driverVersion, capability.serverVersion,
            capability.compatibility, capability.signatureFingerprint]);
        reject(cells.has(cell), `${entry.id} duplicates an already executed capability cell`);
        cells.add(cell);
        const status = await run(entry, capability);
        reject(status !== 0, `${entry.id} regression command failed with status ${status}`);
        results.push({id: entry.id, driverClass: capability.driverClass, driverVersion: capability.driverVersion,
            serverVersion: capability.serverVersion, compatibility: capability.compatibility,
            signatureFingerprint: capability.signatureFingerprint, breakpointArgumentType: capability.breakpointArgumentType,
            debugSupported: capability.debugSupported, status: 'passed'});
    }
    return {cells: results.length, passed: results.length, results};
}

function checkedFile(file, label, privateFile = false) {
    reject(typeof file !== 'string' || !path.isAbsolute(file), `${label} must be an absolute path`);
    let stat;
    try { stat = fs.statSync(file); } catch { throw new Error(`${label} does not exist`); }
    reject(!stat.isFile(), `${label} must be a regular file`);
    if (privateFile && process.platform !== 'win32') {
        reject((stat.mode & 0o077) !== 0, `${label} must not be accessible by group or others`);
    }
    return file;
}

function javaTool(name) {
    const override = process.env[`GAUSSDB_MATRIX_${name.toUpperCase()}`];
    if (override) return override;
    return process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME, 'bin', name) : name;
}

function spawnChecked(command, args, options, label) {
    const result = spawnSync(command, args, {...options, encoding: options?.encoding ?? 'utf8'});
    reject(result.error, `${label} could not start`);
    reject(result.signal, `${label} ended by signal ${result.signal}`);
    reject(result.status !== 0, `${label} failed with status ${result.status}`);
    return result;
}

function compileProbe(output) {
    const source = fileURLToPath(new URL('../integration/DebugCapabilityProbe.java', import.meta.url));
    spawnChecked(javaTool('javac'), ['--release', '11', '-d', output, source], {timeout: 30000},
        'Debugger capability probe compilation');
}

function liveProbe(entry, classes) {
    checkedFile(entry.connection, `${entry.id} connection file`, true);
    checkedFile(entry.jdbc, `${entry.id} JDBC file`);
    const classpath = `${classes}${path.delimiter}${entry.jdbc}`;
    const result = spawnChecked(javaTool('java'), ['-cp', classpath, 'DebugCapabilityProbe', entry.connection],
        {timeout: 30000}, `${entry.id} capability probe`);
    try { return JSON.parse(result.stdout.trim()); }
    catch { throw new Error(`${entry.id} capability probe returned malformed JSON`); }
}

async function main() {
    const [matrixFile, ...rest] = process.argv.slice(2);
    reject(!matrixFile, 'Usage: run-debug-matrix.mjs <matrix.json> --probe-only | -- <command> [args...]');
    const document = JSON.parse(fs.readFileSync(matrixFile, 'utf8'));
    reject(!document || !Array.isArray(document.entries), 'Matrix document must contain an entries array');
    const probeOnly = rest.length === 1 && rest[0] === '--probe-only';
    const separator = rest.indexOf('--');
    reject(!probeOnly && (separator !== 0 || rest.length < 2),
        'Specify --probe-only or a regression command after --');
    const command = probeOnly ? null : rest[1];
    const commandArguments = probeOnly ? [] : rest.slice(2);
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'dbv-debug-matrix-'));
    fs.chmodSync(temporary, 0o700);
    try {
        compileProbe(temporary);
        const summary = await runCapabilityMatrix(document.entries, {
            probe: entry => liveProbe(entry, temporary),
            run: probeOnly ? async () => 0 : async (entry, capability) => {
                const result = spawnSync(command, commandArguments, {stdio: 'inherit', env: {...process.env,
                    GAUSSDB_HISTORY_CONNECTION: entry.connection, GAUSSDB_HISTORY_JDBC: entry.jdbc,
                    GAUSSDB_MATRIX_ID: entry.id, GAUSSDB_MATRIX_EXPECT_DEBUG: String(entry.expect.debugSupported),
                    GAUSSDB_MATRIX_CAPABILITY: JSON.stringify({driverClass: capability.driverClass,
                        driverVersion: capability.driverVersion, serverVersion: capability.serverVersion,
                        compatibility: capability.compatibility, signatureFingerprint: capability.signatureFingerprint,
                        debugSupported: capability.debugSupported})}});
                if (result.error || result.signal) return 1;
                return result.status ?? 1;
            },
        });
        console.log(JSON.stringify(summary));
    } finally {
        fs.rmSync(temporary, {recursive: true, force: true});
    }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
