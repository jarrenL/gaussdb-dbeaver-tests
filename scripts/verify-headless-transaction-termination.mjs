import fs from 'node:fs';
import {pathToFileURL} from 'node:url';

const TEST = 'transaction-termination';
const SCOPE = 'server-jdbc';
const PASS_LABELS = [
    'fixture visibility isolates the uncommitted row',
    'target identity is positive and marker-bound',
    'controller matched the exact active target',
    'server acknowledged target termination',
    'target reported a termination SQLSTATE',
    'terminated target connection is invalid',
    'uncommitted target row was rolled back',
    'fresh connection committed a replacement row',
    'isolated schema was cleaned',
];

/** Strictly validates one complete headless server/JDBC termination run. It is not a GUI verifier. */
export function verifyHeadlessTransactionTermination({targetLog, targetExitCode}) {
    const reject = message => { throw Error(message); };
    if (!Number.isInteger(targetExitCode) || targetExitCode !== 0) {
        reject('Target process did not exit successfully');
    }
    if (/^FAIL(?:\s|$)/m.test(targetLog) || /^(?:Exception in thread|Caused by:)\s/m.test(targetLog)) {
        reject('Target log contains a failure');
    }
    const lines = targetLog.split(/\r?\n/);
    const exactLines = line => lines.filter(candidate => candidate === line).length;
    const mode = `MODE HEADLESS test=${TEST} scope=${SCOPE} gui=false`;
    const result = `RESULT PASS test=${TEST} scope=${SCOPE} gui=false`;
    const modeLines = lines.filter(line => line.startsWith('MODE '));
    const resultLines = lines.filter(line => line.startsWith('RESULT '));
    if (modeLines.length !== 1 || modeLines[0] !== mode) {
        reject('Missing, conflicting, or duplicated headless scope declaration');
    }
    if (resultLines.length !== 1 || resultLines[0] !== result) {
        reject('Missing, conflicting, or duplicated successful terminal result');
    }
    if (/\bgui=true\b/i.test(targetLog)) reject('Headless evidence must not claim GUI coverage');

    const identities = [...targetLog.matchAll(
        /^TARGET (dbv_headless_tx_[a-f0-9]{32}) PID=([1-9][0-9]*)$/gm)];
    if (identities.length !== 1) reject('Expected exactly one target identity');
    const [, marker, pid] = identities[0];

    const prepared = [...targetLog.matchAll(
        /^BEFORE targetRows=2 observerRows=1 schema=(dbv_headless_tx_[a-f0-9]{32})$/gm)];
    if (prepared.length !== 1) reject('Expected exactly one prepared transaction state');
    const schema = prepared[0][1];

    const controllers = [...targetLog.matchAll(
        /^CONTROLLER MATCH marker=(dbv_headless_tx_[a-f0-9]{32}) pid=([1-9][0-9]*) state=active$/gm)];
    if (controllers.length !== 1 || controllers[0][1] !== marker || controllers[0][2] !== pid) {
        reject('Controller identity does not match the target');
    }
    const acknowledgements = [...targetLog.matchAll(/^TERMINATE ACK=true pid=([1-9][0-9]*)$/gm)];
    if (acknowledgements.length !== 1 || acknowledgements[0][1] !== pid) {
        reject('Termination acknowledgement does not match the target');
    }
    const interruptions = [...targetLog.matchAll(/^INTERRUPTED SQLSTATE=(\S+)$/gm)];
    if (interruptions.length !== 1
        || !(interruptions[0][1] === '57P01' || interruptions[0][1].startsWith('08'))) {
        reject('Missing or invalid termination SQLSTATE');
    }
    if (exactLines('CLEANED ' + schema) !== 1) reject('Missing or mismatched cleanup outcome');

    const passLines = lines.filter(line => line.startsWith('PASS '));
    if (passLines.length !== PASS_LABELS.length) reject('Unexpected PASS count');
    for (const label of PASS_LABELS) {
        if (exactLines('PASS ' + label) !== 1) reject('Missing or duplicated check: ' + label);
    }
    const summaries = [...targetLog.matchAll(/^TOTAL CHECKS (\d+) PASS (\d+) FAIL (\d+)$/gm)];
    if (summaries.length !== 1
        || Number(summaries[0][1]) !== PASS_LABELS.length
        || Number(summaries[0][2]) !== PASS_LABELS.length
        || Number(summaries[0][3]) !== 0) {
        reject('Invalid check summary');
    }
    return {marker, pid, schema, sqlState: interruptions[0][1], scope: SCOPE, gui: false, passed: true};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const [log, exitCode] = process.argv.slice(2);
    try {
        console.log(JSON.stringify(verifyHeadlessTransactionTermination({
            targetLog: fs.readFileSync(log, 'utf8'),
            targetExitCode: Number(exitCode),
        })));
    } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
    }
}
