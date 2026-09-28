import test from 'node:test';
import assert from 'node:assert/strict';
import {requiredClasses, requiredModules, verifyRegressionResults} from './verify-regression-results.mjs';

function fixture() {
    const cases = requiredClasses.map(([module, name]) => ({module, class: name, name: 'example', outcome: 'passed'}));
    for (const module of requiredModules) {
        if (!cases.some(item => item.module === module)) cases.push({module, class: 'fixture', name: 'example', outcome: 'passed'});
    }
    return recount({reports: [{file: 'synthetic.xml', modified: new Date(2000).toISOString()}], cases});
}
function recount(report) {
    report.totals = {tests: report.cases.length, passed: 0, skipped: 0, failures: 0, errors: 0};
    for (const item of report.cases) report.totals[item.outcome]++;
    return report;
}
test('accepts fresh required modules and classes without counting optional skips as passes', () => {
    const report = fixture();
    report.cases.push({module: requiredModules[1], class: 'optional', name: 'unavailable', outcome: 'skipped'});
    const totals = verifyRegressionResults(recount(report), 1000);
    assert.equal(totals.skipped, 1);
    assert.equal(totals.passed, totals.tests - 1);
});
test('rejects stale reports', () => assert.throws(() => verifyRegressionResults(fixture(), 3000), /Stale/));
test('rejects missing required class even with fresh passing totals', () => {
    const report = fixture(); report.cases.shift();
    assert.throws(() => verifyRegressionResults(recount(report), 1000), /class missing/);
});
test('rejects missing module', () => {
    const report = fixture(); report.cases = report.cases.filter(item => item.module !== requiredModules[1]);
    assert.throws(() => verifyRegressionResults(recount(report), 1000), /Module did not/);
});
test('rejects skipped required component case', () => {
    const report = fixture(); report.cases[0].outcome = 'skipped';
    assert.throws(() => verifyRegressionResults(recount(report), 1000), /not all passed/);
});
test('rejects actual failure', () => {
    const report = fixture(); report.cases[0].outcome = 'failures';
    assert.throws(() => verifyRegressionResults(recount(report), 1000), /Tests failed/);
});
test('rejects misleading aggregate counts', () => {
    const report = fixture(); report.totals.passed--;
    assert.throws(() => verifyRegressionResults(report, 1000), /Outcome mismatch/);
});
