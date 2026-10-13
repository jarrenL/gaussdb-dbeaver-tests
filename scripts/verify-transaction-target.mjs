import fs from 'node:fs';
import {pathToFileURL} from 'node:url';

export function verifyTransactionTarget({targetLog, targetExitCode}) {
    const reject = message => { throw Error(message); };
    if (!Number.isInteger(targetExitCode) || targetExitCode !== 0) reject('Target process did not exit successfully');
    if (/^FAIL(?:\s|$)/m.test(targetLog) || /^(?:Exception in thread|Caused by:)\s/m.test(targetLog)) {
        reject('Target log contains a failure');
    }
    const identities = [...targetLog.matchAll(/^TARGET (dbv_gui_[a-z0-9_]+) PID=([1-9][0-9]*)$/gm)];
    if (identities.length !== 1) reject('Expected exactly one target identity');
    const [, marker, pid] = identities[0];
    const before = [...targetLog.matchAll(/^BEFORE targetRows=2 observerRows=1 schema=(dbv_gui_tx_[a-f0-9]+)$/gm)];
    if (before.length !== 1) reject('Expected exactly one prepared transaction state');
    const schema = before[0][1];
    const interrupts = [...targetLog.matchAll(/^INTERRUPTED SQLSTATE=(\S+)$/gm)];
    if (interrupts.length !== 1 || !(interrupts[0][1] === '57P01' || interrupts[0][1].startsWith('08'))) {
        reject('Missing or invalid termination SQLSTATE');
    }
    const exactLines = line => targetLog.split(/\r?\n/).filter(candidate => candidate === line).length;
    if (exactLines('PASS terminate transaction: baseline kept, uncommitted row absent, fresh write committed') !== 1) {
        reject('Missing or duplicated transaction outcome');
    }
    if (exactLines('CLEANED ' + schema) !== 1) reject('Missing or mismatched cleanup outcome');
    return {marker, pid, schema, sqlState: interrupts[0][1], passed: true};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const [log, exitCode] = process.argv.slice(2);
    try {
        console.log(JSON.stringify(verifyTransactionTarget({
            targetLog: fs.readFileSync(log, 'utf8'),
            targetExitCode: Number(exitCode)
        })));
    } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
    }
}
