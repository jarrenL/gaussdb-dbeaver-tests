import {test} from 'node:test';
import assert from 'node:assert/strict';
import {verifyPackageFixture} from './verify-package-fixture.mjs';

const details = 'two-guarded-lifecycles,diagnostics,duplicate-refusal-without-mutation,'
    + 'unrelated-table-retained,failed-cleanup-restores-packages,cleanup-after-package-removal';

function fixture(mode = 'source-replay') {
    const sourceReplay = mode === 'source-replay' ? [
        'PACKAGE DIAGNOSTIC mode=source-replay phase=create sqlState=42704 vendorCode=11019 inferredLine=3 message=invalid type',
        'PACKAGE DIAGNOSTIC mode=source-replay phase=replay sqlState=42704 vendorCode=11019 inferredLine=3 message=invalid type',
    ] : ['SESSION SETTINGS transaction-local: enable_force_create_obj=on; plsql_show_all_error=off'];
    return {
        targetExitCode: 0,
        targetLog: [
            ...sourceReplay,
            'DUPLICATE REFUSED sqlState=42P06 originalStatePreserved=true transactionRolledBack=true',
            'DUPLICATE REFUSED sqlState=42710 originalStatePreserved=true transactionRolledBack=true',
            `RESULT PASS test=package-fixture reason=none mode=${mode} details=${details}`,
        ].join('\n'),
    };
}

test('accepts complete structured and source-replay package fixture runs', () => {
    assert.deepEqual(verifyPackageFixture(fixture('structured')), {mode: 'structured', passed: true});
    assert.deepEqual(verifyPackageFixture(fixture('source-replay')), {mode: 'source-replay', passed: true});
});

test('rejects a structured run that hides its required session settings', () => {
    const value = fixture('structured');
    value.targetLog = value.targetLog.replace(/^SESSION SETTINGS .*\n/m, '');
    assert.throws(() => verifyPackageFixture(value));
});

for (const [name, change] of [
    ['nonzero exit', value => { value.targetExitCode = 1; }],
    ['missing exit', value => { delete value.targetExitCode; }],
    ['unsupported terminal', value => { value.targetLog = value.targetLog.replace(
        'RESULT PASS test=package-fixture reason=none mode=source-replay',
        'RESULT UNSUPPORTED test=package-fixture reason=unsupported-server mode=source-replay'); }],
    ['wrong test id', value => { value.targetLog = value.targetLog.replace(
        'test=package-fixture', 'test=package-source-replay'); }],
    ['missing result', value => { value.targetLog = value.targetLog.replace(/^RESULT .*$/m, ''); }],
    ['duplicate result', value => { value.targetLog += '\n' + value.targetLog.match(/^RESULT .*$/m)[0]; }],
    ['conflicting result', value => { value.targetLog += '\nRESULT FAIL test=package-fixture reason=error mode=source-replay details=x'; }],
    ['missing duplicate refusal', value => { value.targetLog = value.targetLog.replace(/^DUPLICATE REFUSED .*\n/m, ''); }],
    ['mutated fixture state', value => { value.targetLog = value.targetLog.replace(
        'originalStatePreserved=true', 'originalStatePreserved=false'); }],
    ['missing rollback proof', value => { value.targetLog = value.targetLog.replace(
        'transactionRolledBack=true', 'transactionRolledBack=false'); }],
    ['missing create diagnostic', value => { value.targetLog = value.targetLog.replace(/^PACKAGE DIAGNOSTIC .*phase=create .*\n/m, ''); }],
    ['missing replay diagnostic', value => { value.targetLog = value.targetLog.replace(/^PACKAGE DIAGNOSTIC .*phase=replay .*\n/m, ''); }],
    ['hidden session setting', value => { value.targetLog += '\nSESSION SETTINGS transaction-local: enable_force_create_obj=on'; }],
    ['wrong details', value => { value.targetLog = value.targetLog.replace(details, 'incomplete'); }],
    ['failure line', value => { value.targetLog += '\nFAIL stale package assertion'; }],
    ['uncaught exception', value => { value.targetLog += '\nException in thread "main" java.lang.AssertionError'; }],
]) {
    test('rejects ' + name, () => {
        const value = fixture();
        change(value);
        assert.throws(() => verifyPackageFixture(value));
    });
}
