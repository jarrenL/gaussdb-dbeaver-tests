import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const setQueries = process.argv.includes('--set-queries');
if (!setQueries && process.env.GAUSSDB_HISTORY_ALLOW_DDL !== 'YES') {
 console.error('Isolated live-plan tests require GAUSSDB_HISTORY_ALLOW_DDL=YES.');
 process.exit(2);
}
for (const key of ['GAUSSDB_HISTORY_CONNECTION', 'GAUSSDB_HISTORY_JDBC']) {
 const file = process.env[key];
 if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
  console.error('Live-plan prerequisite missing: ' + key + ' must reference an existing file. No tests started.');
  process.exit(2);
 }
}
const root = process.env.DBEAVER_REPO || '/Users/lj/Documents/GaussDB/dbeaver-icbc-26.1.5';
const java = '/Library/Java/JavaVirtualMachines/jdk-25.jdk/Contents/Home/bin/';
const output = fs.mkdtempSync('/tmp/live-plan-focused-');
const cp = [output];
for (const name of fs.readdirSync(root + '/plugins')) {
    const classes = root + '/plugins/' + name + '/target/classes';
    if (fs.existsSync(classes)) cp.push(classes);
}
cp.push('/Users/lj/Documents/GaussDB/dbeaver-common/modules/org.jkiss.utils/target/classes');
// Resolve dependencies from the current test platform, not an old temporary GUI installation.
for (const module of ['org.jkiss.dbeaver.test.platform', 'org.jkiss.dbeaver.ext.gaussdb.debug.test']) {
 const config = fs.readFileSync(path.join(root, 'test', module, 'target/work/configuration/config.ini'), 'utf8');
 const bundles = config.split(/\r?\n/).find(line => line.startsWith('osgi.bundles='));
 const framework = config.split(/\r?\n/).find(line => line.startsWith('osgi.framework='));
 if (!bundles || !framework) throw new Error('Missing resolved OSGi configuration');
 for (const entry of [framework.slice('osgi.framework='.length), ...bundles.slice('osgi.bundles='.length).split(',')]) {
  const file = entry.replaceAll('\\:', ':').replace(/^(?:reference:)?file:/, '').replace(/@\d+(?::start)?$/, '');
  if (!path.isAbsolute(file) || !fs.existsSync(file)) throw new Error('Missing resolved bundle: ' + file);
  if (!/\.source-|junit|mockito|byte.buddy|opentest4j/i.test(path.basename(file)) && !cp.includes(file)) cp.push(file);
 }
}
const dirs = [
 root + '/test/org.jkiss.dbeaver.ext.gaussdb.test/target/work/plugins/org.jkiss.bundle.apache.poi_5.4.2/lib'
];
for (const dir of dirs) for (const name of fs.readdirSync(dir)) {
 if (name.endsWith('.jar') && !/junit|mockito|byte.buddy|opentest4j/i.test(name)) cp.push(path.join(dir, name));
}
cp.push('/Users/lj/.m2/repository/p2/osgi/bundle/org.mockito.mockito-core/4.8.1/org.mockito.mockito-core-4.8.1.jar');
cp.push('/Users/lj/.m2/repository/p2/osgi/bundle/net.bytebuddy.byte-buddy/1.18.8/net.bytebuddy.byte-buddy-1.18.8.jar');
const agent = '/Users/lj/.m2/repository/p2/osgi/bundle/net.bytebuddy.byte-buddy-agent/1.18.8/net.bytebuddy.byte-buddy-agent-1.18.8.jar';
cp.push(agent);
cp.push('/Users/lj/.m2/repository/p2/osgi/bundle/org.objenesis/3.2.0/org.objenesis-3.2.0.jar');
const consoleJar = '/Users/lj/.m2/repository/org/junit/platform/junit-platform-console-standalone/1.13.1/junit-platform-console-standalone-1.13.1.jar';
cp.push(consoleJar);
for (const name of fs.readdirSync(root + '/test')) {
 const classes = root + '/test/' + name + '/target/classes';
 if (fs.existsSync(classes)) cp.push(classes);
}
const source = root + '/test/org.jkiss.dbeaver.ext.gaussdb.debug.test/src/org/jkiss/dbeaver/ext/gaussdb/debug/core/GaussDBHistoricalJdbcLiveTest.java';
function run(bin, args) {
 const result = spawnSync(java + bin, args, {stdio: 'inherit'});
 if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log('Focused output: ' + output);
run('javac', ['--release', '21', '-cp', cp.join(':'), '-d', output, source,
 root + '/plugins/org.jkiss.dbeaver.model/src/org/jkiss/dbeaver/model/sql/SQLQuery.java',
 root + '/plugins/org.jkiss.dbeaver.ext.postgresql/src/org/jkiss/dbeaver/ext/postgresql/model/plan/PostgreExecutionPlan.java',
 root + '/plugins/org.jkiss.dbeaver.ext.postgresql/src/org/jkiss/dbeaver/ext/postgresql/model/plan/PostgreQueryPlaner.java',
 root + '/plugins/org.jkiss.dbeaver.ext.postgresql/src/org/jkiss/dbeaver/ext/postgresql/model/plan/PostgrePlanNodeExternal.java',
 root + '/plugins/org.jkiss.dbeaver.ext.postgresql/src/org/jkiss/dbeaver/ext/postgresql/model/plan/PostgrePlanNodeXML.java',
 root + '/plugins/org.jkiss.dbeaver.ext.postgresql/src/org/jkiss/dbeaver/ext/postgresql/model/plan/PostgrePlanNodeBase.java']);
run('java', ['-javaagent:' + agent, '-Djava.awt.headless=true', '-cp', cp.join(':'),
 'org.junit.platform.console.ConsoleLauncher', 'execute', ...(setQueries ? [
 'parenthesizedSetResultsPreserveLabelsTypesNullsAndOrder(java.lang.String)'
 ] : [
 'realRecursivePlanPreservesWorkTableAndCteNodes',
 'realWindowPlanPreservesSortAndWindowNodes',
 'realIndexPlanPreservesIndexScanUnderDistributedParent',
 'realAnalyzePlanPreservesActualRowsTimingAndLoops',
 'realPlanAnalysisPreservesPendingUserWrites(boolean)'
 ]).flatMap(name => ['--select-method', 'org.jkiss.dbeaver.ext.gaussdb.debug.core.GaussDBHistoricalJdbcLiveTest#' + name]),
 '--reports-dir', path.join(output, 'reports'), '--fail-if-no-tests',
 '--details=summary', '--disable-banner']);
let executed = 0;
for (const name of fs.readdirSync(path.join(output, 'reports')).filter(name => name.endsWith('.xml'))) {
 const xml = fs.readFileSync(path.join(output, 'reports', name), 'utf8');
 const header = xml.match(/<testsuite\b([^>]*)>/)?.[1];
 if (!header) throw new Error('Missing JUnit suite header');
 const fields = Object.fromEntries([...header.matchAll(/([\w-]+)="([^"]*)"/g)].map(match => [match[1], match[2]]));
 for (const key of ['tests', 'failures', 'errors', 'skipped']) {
  if (!/^\d+$/.test(fields[key] ?? '')) throw new Error('Invalid report counter: ' + key);
 }
 if (Number(fields.failures) || Number(fields.errors) || Number(fields.skipped)) {
  throw new Error('Live selection has failures, errors, or skipped tests');
 }
 executed += Number(fields.tests);
}
if (executed === 0 || setQueries && executed !== 4) throw new Error('Incomplete live test selection: ' + executed);
console.log('Verified live tests without skips: ' + executed);
