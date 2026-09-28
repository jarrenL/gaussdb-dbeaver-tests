import test from 'node:test';
import assert from 'node:assert/strict';
import {expectedLiveCases, verifyLiveSelection} from './verify-live-selection.mjs';

const expected = expectedLiveCases(true);
function fixture(identities = expected, body = '', overrides = {}) {
    const counts = {tests: identities.length, errors: 0, failures: 0, skipped: 0, ...overrides};
    return {modified: 2000, xml: `<testsuite ${Object.entries(counts).map(([k,v]) => `${k}="${v}"`).join(' ')}>`
        + identities.map((identity, i) => {
            const slash = identity.lastIndexOf('/');
            return `<testcase classname="${identity.slice(0, slash)}" name="${identity.slice(slash + 1)}">`
                + (i === 0 ? body : '') + '</testcase>';
        }).join('') + '</testsuite>'};
}
test('accepts exactly the four live cases and empty engine reports', () => {
    assert.equal(verifyLiveSelection([fixture(), fixture([])], expected, 1000), 4);
});
test('accepts the separate six-case plan selection', () => {
    const plan = expectedLiveCases(false);
    assert.equal(verifyLiveSelection([fixture(plan)], plan, 1000), 6);
});
test('rejects absent and zero-test reports', () => {
    assert.throws(() => verifyLiveSelection([], expected, 1000), /Missing reports/);
    assert.throws(() => verifyLiveSelection([fixture([])], expected, 1000), /selection/);
});
test('rejects partial selection even if all available cases pass', () => {
    assert.throws(() => verifyLiveSelection([fixture(expected.slice(1))], expected, 1000), /selection/);
});
test('rejects different cases with the same total', () => {
    assert.throws(() => verifyLiveSelection([fixture(expected.map(n => n.replace('(String)', '(int)')))], expected, 1000), /selection/);
});
test('rejects duplicates', () => {
    assert.throws(() => verifyLiveSelection([fixture(), fixture()], expected, 1000), /Duplicate/);
});
test('rejects old reports', () => {
    assert.throws(() => verifyLiveSelection([fixture()], expected, 3000), /Stale/);
});
for (const [tag, counter] of [['failure', 'failures'], ['error', 'errors'], ['skipped', 'skipped']]) {
    test(`rejects actual ${tag}`, () => {
        assert.throws(() => verifyLiveSelection([fixture(expected, `<${tag}/>`, {[counter]: 1})], expected, 1000), /failed or skipped/);
    });
}
test('rejects counters hiding an actual failure', () => {
    assert.throws(() => verifyLiveSelection([fixture(expected, '<failure/>')], expected, 1000), /Counter mismatch/);
});
test('rejects truncated or inconsistent reports', () => {
    const report = fixture();
    report.xml = report.xml.replace('</testsuite>', '');
    assert.throws(() => verifyLiveSelection([report], expected, 1000), /Incomplete suite/);
    assert.throws(() => verifyLiveSelection([fixture(expected, '', {tests: 5})], expected, 1000), /case list/);
    assert.throws(() => verifyLiveSelection([fixture(expected, '', {tests: 'NaN'})], expected, 1000), /Invalid counter/);
});
test('does not interpret CDATA output as a test error', () => {
    assert.equal(verifyLiveSelection([fixture(expected, '<system-out><![CDATA[<failure/>]]></system-out>')], expected, 1000), 4);
});
