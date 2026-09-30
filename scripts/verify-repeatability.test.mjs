import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyRepeatability} from './verify-repeatability.mjs';

function fixture() {
    return {
        generatedAt: new Date(2000).toISOString(),
        reports: [{file: 'synthetic.xml', modified: new Date(2000).toISOString()}],
        cases: [
            {module: 'org.example.mod.a', class: 'org.example.ClassOneTest', name: 'checksBinding', outcome: 'passed'},
            {module: 'org.example.mod.a', class: 'org.example.ClassTwoTest', name: 'checksExport', outcome: 'passed'},
            {module: 'org.example.mod.b', class: 'org.example.ClassThreeTest', name: 'needsLiveDatabase', outcome: 'skipped'},
        ],
        totals: {tests: 3, passed: 2, skipped: 1, failures: 0, errors: 0},
    };
}
function recount(report) {
    report.totals = {tests: report.cases.length, passed: 0, skipped: 0, failures: 0, errors: 0};
    for (const item of report.cases) report.totals[item.outcome]++;
    return report;
}

test('accepts repeat run with identical identities and outcomes, skips reported separately', () => {
    const summary = verifyRepeatability(fixture(), fixture(), 1000, 1500);
    assert.equal(summary.tests, 3);
    assert.equal(summary.passed, 2);
    assert.equal(summary.skipped, 1);
    assert.equal(summary.failures, 0);
    assert.equal(summary.errors, 0);
    assert.deepEqual(summary.skippedIdentities, [JSON.stringify(['org.example.mod.b', 'org.example.ClassThreeTest', 'needsLiveDatabase'])]);
});
test('accepts identical content in different case order', () => {
    const repeat = fixture();
    repeat.cases = [repeat.cases[2], repeat.cases[0], repeat.cases[1]];
    assert.equal(verifyRepeatability(fixture(), repeat, 1000, 1500).tests, 3);
});
test('rejects stale baseline generatedAt', () =>
    assert.throws(() => verifyRepeatability(fixture(), fixture(), 3000, 1500), /Stale generatedAt in baseline/));
test('rejects stale repeat generatedAt', () =>
    assert.throws(() => verifyRepeatability(fixture(), fixture(), 1000, 3000), /Stale generatedAt in repeat/));
