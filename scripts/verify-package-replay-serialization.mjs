import fs from 'node:fs';
import {pathToFileURL} from 'node:url';

const SCHEMA = 'dbv_pkg_replay_serial';
const LABELS = [
    'initial committed package returns 42',
    'database schema and package identities are available',
    'connection A locked snapshot contains body 42',
    'connection B cannot enter the DBeaver package write section while A holds the lock',
    'connection A replay commits body 42 before the waiting writer',
    'connection B obtains the same lock after A commits',
    'connection B commits replacement body 84 after lock handoff',
    'observer sees connection B value 84 after serialized handoff',
    'both writer connections are reusable after commit',
    'package identity remains stable after serialized writes',
    'authoritative source remains connection B body 84',
    'isolated schema is cleaned with RESTRICT',
];

export function verifyPackageReplaySerialization({targetLog, targetExitCode}) {
    const reject = message => { throw Error(message); };
    if (!Number.isInteger(targetExitCode) || targetExitCode !== 0) {
        reject('Package replay serialization process did not exit successfully');
    }
    if (/^FAIL(?:\s|$)/m.test(targetLog) || /^(?:Exception in thread|Caused by:)\s/m.test(targetLog)) {
        reject('Package replay serialization log contains a failure');
    }
    const lines = targetLog.split(/\r?\n/);
    const results = lines.filter(line => line.startsWith('RESULT '));
    const expectedResult = 'RESULT PASS test=package-replay-serialization' +
        ' scope=dbeaver-cooperative-advisory-lock gui=false osgi=false' +
        ' externalWriters=false multiCn=false';
    if (results.length !== 1 || results[0] !== expectedResult) {
        reject('Expected exactly one scoped package replay serialization PASS result');
    }
    for (const label of LABELS) {
        if (lines.filter(line => line === `PASS ${label}`).length !== 1) {
            reject(`Expected exactly one PASS for: ${label}`);
        }
    }
    if (lines.filter(line => line.startsWith('PASS ')).length !== LABELS.length) {
        reject('Unexpected PASS line count');
    }
    if (lines.filter(line => line === 'TOTAL CHECKS 12 PASS 12 FAIL 0').length !== 1) {
        reject('Missing or inconsistent 12/12 summary');
    }
    const locked = uniqueMatch(lines,
        /^LOCKED packageOid=([1-9]\d*) key=(-?\d+) value=42 isolation=REPEATABLE_READ$/,
        'locked authoritative snapshot', reject);
    const contended = uniqueMatch(lines,
        /^CONTENDED packageOid=([1-9]\d*) key=(-?\d+) secondWriterEntered=false$/,
        'advisory lock contention', reject);
    const handoff = uniqueMatch(lines,
        /^HANDOFF packageOid=([1-9]\d*) key=(-?\d+) value=84 committed=true$/,
        'serialized writer handoff', reject);
    const final = uniqueMatch(lines,
        /^FINAL packageOid=([1-9]\d*) value=84 source=connection-B identityStable=true$/,
        'final authoritative state', reject);
    if (new Set([locked[1], contended[1], handoff[1], final[1]]).size !== 1) {
        reject('Package OID changed across lock, contention, handoff, or final state');
    }
    if (new Set([locked[2], contended[2], handoff[2]]).size !== 1) {
        reject('Package lock key changed across lock, contention, or handoff');
    }
    if (lines.filter(line => line ===
        'SCOPE cooperativeDBeaverWriters=true externalWriters=false multiCn=false').length !== 1) {
        reject('Missing exact cooperative-writer evidence boundary');
    }
    if (lines.filter(line => line === `CLEANED schema=${SCHEMA}`).length !== 1) {
        reject('Expected exactly one fixed-schema cleanup marker');
    }
    if (/\bCASCADE\b/i.test(targetLog)) reject('Fixture log must not claim CASCADE cleanup');
    return {
        packageOid: locked[1],
        lockKey: locked[2],
        finalValue: 84,
        scope: 'dbeaver-cooperative-advisory-lock',
        gui: false,
        osgi: false,
        externalWriters: false,
        multiCn: false,
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
        console.log(JSON.stringify(verifyPackageReplaySerialization({
            targetLog: fs.readFileSync(log, 'utf8'),
            targetExitCode: Number(exitCode),
        })));
    } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
    }
}
