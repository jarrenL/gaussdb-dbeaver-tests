#!/usr/bin/env bash
set -euo pipefail
dbeaver_repo=${1:?Usage: run-dbeaver-tests.sh /absolute/path/to/dbeaver}
test_repo=$(cd "$(dirname "$0")/.." && pwd)
test -f "$dbeaver_repo/tools/gaussdb-review-reactor.txt"
test -f "$dbeaver_repo/tools/gaussdb-test-results.mjs"
mkdir -p "$test_repo/results"
result_dir=$(mktemp -d "$test_repo/results/run-XXXXXX")
started_ms=$(node -e 'console.log(Date.now())')
maven_command=(mvn)
if [[ -n "${DBEAVER_MAVEN_REPOSITORY:-}" ]]; then
  if [[ "$DBEAVER_MAVEN_REPOSITORY" != /* || ! -d "$DBEAVER_MAVEN_REPOSITORY" ]]; then
    printf 'DBEAVER_MAVEN_REPOSITORY must be an existing absolute directory\n' >&2
    exit 2
  fi
  maven_command+=("-Dmaven.repo.local=$DBEAVER_MAVEN_REPOSITORY")
fi
cd "$dbeaver_repo"
"${maven_command[@]}" -o -fae verify -f product/aggregate/pom.xml \
  -pl "$(paste -sd, tools/gaussdb-review-reactor.txt)" \
  -Dskip-checkstyle=true -Dspotless.check.skip=true \
  -l "$result_dir/maven.log"
node tools/gaussdb-test-results.mjs "$result_dir/results.json"
node "$test_repo/scripts/verify-regression-results.mjs" "$result_dir/results.json" "$started_ms"
printf 'Local results: %s\n' "$result_dir"
