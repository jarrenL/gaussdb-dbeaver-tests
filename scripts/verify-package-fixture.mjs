import fs from 'node:fs';
import {pathToFileURL} from 'node:url';

const DETAILS = 'two-guarded-lifecycles,diagnostics,duplicate-refusal-without-mutation,'
    + 'unrelated-table-retained,failed-cleanup-restores-packages,cleanup-after-package-removal';

/** Strictly validates one complete package-fixture protection run. */
export function verifyPackageFixture({targetLog, targetExitCode}) {
    const reject = message => { throw Error(message); };
    if (!Number.isInteger(targetExitCode) || targetExitCode !== 0) {
        reject('Package fixture process did not exit successfully');
    }
    if (/^FAIL(?:\s|$)/m.test(targetLog) || /^(?:Exception in thread|Caused by:)\s/m.test(targetLog)) {
        reject('Package fixture log contains a failure');
    }
    const lines = targetLog.split(/\r?\n/);
    const results = lines.filter(line => line.startsWith('RESULT '));
    if (results.length !== 1) reject('Expected exactly one package fixture terminal result');
    const match = results[0].match(
        /^RESULT PASS test=package-fixture reason=none mode=(structured|source-replay) details=(.+)$/);
    if (!match || match[2] !== DETAILS) reject('Missing or malformed package fixture PASS result');
    const mode = match[1];

    const duplicate = lines.filter(line => /^DUPLICATE REFUSED sqlState=\S+ originalStatePreserved=true transactionRolledBack=true$/.test(line));
    if (duplicate.length !== 2) reject('Expected two mutation-safe duplicate setup refusals');
    if (mode === 'source-replay') {
        if (lines.some(line => line.startsWith('SESSION SETTINGS '))) {
            reject('Source-replay mode must not set centralized session parameters');
        }
        if (!lines.some(line => line.startsWith('PACKAGE DIAGNOSTIC mode=source-replay phase=create '))
            || !lines.some(line => line.startsWith('PACKAGE DIAGNOSTIC mode=source-replay phase=replay '))) {
            reject('Source-replay mode lacks direct and replay diagnostic evidence');
        }
    } else if (!lines.some(line => line ===
        'SESSION SETTINGS transaction-local: enable_force_create_obj=on; plsql_show_all_error=off')) {
        reject('Structured mode lacks an explicit transaction-local session-setting notice');
    }
    return {mode, passed: true};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const [log, exitCode] = process.argv.slice(2);
    try {
        console.log(JSON.stringify(verifyPackageFixture({
            targetLog: fs.readFileSync(log, 'utf8'),
            targetExitCode: Number(exitCode),
        })));
    } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
    }
}
