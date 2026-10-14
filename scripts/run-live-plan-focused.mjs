import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {focusedRunnerPaths, resolvedBundleEntries, temporaryPrefix} from './focused-runner-paths.mjs';
import {expectedLiveCases, verifyLiveSelection} from './verify-live-selection.mjs';
const setQueries = process.argv.includes('--set-queries');
const sessions = process.argv.includes('--sessions');
if (setQueries && sessions) throw new Error('Choose only one focused live selection');
if (!setQueries && !sessions && process.env.GAUSSDB_HISTORY_ALLOW_DDL !== 'YES') {
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
const {root, commonClasses, javaCommand, mockitoJar, byteBuddyJar,
 byteBuddyAgentJar, objenesisJar, junitConsoleJar} = focusedRunnerPaths();
const output = fs.mkdtempSync(temporaryPrefix('live-plan-focused-'));
const cp = [output];
for (const name of fs.readdirSync(root + '/plugins')) {
    const classes = root + '/plugins/' + name + '/target/classes';
    if (fs.existsSync(classes)) cp.push(classes);
}
cp.push(commonClasses);
// Resolve dependencies from the current test platform, not an old temporary GUI installation.
for (const file of resolvedBundleEntries(root, process.env,
 ['org.jkiss.dbeaver.test.platform', 'org.jkiss.dbeaver.ext.gaussdb.debug.test'])) {
 if (!/\.source-|junit|mockito|byte.buddy|opentest4j/i.test(path.basename(file)) && !cp.includes(file)) cp.push(file);
}
const dirs = [
 root + '/test/org.jkiss.dbeaver.ext.gaussdb.test/target/work/plugins/org.jkiss.bundle.apache.poi_5.4.2/lib'
];
for (const dir of dirs) for (const name of fs.readdirSync(dir)) {
 if (name.endsWith('.jar') && !/junit|mockito|byte.buddy|opentest4j/i.test(name)) cp.push(path.join(dir, name));
}
cp.push(mockitoJar);
cp.push(byteBuddyJar);
const agent = byteBuddyAgentJar;
cp.push(agent);
cp.push(objenesisJar);
const consoleJar = junitConsoleJar;
cp.push(consoleJar);
for (const name of fs.readdirSync(root + '/test')) {
 const classes = root + '/test/' + name + '/target/classes';
 if (fs.existsSync(classes)) cp.push(classes);
}
const source = root + '/test/org.jkiss.dbeaver.ext.gaussdb.debug.test/src/org/jkiss/dbeaver/ext/gaussdb/debug/core/GaussDBHistoricalJdbcLiveTest.java';
function run(bin, args) {
 const result = spawnSync(javaCommand(bin), args, {stdio: 'inherit'});
 if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log('Focused output: ' + output);
run('javac', ['--release', '21', '-cp', cp.join(path.delimiter), '-d', output, source,
 root + '/plugins/org.jkiss.dbeaver.ext.postgresql/src/org/jkiss/dbeaver/ext/postgresql/model/session/PostgreSession.java',
 root + '/plugins/org.jkiss.dbeaver.ext.postgresql/src/org/jkiss/dbeaver/ext/postgresql/model/session/PostgreSessionManager.java',
 root + '/plugins/org.jkiss.dbeaver.model/src/org/jkiss/dbeaver/model/sql/SQLQuery.java',
 root + '/plugins/org.jkiss.dbeaver.ext.postgresql/src/org/jkiss/dbeaver/ext/postgresql/model/plan/PostgreExecutionPlan.java',
 root + '/plugins/org.jkiss.dbeaver.ext.postgresql/src/org/jkiss/dbeaver/ext/postgresql/model/plan/PostgreQueryPlaner.java',
 root + '/plugins/org.jkiss.dbeaver.ext.postgresql/src/org/jkiss/dbeaver/ext/postgresql/model/plan/PostgrePlanNodeExternal.java',
 root + '/plugins/org.jkiss.dbeaver.ext.postgresql/src/org/jkiss/dbeaver/ext/postgresql/model/plan/PostgrePlanNodeXML.java',
 root + '/plugins/org.jkiss.dbeaver.ext.postgresql/src/org/jkiss/dbeaver/ext/postgresql/model/plan/PostgrePlanNodeBase.java']);
const startedAt = Date.now();
run('java', ['-javaagent:' + agent, '-Djava.awt.headless=true', '-cp', cp.join(path.delimiter),
 'org.junit.platform.console.ConsoleLauncher', 'execute', ...(sessions ? [
 'realOwnSessionPreservesBackendIdentityAndDatabase'
 ] : setQueries ? [
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
const reports = fs.readdirSync(path.join(output, 'reports')).filter(name => name.endsWith('.xml')).map(name => {
 const file = path.join(output, 'reports', name);
 return {xml: fs.readFileSync(file, 'utf8'), modified: fs.statSync(file).mtimeMs};
});
const executed = verifyLiveSelection(reports, expectedLiveCases(setQueries, sessions), startedAt);
console.log('Verified live tests without skips: ' + executed);
