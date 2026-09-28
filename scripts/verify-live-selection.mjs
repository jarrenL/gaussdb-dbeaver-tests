import assert from 'node:assert/strict';

const testClass = 'org.jkiss.dbeaver.ext.gaussdb.debug.core.GaussDBHistoricalJdbcLiveTest';
export function expectedLiveCases(setQueries, sessions = false) {
    assert(!(setQueries && sessions), 'Conflicting live selections');
    const names = sessions ? ['realOwnSessionPreservesBackendIdentityAndDatabase()'] : setQueries
        ? [1, 2, 3, 4].map(i => `parenthesizedSetResultsPreserveLabelsTypesNullsAndOrder(String)[${i}]`)
        : [
            'realRecursivePlanPreservesWorkTableAndCteNodes()',
            'realWindowPlanPreservesSortAndWindowNodes()',
            'realIndexPlanPreservesIndexScanUnderDistributedParent()',
            'realAnalyzePlanPreservesActualRowsTimingAndLoops()',
            'realPlanAnalysisPreservesPendingUserWrites(boolean)[1]',
            'realPlanAnalysisPreservesPendingUserWrites(boolean)[2]'
        ];
    return names.map(name => `${testClass}/${name}`);
}

const attributes = text => Object.fromEntries([...text.matchAll(/([\w-]+)="([^"]*)"/g)]
    .map(match => [match[1], match[2]]));

// Validates the JUnit Console legacy XML format, not arbitrary XML documents.
export function verifyLiveSelection(reports, expected, startedAt) {
    assert(Number.isFinite(startedAt), 'Invalid start timestamp');
    assert(expected.length > 0 && new Set(expected).size === expected.length, 'Invalid expected selection');
    assert(reports.length > 0, 'Missing reports');
    const identities = [];
    for (const report of reports) {
        assert(Number.isFinite(report.modified) && report.modified >= startedAt, 'Stale report');
        // Output and stack traces may contain tag-like text; never treat CDATA as test results.
        const xml = report.xml.replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, '').replace(/<!--[\s\S]*?-->/g, '');
        const suite = xml.match(/<testsuite\b([^>]*)>/);
        assert(suite && /<\/testsuite>\s*$/.test(xml), 'Incomplete suite');
        const counts = attributes(suite[1]);
        for (const key of ['tests', 'failures', 'errors', 'skipped']) {
            assert(/^\d+$/.test(counts[key] ?? '') && Number.isSafeInteger(Number(counts[key])), 'Invalid counter');
        }
        const cases = [...xml.matchAll(/<testcase\b([^>]*?)(?:\/>|>([\s\S]*?)<\/testcase>)/g)];
        assert.equal(cases.length, Number(counts.tests), 'Incomplete case list');
        const actual = {failures: 0, errors: 0, skipped: 0};
        for (const [, header, body = ''] of cases) {
            const item = attributes(header);
            assert(item.classname && item.name, 'Missing case identity');
            identities.push(`${item.classname}/${item.name}`);
            if (/<error\b/.test(body)) actual.errors++;
            else if (/<failure\b/.test(body)) actual.failures++;
            else if (/<skipped\b/.test(body)) actual.skipped++;
        }
        for (const key of Object.keys(actual)) {
            assert.equal(actual[key], Number(counts[key]), 'Counter mismatch');
            assert.equal(actual[key], 0, 'Live case failed or skipped');
        }
    }
    assert.equal(new Set(identities).size, identities.length, 'Duplicate case');
    assert.deepEqual(identities.sort(), [...expected].sort(), 'Incomplete or unexpected selection');
    return identities.length;
}
