import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const root = process.env.DBEAVER_REPO || '/Users/lj/Documents/GaussDB/dbeaver-icbc-26.1.5';
const java = '/Library/Java/JavaVirtualMachines/jdk-25.jdk/Contents/Home/bin/';
const output = fs.mkdtempSync('/tmp/shared-focused-');
const cp = [output];
for (const name of fs.readdirSync(root + '/plugins')) {
    const classes = root + '/plugins/' + name + '/target/classes';
    if (fs.existsSync(classes)) cp.push(classes);
}
cp.push('/Users/lj/Documents/GaussDB/dbeaver-common/modules/org.jkiss.utils/target/classes');
const dirs = [
 '/tmp/history-bot-build.IP5Su0/plugins',
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
const source = root + '/test/org.jkiss.dbeaver.ext.postgresql.test/src/org/jkiss/dbeaver/ext/postgresql/model/plan/PostgreXmlPlanHierarchyTest.java';
const savedSource = root + '/test/org.jkiss.dbeaver.ext.postgresql.test/src/org/jkiss/dbeaver/ext/postgresql/model/plan/PostgreSavedPlanTest.java';
const coreSourceRoot = root + '/test/org.jkiss.dbeaver.ext.gaussdb.test/src';
const liveOnly = new Set(['GaussDBReviewLiveTest.java', 'GaussDBDumpAllLiveTest.java', 'GaussDBNativeLiveTest.java',
 'GaussDBSessionLiveTest.java', 'GaussDBHistoricalJdbcLiveTest.java']);
function javaSources(directory) {
 return fs.readdirSync(directory, {withFileTypes: true}).flatMap(entry => {
  const file = path.join(directory, entry.name);
  return entry.isDirectory() ? javaSources(file) : entry.name.endsWith('.java') && !liveOnly.has(entry.name) ? [file] : [];
 });
}
const additionalSources = [
 ...(process.argv.includes('--gauss-core') ? javaSources(coreSourceRoot) : []),
 ...(process.argv.includes('--gauss-debug') ? [
  ...javaSources(root + '/test/org.jkiss.dbeaver.ext.gaussdb.debug.test/src'),
  ...javaSources(root + '/plugins/org.jkiss.dbeaver.ext.gaussdb.debug.core/src'),
  ...javaSources(root + '/plugins/org.jkiss.dbeaver.ext.gaussdb.debug.ui/src'),
  ...javaSources(root + '/plugins/org.jkiss.dbeaver.debug.core/src')
 ] : [])
];
const additionalClasses = additionalSources.filter(file => file.startsWith(root + '/test/') && file.endsWith('Test.java'))
 .map(file => file.slice(file.indexOf('/src/') + 5).replace(/\.java$/, '').split(path.sep).join('.'));
if (additionalSources.length) {
 console.log('Additional GaussDB test classes selected: ' + additionalClasses.length);
 console.log('Live-only classes not executed in this mode: ' + [...liveOnly].join(', '));
}
function run(bin, args) {
 const result = spawnSync(java + bin, args, {stdio: 'inherit'});
 if (result.status !== 0) process.exit(result.status ?? 1);
 if (bin === 'javac') fs.writeFileSync(path.join(output, 'compiled-sources.json'),
  JSON.stringify({root, sources: [...new Set(args.filter(value => value.endsWith('.java')))]}, null, 2));
}
console.log('Focused output: ' + output);
run('javac', ['--release', '21', '-cp', cp.join(':'), '-d', output, source, savedSource,
 root + '/plugins/org.jkiss.dbeaver.model/src/org/jkiss/dbeaver/runtime/qm/QueryHistoryStore.java',
 root + '/test/org.jkiss.dbeaver.test.platform/src/org/jkiss/dbeaver/runtime/qm/QueryHistoryStoreTest.java',
 ...['PersistentQueryHistory', 'QueryHistoryEventMapper', 'QueryHistoryPersistenceService', 'QMRegistryImpl', 'QMMCollectorImpl']
  .map(name => root + '/plugins/org.jkiss.dbeaver.model/src/org/jkiss/dbeaver/runtime/qm/' + name + '.java'),
 ...['PersistentQueryHistoryTest', 'QueryHistoryEventMapperTest', 'QueryHistoryPersistenceServiceTest']
  .map(name => root + '/test/org.jkiss.dbeaver.test.platform/src/org/jkiss/dbeaver/runtime/qm/' + name + '.java'),
 root + '/plugins/org.jkiss.dbeaver.registry/src/org/jkiss/dbeaver/registry/FilterSerializer.java',
 root + '/plugins/org.jkiss.dbeaver.model/src/org/jkiss/dbeaver/model/access/DBAAuthProfile.java',
 root + '/plugins/org.jkiss.dbeaver.model/src/org/jkiss/dbeaver/model/net/DBWNetworkProfile.java',
 root + '/plugins/org.jkiss.dbeaver.model/src/org/jkiss/dbeaver/model/net/DBWHandlerConfiguration.java',
 root + '/test/org.jkiss.dbeaver.test.platform/src/org/jkiss/dbeaver/model/NetworkProfileContractsTest.java',
 root + '/plugins/org.jkiss.dbeaver.model/src/org/jkiss/dbeaver/model/connection/DBPConfigurationProfile.java',
 root + '/test/org.jkiss.dbeaver.test.platform/src/org/jkiss/dbeaver/model/AuthProfileSecretStorageTest.java',
 root + '/plugins/org.jkiss.dbeaver.registry/src/org/jkiss/dbeaver/registry/FilterMapping.java',
 root + '/plugins/org.jkiss.dbeaver.model/src/org/jkiss/dbeaver/model/struct/DBSObjectFilter.java',
 root + '/test/org.jkiss.dbeaver.test.platform/src/org/jkiss/dbeaver/registry/UserFilterExportRoundTripTest.java',
 root + '/plugins/org.jkiss.dbeaver.registry/src/org/jkiss/dbeaver/registry/UserDBSObjectFilterUtils.java',
 root + '/test/org.jkiss.dbeaver.test.platform/src/org/jkiss/dbeaver/model/ConnectionFilterSerializationTest.java',
 root + '/plugins/org.jkiss.dbeaver.tasks.native/src/org/jkiss/dbeaver/tasks/nativetool/AbstractNativeToolHandler.java',
 root + '/plugins/org.jkiss.dbeaver.ext.postgresql/src/org/jkiss/dbeaver/ext/postgresql/tasks/PostgreNativeToolHandler.java',
 root + '/plugins/org.jkiss.dbeaver.ext.postgresql/src/org/jkiss/dbeaver/ext/postgresql/tasks/PostgreDatabaseBackupHandler.java',
 root + '/plugins/org.jkiss.dbeaver.ext.postgresql/src/org/jkiss/dbeaver/ext/postgresql/tasks/PostgreDatabaseRestoreHandler.java',
 root + '/plugins/org.jkiss.dbeaver.ext.postgresql/src/org/jkiss/dbeaver/ext/postgresql/tasks/PostgreScriptExecuteHandler.java',
 root + '/test/org.jkiss.dbeaver.ext.gaussdb.test/src/org/jkiss/dbeaver/ext/gaussdb/model/GaussDBNativePasswordTest.java',
 root + '/test/org.jkiss.dbeaver.ext.gaussdb.test/src/org/jkiss/dbeaver/ext/gaussdb/model/GaussDBBackupPublishTest.java',
 root + '/test/org.jkiss.dbeaver.ext.gaussdb.test/src/org/jkiss/dbeaver/ext/gaussdb/model/GaussDBNativeOutputTest.java',
 root + '/test/org.jkiss.dbeaver.ext.gaussdb.test/src/org/jkiss/dbeaver/ext/gaussdb/model/GaussDBExcelExportTest.java',
 root + '/test/org.jkiss.dbeaver.ext.gaussdb.test/src/org/jkiss/dbeaver/ext/gaussdb/model/GaussDBCSVReplacementTest.java',
 root + '/test/org.jkiss.dbeaver.ext.gaussdb.test/src/org/jkiss/dbeaver/ext/gaussdb/model/GaussDBStreamExportFailureTest.java',
 root + '/plugins/org.jkiss.dbeaver.data.office/src/org/jkiss/dbeaver/data/office/export/DataExporterXLSX.java',
 root + '/plugins/org.jkiss.dbeaver.data.transfer/src/org/jkiss/dbeaver/tools/transfer/stream/exporter/DataExporterCSV.java',
 root + '/plugins/org.jkiss.dbeaver.data.transfer/src/org/jkiss/dbeaver/tools/transfer/DataTransferJob.java',
 root + '/plugins/org.jkiss.dbeaver.data.transfer/src/org/jkiss/dbeaver/tools/transfer/stream/StreamTransferConsumer.java',
 root + '/plugins/org.jkiss.dbeaver.model/src/org/jkiss/dbeaver/utils/VersionUtils.java',
 root + '/plugins/org.jkiss.dbeaver.model/src/org/jkiss/dbeaver/model/sql/SQLQuery.java',
 root + '/plugins/org.jkiss.dbeaver.ext.gaussdb/src/org/jkiss/dbeaver/ext/gaussdb/model/data/GaussDBBinaryValueHandler.java',
 root + '/plugins/org.jkiss.dbeaver.ext.gaussdb/src/org/jkiss/dbeaver/ext/gaussdb/model/data/GaussDBValueHandlerProvider.java',
 root + '/plugins/org.jkiss.dbeaver.model.jdbc/src/org/jkiss/dbeaver/model/impl/jdbc/data/JDBCContentBLOB.java',
 root + '/plugins/org.jkiss.dbeaver.model.jdbc/src/org/jkiss/dbeaver/model/impl/jdbc/data/JDBCContentBytes.java',
 root + '/test/org.jkiss.dbeaver.test.platform/src/org/jkiss/dbeaver/model/impl/jdbc/data/JDBCContentBytesReadTest.java',
 root + '/plugins/org.jkiss.dbeaver.model.jdbc/src/org/jkiss/dbeaver/model/impl/jdbc/data/JDBCContentXML.java',
 root + '/test/org.jkiss.dbeaver.test.platform/src/org/jkiss/dbeaver/model/impl/jdbc/data/JDBCContentXMLReadTest.java',
 root + '/plugins/org.jkiss.dbeaver.model/src/org/jkiss/dbeaver/model/data/storage/BytesContentStorage.java',
 root + '/test/org.jkiss.dbeaver.test.platform/src/org/jkiss/dbeaver/model/data/storage/BytesContentStorageTest.java',
 root + '/plugins/org.jkiss.dbeaver.model/src/org/jkiss/dbeaver/model/data/storage/StringContentStorage.java',
 root + '/test/org.jkiss.dbeaver.test.platform/src/org/jkiss/dbeaver/model/data/storage/StringContentStorageTest.java',
 root + '/test/org.jkiss.dbeaver.ext.gaussdb.test/src/org/jkiss/dbeaver/ext/gaussdb/model/data/GaussDBBinaryValueHandlerTest.java',
 root + '/plugins/org.jkiss.dbeaver.model/src/org/jkiss/dbeaver/model/sql/SQLQueryRecoveryPolicy.java',
 root + '/plugins/org.jkiss.dbeaver.model/src/org/jkiss/dbeaver/model/sql/parser/SQLSemanticProcessor.java',
 root + '/test/org.jkiss.dbeaver.test.platform/src/org/jkiss/dbeaver/model/sql/SQLQueryRecoveryPolicyTest.java',
 root + '/test/org.jkiss.dbeaver.ext.gaussdb.test/src/org/jkiss/dbeaver/ext/gaussdb/model/GaussDBSQLSafetyTest.java',
 root + '/plugins/org.jkiss.dbeaver.model/src/org/jkiss/dbeaver/model/sql/SQLSelectItem.java',
 root + '/plugins/org.jkiss.dbeaver.ext.gaussdb/src/org/jkiss/dbeaver/ext/gaussdb/model/GaussDBDialect.java',
 root + '/test/org.jkiss.dbeaver.ext.gaussdb.test/src/org/jkiss/dbeaver/ext/gaussdb/model/GaussDBProjectionMetadataTest.java',
 root + '/plugins/org.jkiss.dbeaver.model/src/org/jkiss/dbeaver/DBDatabaseException.java',
 root + '/plugins/org.jkiss.dbeaver.model/src/org/jkiss/dbeaver/model/exec/DBCException.java',
 root + '/plugins/org.jkiss.dbeaver.model/src/org/jkiss/dbeaver/model/sql/DBSQLException.java',
 root + '/plugins/org.jkiss.dbeaver.model/src/org/jkiss/dbeaver/model/runtime/DefaultProgressMonitor.java',
 root + '/plugins/org.jkiss.dbeaver.model/src/org/jkiss/dbeaver/model/runtime/ProxyProgressMonitor.java',
 root + '/plugins/org.jkiss.dbeaver.model/src/org/jkiss/dbeaver/model/runtime/SubTaskProgressMonitor.java',
 root + '/plugins/org.jkiss.dbeaver.model/src/org/jkiss/dbeaver/model/impl/data/formatters/DateTimeDataFormatter.java',
 root + '/test/org.jkiss.dbeaver.test.platform/src/org/jkiss/dbeaver/utils/VersionUtilsTest.java',
 root + '/test/org.jkiss.dbeaver.test.platform/src/org/jkiss/dbeaver/utils/DatabaseExceptionContractTest.java',
 root + '/test/org.jkiss.dbeaver.test.platform/src/org/jkiss/dbeaver/utils/ProgressMonitorContractTest.java',
 root + '/test/org.jkiss.dbeaver.test.platform/src/org/jkiss/dbeaver/model/impl/data/formatters/DateTimeDataFormatterLocaleTest.java',
 root + '/test/org.jkiss.dbeaver.ext.postgresql.test/src/org/jkiss/dbeaver/ext/postgresql/model/plan/PostgrePlanResponseTest.java',
 root + '/test/org.jkiss.dbeaver.ext.postgresql.test/src/org/jkiss/dbeaver/ext/postgresql/model/plan/PostgrePlanTransactionTest.java',
 root + '/plugins/org.jkiss.dbeaver.ext.postgresql/src/org/jkiss/dbeaver/ext/postgresql/model/plan/PostgreExecutionPlan.java',
 root + '/plugins/org.jkiss.dbeaver.ext.postgresql/src/org/jkiss/dbeaver/ext/postgresql/model/plan/PostgreQueryPlaner.java',
 root + '/plugins/org.jkiss.dbeaver.ext.postgresql/src/org/jkiss/dbeaver/ext/postgresql/model/plan/PostgrePlanNodeExternal.java',
 root + '/plugins/org.jkiss.dbeaver.ext.postgresql/src/org/jkiss/dbeaver/ext/postgresql/model/plan/PostgrePlanNodeXML.java',
 root + '/plugins/org.jkiss.dbeaver.ext.postgresql/src/org/jkiss/dbeaver/ext/postgresql/model/plan/PostgrePlanNodeText.java',
 root + '/plugins/org.jkiss.dbeaver.ext.postgresql/src/org/jkiss/dbeaver/ext/postgresql/model/plan/PostgrePlanNodeBase.java',
 ...additionalSources]);
if (process.argv.includes('--compile-only')) {
 console.log('Compilation only; no tests executed. Use compiled-sources.json with the OSGi runner.');
 process.exit(0);
}
run('java', ['-javaagent:' + agent, '-Djava.awt.headless=true', '-cp', cp.join(':'),
 'org.junit.platform.console.ConsoleLauncher', 'execute', '--select-class',
 'org.jkiss.dbeaver.ext.postgresql.model.plan.PostgreXmlPlanHierarchyTest', '--select-class',
 'org.jkiss.dbeaver.ext.postgresql.model.plan.PostgreSavedPlanTest', '--select-class',
 'org.jkiss.dbeaver.ext.postgresql.model.plan.PostgrePlanResponseTest', '--select-class',
 'org.jkiss.dbeaver.ext.postgresql.model.plan.PostgrePlanTransactionTest',
 '--select-class', 'org.jkiss.dbeaver.utils.VersionUtilsTest',
 '--select-class', 'org.jkiss.dbeaver.model.impl.jdbc.data.JDBCContentBytesReadTest',
 '--select-class', 'org.jkiss.dbeaver.model.impl.jdbc.data.JDBCContentXMLReadTest',
 '--select-class', 'org.jkiss.dbeaver.model.data.storage.BytesContentStorageTest',
 '--select-class', 'org.jkiss.dbeaver.model.data.storage.StringContentStorageTest',
 '--select-class', 'org.jkiss.dbeaver.runtime.qm.QueryHistoryStoreTest',
 ...['PersistentQueryHistoryTest', 'QueryHistoryEventMapperTest', 'QueryHistoryPersistenceServiceTest']
  .flatMap(name => ['--select-class', 'org.jkiss.dbeaver.runtime.qm.' + name]),
 '--select-class', 'org.jkiss.dbeaver.ext.gaussdb.model.GaussDBProjectionMetadataTest',
 '--select-class', 'org.jkiss.dbeaver.ext.gaussdb.model.data.GaussDBBinaryValueHandlerTest',
 '--select-class', 'org.jkiss.dbeaver.model.sql.SQLQueryRecoveryPolicyTest',
 '--select-class', 'org.jkiss.dbeaver.ext.gaussdb.model.GaussDBSQLSafetyTest',
 '--select-class', 'org.jkiss.dbeaver.model.ConnectionFilterSerializationTest',
 '--select-class', 'org.jkiss.dbeaver.model.AuthProfileSecretStorageTest',
 '--select-class', 'org.jkiss.dbeaver.model.NetworkProfileContractsTest',
 '--select-class', 'org.jkiss.dbeaver.registry.UserFilterExportRoundTripTest',
 '--select-class', 'org.jkiss.dbeaver.utils.DatabaseExceptionContractTest',
 '--select-class', 'org.jkiss.dbeaver.utils.ProgressMonitorContractTest',
 '--select-class', 'org.jkiss.dbeaver.model.impl.data.formatters.DateTimeDataFormatterLocaleTest',
 '--select-class', 'org.jkiss.dbeaver.ext.gaussdb.model.GaussDBExcelExportTest',
 '--select-class', 'org.jkiss.dbeaver.ext.gaussdb.model.GaussDBCSVReplacementTest',
 '--select-class', 'org.jkiss.dbeaver.ext.gaussdb.model.GaussDBStreamExportFailureTest',
 '--select-class', 'org.jkiss.dbeaver.ext.gaussdb.model.GaussDBNativePasswordTest',
 '--select-class', 'org.jkiss.dbeaver.ext.gaussdb.model.GaussDBBackupPublishTest',
 '--select-class', 'org.jkiss.dbeaver.ext.gaussdb.model.GaussDBNativeOutputTest',
 ...additionalClasses.flatMap(name => ['--select-class', name]),
 '--fail-if-no-tests', '--reports-dir', output + '/reports', '--details=summary', '--disable-banner']);
