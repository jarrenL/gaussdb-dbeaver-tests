import fs from 'node:fs';
import {pathToFileURL} from 'node:url';

const SCHEMA = 'dbv_pkg_catalog_refresh';
const LABELS = [
    'isolated schema and package are owned by the test account',
    'initial package invocation returns 42',
    'connection A cached the old authoritative body by OID',
    'connection B replacement returns 84',
    'connection A refreshed the authoritative body by the same OID',
    'refreshed source differs from the stale cache',
    'replay selected only the refreshed source',
    'authoritative replay preserves value 84',
    'schema identity and owner remain stable',
    'package identity and owner remain stable',
    'specification object identity and valid state remain stable',
    'body object identity and valid state remain stable',
    'isolated schema is cleaned with RESTRICT',
];

/** Strictly validates a complete two-connection package-catalog refresh run. */
export function verifyPackageCatalogConcurrency({targetLog, targetExitCode}) {
    const reject = message => { throw Error(message); };
    if (!Number.isInteger(targetExitCode) || targetExitCode !== 0) {
        reject('Package catalog concurrency process did not exit successfully');
    }
    if (/^FAIL(?:\s|$)/m.test(targetLog) || /^(?:Exception in thread|Caused by:)\s/m.test(targetLog)) {
        reject('Package catalog concurrency log contains a failure');
    }
    const lines = targetLog.split(/\r?\n/);
    const results = lines.filter(line => line.startsWith('RESULT '));
    if (results.length !== 1 || results[0] !==
        'RESULT PASS test=package-catalog-concurrency scope=server-jdbc-catalog gui=false osgi=false') {
        reject('Expected exactly one scoped package catalog PASS result');
    }

    for (const label of LABELS) {
        if (lines.filter(line => line === `PASS ${label}`).length !== 1) {
            reject(`Expected exactly one PASS for: ${label}`);
        }
    }
    const passLines = lines.filter(line => line.startsWith('PASS '));
    if (passLines.length !== LABELS.length) reject('Unexpected PASS line count');
    if (lines.filter(line => line === 'TOTAL CHECKS 13 PASS 13 FAIL 0').length !== 1) {
        reject('Missing or inconsistent 13/13 summary');
    }

    const old = uniqueMatch(lines,
        /^SOURCE OLD packageOid=([1-9]\d*) digest=([0-9a-f]{64}) value=42$/,
        'old authoritative source', reject);
    const update = uniqueMatch(lines,
        /^CONCURRENT UPDATE packageOid=([1-9]\d*) value=84 connection=B$/,
        'connection B update', reject);
    const refresh = uniqueMatch(lines,
        /^SOURCE REFRESH packageOid=([1-9]\d*) digest=([0-9a-f]{64}) value=84 staleSelected=false$/,
        'refreshed authoritative source', reject);
    const replay = uniqueMatch(lines,
        /^REPLAY packageOid=([1-9]\d*) source=refreshed value=84$/,
        'refreshed replay', reject);
    if (new Set([old[1], update[1], refresh[1], replay[1]]).size !== 1) {
        reject('Package OID changed across read, update, refresh, or replay');
    }
    if (old[2] === refresh[2]) reject('Old and refreshed source digests must differ');

    const identity = uniqueMatch(lines,
        /^IDENTITY schemaOid=([1-9]\d*) schemaOwner=([1-9]\d*) packageOid=([1-9]\d*) packageOwner=([1-9]\d*) specObjectOid=([1-9]\d*) bodyObjectOid=([1-9]\d*) schemaStable=true ownerStable=true packageStable=true specStable=true bodyStable=true specValid=true bodyValid=true$/,
        'stable package identity', reject);
    if (identity[3] !== old[1] || identity[5] !== old[1] || identity[6] !== old[1]) {
        reject('Identity evidence does not bind package and S/B object rows to the same OID');
    }
    if (identity[2] !== identity[4]) reject('Schema and package owners differ');
    if (lines.filter(line => line === `CLEANED schema=${SCHEMA}`).length !== 1) {
        reject('Expected exactly one fixed-schema cleanup marker');
    }
    if (/\bCASCADE\b/i.test(targetLog)) reject('Fixture log must not claim CASCADE cleanup');
    return {
        packageOid: old[1],
        schemaOid: identity[1],
        ownerOid: identity[2],
        oldDigest: old[2],
        refreshedDigest: refresh[2],
        scope: 'server-jdbc-catalog',
        gui: false,
        osgi: false,
        passed: true,
    };
}

function uniqueMatch(lines, expression, description, reject) {
    const matches = lines.map(line => line.match(expression)).filter(Boolean);
    if (matches.length !== 1) reject(`Expected exactly one ${description} marker`);
    return matches[0];
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const [log, exitCode] = process.argv.slice(2);
    try {
        console.log(JSON.stringify(verifyPackageCatalogConcurrency({
            targetLog: fs.readFileSync(log, 'utf8'),
            targetExitCode: Number(exitCode),
        })));
    } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
    }
}
