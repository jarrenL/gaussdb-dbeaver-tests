#!/usr/bin/env bash
set -euo pipefail
dbeaver_repo=${1:?Usage: run-dbeaver-tests.sh /absolute/path/to/dbeaver}
test_repo=$(cd "$(dirname "$0")/.." && pwd)
test -f "$dbeaver_repo/tools/gaussdb-review-reactor.txt"
test -f "$dbeaver_repo/tools/gaussdb-test-results.mjs"
mkdir -p "$test_repo/results"
result_dir=$(mktemp -d "$test_repo/results/run-XXXXXX")
started_ms=$(node -e 'console.log(Date.now())')
cd "$dbeaver_repo"
mvn -o -fae verify -f product/aggregate/pom.xml \
  -pl "$(paste -sd, tools/gaussdb-review-reactor.txt)" \
  -Dskip-checkstyle=true -Dspotless.check.skip=true \
  -l "$result_dir/maven.log"
node tools/gaussdb-test-results.mjs "$result_dir/results.json"
node --input-type=module - "$result_dir/results.json" "$started_ms" <<'JS'
import fs from 'node:fs';
import assert from 'node:assert/strict';
const report = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
assert(report.reports.length > 0, 'No reports');
for (const item of report.reports) {
    assert(Date.parse(item.modified) >= Number(process.argv[3]), `Stale report: ${item.file}`);
}
assert.equal(report.totals.failures + report.totals.errors, 0);
console.log(`Verified fresh results: ${JSON.stringify(report.totals)}; skipped tests are not passes.`);
JS
printf 'Local results: %s\n' "$result_dir"
