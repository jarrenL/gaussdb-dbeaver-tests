import fs from 'node:fs';
import {pathToFileURL} from 'node:url';

export function verifySessionAction({mode, targetLog, targetExitCode, targetSnapshot, confirmation, refreshed}) {
    const reject = message => { throw Error(message); };
    if (!['cancel', 'terminate'].includes(mode)) reject('Unknown action');
    if (!Number.isInteger(targetExitCode) || targetExitCode !== 0) reject('Target process did not exit successfully');
    if (/^FAIL(?:\s|$)/m.test(targetLog) || /^(?:Exception in thread|Caused by:)\s/m.test(targetLog)) {
        reject('Target log contains a failure');
    }
    const matches = [...targetLog.matchAll(/^TARGET (dbv_gui_[a-z0-9_]+) PID=([1-9][0-9]*) USER=(\S+)$/gm)];
    if (matches.length !== 1) reject('Expected exactly one target identity');
    const [, marker, pid, user] = matches[0];
    const rows = targetSnapshot.split(/(?=^\s*\d+ TreeItem )/m);
    const matchingRows = rows.filter(row => row.includes('column3=' + marker + '\n'));
    if (matchingRows.length !== 1) reject('Target marker absent or duplicated');
    const row = matchingRows[0];
    const displayed = row.match(/^\s*\d+ TreeItem ([0-9,]+)\r?$/m)?.[1]?.replaceAll(',', '');
    if (displayed !== pid || !row.includes('column1=' + user + '\n')
        || !row.includes('column4=active\n') || !row.includes('column6=SELECT pg_sleep(120)')) {
        reject('Target row identity or active query mismatch');
    }
    const label = mode === 'cancel' ? 'Cancel query of session' : 'Terminate session';
    if (!confirmation.includes(label + ' [' + pid + '@distributed_acceptance]? visible=true enabled=true')
        || !confirmation.includes('Button 是(&Y) visible=true enabled=true')) reject('Confirmation mismatch');
    const state = mode === 'cancel' ? '57014' : '57P01';
    const result = mode === 'cancel' ? 'PASS cancel: same connection still queries'
        : 'PASS terminate: old invalid, fresh connection queries';
    const exactLines = line => targetLog.split(/\r?\n/).filter(candidate => candidate === line).length;
    if (exactLines('INTERRUPTED SQLSTATE=' + state) !== 1 || exactLines(result) !== 1) {
        reject('Missing or duplicated independent JDBC outcome');
    }
    for (const snapshot of [targetSnapshot, confirmation, refreshed]) {
        if (!snapshot.trimEnd().endsWith('OK')) reject('Incomplete UI evidence');
    }
    if (refreshed.includes(marker)) reject('Target still shown after refresh');
    const shells = refreshed.match(/^\d+ Shell .+$/gm) || [];
    if (shells.length !== 1 || !shells[0].includes('DBeaver 26.1.5 - Sessions')) reject('Unexpected final dialog');
    return {mode, marker, pid, user, sqlState: state, passed: true};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const [mode, log, target, confirm, after, exitCode] = process.argv.slice(2);
    try {
        const read = file => fs.readFileSync(file, 'utf8');
        console.log(JSON.stringify(verifySessionAction({mode, targetLog: read(log), targetExitCode: Number(exitCode),
            targetSnapshot: read(target),
            confirmation: read(confirm), refreshed: read(after)})));
    } catch (error) { console.error(error.message); process.exitCode = 1; }
}