test('rejects missing or unparseable generatedAt', () => {
    const missing = fixture();
    delete missing.generatedAt;
    assert.throws(() => verifyRepeatability(missing, fixture(), 1000, 1500), /Missing or invalid generatedAt in baseline/);
    const bogus = fixture();
    bogus.generatedAt = 'not-a-timestamp';
    assert.throws(() => verifyRepeatability(bogus, fixture(), 1000, 1500), /Missing or invalid generatedAt in baseline/);
});
test('rejects report without module reports list', () => {
    const baseline = fixture();
    delete baseline.reports;
    assert.throws(() => verifyRepeatability(baseline, fixture(), 1000, 1500), /No reports in baseline/);
});
test('rejects empty cases list', () => {
    const baseline = fixture();
    baseline.cases = [];
    assert.throws(() => verifyRepeatability(baseline, fixture(), 1000, 1500), /No cases in baseline/);
});
test('rejects duplicate test identity within one run', () => {
    const baseline = fixture();
    baseline.cases.push({...baseline.cases[0]});
    assert.throws(() => verifyRepeatability(baseline, fixture(), 1000, 1500), /Duplicate test identity in baseline/);
});
test('rejects unknown outcome value', () => {
    const baseline = fixture();
    baseline.cases[0].outcome = 'flaky';
    assert.throws(() => verifyRepeatability(baseline, fixture(), 1000, 1500), /Unknown test outcome in baseline: flaky/);
});
test('rejects failing case in baseline run', () => {
    const baseline = fixture();
    baseline.cases[0].outcome = 'failures';
    assert.throws(() => verifyRepeatability(recount(baseline), fixture(), 1000, 1500), /Tests failed in baseline/);
});
test('rejects erroring case in repeat run', () => {
    const repeat = fixture();
    repeat.cases[0].outcome = 'errors';
    assert.throws(() => verifyRepeatability(fixture(), recount(repeat), 1000, 1500), /Tests failed in repeat/);
});
test('rejects test missing from repeat run', () => {
    const repeat = fixture();
    repeat.cases.shift();
    assert.throws(() => verifyRepeatability(fixture(), recount(repeat), 1000, 1500), /missing from repeat run/);
});
test('rejects unexpected extra test in repeat run', () => {
    const repeat = fixture();
    repeat.cases.push({module: 'org.example.mod.c', class: 'org.example.ClassFourTest', name: 'extra', outcome: 'passed'});
    assert.throws(() => verifyRepeatability(fixture(), recount(repeat), 1000, 1500), /Unexpected test in repeat run/);
});
test('rejects previously passed test no longer passing', () => {
    const repeat = fixture();
    repeat.cases[0].outcome = 'skipped';
    assert.throws(() => verifyRepeatability(fixture(), recount(repeat), 1000, 1500), /no longer passes/);
});
test('rejects baseline skip turning into pass', () => {
    const repeat = fixture();
    repeat.cases[2].outcome = 'passed';
    assert.throws(() => verifyRepeatability(fixture(), recount(repeat), 1000, 1500), /Outcome differs between runs/);
});
test('rejects case count not matching totals', () => {
    const repeat = fixture();
    repeat.cases.push({module: 'org.example.mod.c', class: 'org.example.ClassFourTest', name: 'extra', outcome: 'passed'});
    assert.throws(() => verifyRepeatability(fixture(), repeat, 1000, 1500), /Case count mismatch in repeat/);
});
test('rejects outcome totals not matching cases', () => {
    const repeat = fixture();
    repeat.cases[0].outcome = 'skipped';
    // Key iteration order (passed, skipped, failures, errors) reports the passed shortfall first.
    assert.throws(() => verifyRepeatability(fixture(), repeat, 1000, 1500), /Outcome mismatch in repeat: passed/);
});
test('rejects missing totals block', () => {
    const repeat = fixture();
    delete repeat.totals;
    assert.throws(() => verifyRepeatability(fixture(), repeat, 1000, 1500), /Missing totals in repeat/);
});
test('rejects empty or missing identity fields', () => {
    for (const field of ['module', 'class', 'name']) {
        const empty = fixture();
        empty.cases[1][field] = '';
        assert.throws(() => verifyRepeatability(empty, fixture(), 1000, 1500), new RegExp(`Empty ${field} in baseline`));
        const absent = fixture();
        delete absent.cases[1][field];
        assert.throws(() => verifyRepeatability(absent, fixture(), 1000, 1500), new RegExp(`Empty ${field} in baseline`));
    }
});
test('rejects malformed report object', () =>
    assert.throws(() => verifyRepeatability(null, fixture(), 1000, 1500), /Malformed baseline report/));
test('rejects invalid run start times', () => {
    assert.throws(() => verifyRepeatability(fixture(), fixture(), Number('x'), 1500), /Invalid baseline start time/);
    assert.throws(() => verifyRepeatability(fixture(), fixture(), 1000, Number('x')), /Invalid repeat start time/);
});

test('new summary cannot hide stale or invalid individual XML report timestamps', () => {
    for (const modified of [new Date(500).toISOString(), 'invalid', new Date(3000).toISOString()]) {
        const repeat = fixture();
        repeat.reports[0].modified = modified;
        assert.throws(() => verifyRepeatability(fixture(), repeat, 1000, 1500), /source report timestamp/);
    }
});
test('rejects missing or duplicate individual report identities', () => {
    const repeat = fixture();
    repeat.reports.push({...repeat.reports[0]});
    assert.throws(() => verifyRepeatability(fixture(), repeat, 1000, 1500), /Duplicate source/);
    repeat.reports = [{modified: new Date(2000).toISOString()}];
    assert.throws(() => verifyRepeatability(fixture(), repeat, 1000, 1500), /Missing source/);
});
test('field separator characters cannot create a false identity match', () => {
    const baseline = fixture(), repeat = fixture();
    baseline.cases[0].module = 'a|b'; baseline.cases[0].class = 'c';
    repeat.cases[0].module = 'a'; repeat.cases[0].class = 'b|c';
    assert.throws(() => verifyRepeatability(baseline, repeat, 1000, 1500), /missing from repeat/);
});
