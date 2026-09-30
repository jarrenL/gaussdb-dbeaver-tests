import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';

const outcomeKeys = {passed: 0, skipped: 0, failures: 0, errors: 0};

// Compare two sanitized regression JSON reports (same schema verify-regression-results.mjs consumes):
// each run needs nonempty unique module/class/name identities with consistent totals and zero
// failures/errors; both runs must contain the same identities with the same outcomes, every
// baseline pass must still pass, and generatedAt must postdate each run's provided start time.
export function verifyRepeatability(baseline, repeat, baselineStartedMs, repeatStartedMs) {
    const baselineIdentities = validateRun(baseline, 'baseline', baselineStartedMs);
    const repeatIdentities = validateRun(repeat, 'repeat', repeatStartedMs);
    for (const identity of baselineIdentities.keys()) {
        assert(repeatIdentities.has(identity), `Test missing from repeat run: ${identity}`);
    }
    for (const identity of repeatIdentities.keys()) {
        assert(baselineIdentities.has(identity), `Unexpected test in repeat run: ${identity}`);
    }
    for (const [identity, outcome] of baselineIdentities) {
        if (outcome === 'passed') {
            assert(repeatIdentities.get(identity) === 'passed', `Previously passed test no longer passes: ${identity}`);
        }
    }
    for (const [identity, outcome] of baselineIdentities) {
        assert.equal(repeatIdentities.get(identity), outcome, `Outcome differs between runs: ${identity}`);
    }
    const skippedIdentities = [];
    for (const [identity, outcome] of baselineIdentities) {
        if (outcome === 'skipped') skippedIdentities.push(identity);
    }
    return {
        tests: baselineIdentities.size,
        passed: baselineIdentities.size - skippedIdentities.length,
        skipped: skippedIdentities.length,
        failures: 0,
        errors: 0,
        skippedIdentities,
    };
}

function validateRun(report, label, startedMs) {
    assert(Number.isFinite(startedMs), `Invalid ${label} start time`);
    assert(report && typeof report === 'object', `Malformed ${label} report`);
    const generatedMs = Date.parse(report.generatedAt);
    assert(Number.isFinite(generatedMs), `Missing or invalid generatedAt in ${label}`);
    assert(generatedMs >= startedMs, `Stale generatedAt in ${label}`);
    assert(Array.isArray(report.reports) && report.reports.length > 0, `No reports in ${label}`);
    const files = new Set();
    for (const source of report.reports) {
        assert(source && typeof source.file === 'string' && source.file.length > 0,
            `Missing source report identity in ${label}`);
        assert(!files.has(source.file), `Duplicate source report in ${label}`);
        files.add(source.file);
        const modified = Date.parse(source.modified);
        assert(Number.isFinite(modified) && modified >= startedMs && modified <= generatedMs,
            `Stale or invalid source report timestamp in ${label}`);
    }
    assert(Array.isArray(report.cases) && report.cases.length > 0, `No cases in ${label}`);
    assert(report.totals && Number.isFinite(report.totals.tests), `Missing totals in ${label}`);
    const counts = {...outcomeKeys};
    const identities = new Map();
    for (const item of report.cases) {
        for (const field of ['module', 'class', 'name']) {
            assert(typeof item[field] === 'string' && item[field].length > 0, `Empty ${field} in ${label}`);
        }
        assert(Object.hasOwn(counts, item.outcome), `Unknown test outcome in ${label}: ${item.outcome}`);
        const identity = JSON.stringify([item.module, item.class, item.name]);
        assert(!identities.has(identity), `Duplicate test identity in ${label}: ${identity}`);
        identities.set(identity, item.outcome);
        counts[item.outcome]++;
    }
    assert.equal(report.cases.length, report.totals.tests, `Case count mismatch in ${label}`);
    for (const key of Object.keys(counts)) {
        assert.equal(counts[key], report.totals[key], `Outcome mismatch in ${label}: ${key}`);
    }
    assert.equal(counts.failures + counts.errors, 0, `Tests failed in ${label}`);
    return identities;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const summary = verifyRepeatability(JSON.parse(fs.readFileSync(process.argv[2], 'utf8')),
        JSON.parse(fs.readFileSync(process.argv[3], 'utf8')), Number(process.argv[4]), Number(process.argv[5]));
    console.log(`Repeat run reproduces baseline: ${JSON.stringify(summary)}; skips reported separately, not counted as passes.`);
}
