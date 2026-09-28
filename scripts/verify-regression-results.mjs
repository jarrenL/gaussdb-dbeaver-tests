import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';

export const requiredModules = ['org.jkiss.dbeaver.test.platform', 'org.jkiss.dbeaver.ext.gaussdb.test',
    'org.jkiss.dbeaver.ext.gaussdb.debug.test', 'org.jkiss.dbeaver.ext.postgresql.test',
    'org.jkiss.dbeaver.ui.editors.data.test'];
export const requiredClasses = [
    ['org.jkiss.dbeaver.ext.postgresql.test', 'org.jkiss.dbeaver.ext.postgresql.model.session.PostgreSessionIdentityTest'],
    ['org.jkiss.dbeaver.ext.gaussdb.test', 'org.jkiss.dbeaver.ext.gaussdb.model.GaussDBSessionManagerTest'],
    ['org.jkiss.dbeaver.ext.gaussdb.test', 'org.jkiss.dbeaver.ext.gaussdb.GaussDBDataSourceProviderTest'],
    ['org.jkiss.dbeaver.ext.gaussdb.test', 'org.jkiss.dbeaver.ext.gaussdb.model.GaussDBPackageCompilerTest'],
    ['org.jkiss.dbeaver.ext.gaussdb.test', 'org.jkiss.dbeaver.ext.gaussdb.model.GaussDBPackageSourceLinesTest'],
    ['org.jkiss.dbeaver.ext.gaussdb.test', 'org.jkiss.dbeaver.ext.gaussdb.model.GaussDBPackageStateRefreshTest'],
    ['org.jkiss.dbeaver.ext.gaussdb.test', 'org.jkiss.dbeaver.ext.gaussdb.model.GaussDBPackageCompileBatchTest'],
    ['org.jkiss.dbeaver.ext.gaussdb.debug.test', 'org.jkiss.dbeaver.ext.gaussdb.debug.core.internal.GaussDBDebugSessionTest'],
    ['org.jkiss.dbeaver.ext.gaussdb.debug.test', 'org.jkiss.dbeaver.ext.gaussdb.debug.core.DebugTransactionCompletionTest'],
    ['org.jkiss.dbeaver.test.platform', 'org.jkiss.dbeaver.model.ConfigurationNIOPersistenceTest'],
    ['org.jkiss.dbeaver.test.platform', 'org.jkiss.dbeaver.model.ConfigurationReadFailureTest'],
    ['org.jkiss.dbeaver.test.platform', 'org.jkiss.dbeaver.model.impl.jdbc.data.JDBCCollectionCloneTest'],
    ['org.jkiss.dbeaver.ext.gaussdb.test', 'org.jkiss.dbeaver.ext.gaussdb.model.data.GaussDBCompositeBindingTest'],
    ['org.jkiss.dbeaver.ext.postgresql.test', 'org.jkiss.dbeaver.ext.postgresql.PostgreCompositeArrayRoundTripTest'],
    ['org.jkiss.dbeaver.ext.postgresql.test', 'org.jkiss.dbeaver.ext.postgresql.PostgreArrayNullSyntaxTest'],
    ['org.jkiss.dbeaver.ext.postgresql.test', 'org.jkiss.dbeaver.ext.postgresql.PostgreNumericPrecisionTest'],
    ['org.jkiss.dbeaver.ext.postgresql.test', 'org.jkiss.dbeaver.ext.postgresql.model.data.PostgreArrayTextBindingTest'],
    ['org.jkiss.dbeaver.ui.editors.data.test', 'org.jkiss.dbeaver.ui.editors.content.ContentEditorFileImportTest'],
    ...['BinaryEditorContentReloadTest', 'TextEditorContentReloadTest']
        .map(name => ['org.jkiss.dbeaver.ui.editors.data.test', 'org.jkiss.dbeaver.acceptance.' + name]),
    ['org.jkiss.dbeaver.ext.gaussdb.test', 'org.jkiss.dbeaver.ext.gaussdb.model.data.GaussDBBinaryValueHandlerTest'],
    ['org.jkiss.dbeaver.test.platform', 'org.jkiss.dbeaver.model.sql.SQLQueryRecoveryPolicyTest'],
    ['org.jkiss.dbeaver.ext.gaussdb.test', 'org.jkiss.dbeaver.ext.gaussdb.model.GaussDBSQLSafetyTest'],
    ['org.jkiss.dbeaver.ext.gaussdb.test', 'org.jkiss.dbeaver.ext.gaussdb.model.GaussDBProjectionMetadataTest'],
    ...['GaussDBExcelExportTest', 'GaussDBCSVReplacementTest', 'GaussDBStreamExportFailureTest', 'GaussDBNativePasswordTest']
        .map(name => ['org.jkiss.dbeaver.ext.gaussdb.test', 'org.jkiss.dbeaver.ext.gaussdb.model.' + name]),
    ['org.jkiss.dbeaver.test.platform', 'org.jkiss.dbeaver.utils.VersionUtilsTest'],
    ['org.jkiss.dbeaver.test.platform', 'org.jkiss.dbeaver.model.ConnectionFilterSerializationTest'],
    ['org.jkiss.dbeaver.test.platform', 'org.jkiss.dbeaver.registry.UserFilterExportRoundTripTest'],
    ['org.jkiss.dbeaver.test.platform', 'org.jkiss.dbeaver.model.AuthProfileSecretStorageTest'],
    ['org.jkiss.dbeaver.test.platform', 'org.jkiss.dbeaver.model.NetworkProfileContractsTest'],
    ['org.jkiss.dbeaver.test.platform', 'org.jkiss.dbeaver.utils.DatabaseExceptionContractTest'],
    ['org.jkiss.dbeaver.test.platform', 'org.jkiss.dbeaver.utils.ProgressMonitorContractTest'],
    ['org.jkiss.dbeaver.test.platform', 'org.jkiss.dbeaver.model.impl.jdbc.data.JDBCContentBytesReadTest'],
    ['org.jkiss.dbeaver.test.platform', 'org.jkiss.dbeaver.model.impl.jdbc.data.JDBCContentXMLReadTest'],
    ['org.jkiss.dbeaver.test.platform', 'org.jkiss.dbeaver.model.impl.jdbc.data.JDBCContentCLOBReadTest'],
    ['org.jkiss.dbeaver.test.platform', 'org.jkiss.dbeaver.model.impl.jdbc.data.JDBCContentBLOBReadTest'],
    ['org.jkiss.dbeaver.test.platform', 'org.jkiss.dbeaver.model.data.storage.BytesContentStorageTest'],
    ['org.jkiss.dbeaver.test.platform', 'org.jkiss.dbeaver.model.data.storage.StringContentStorageTest'],
    ['org.jkiss.dbeaver.test.platform', 'org.jkiss.dbeaver.model.data.storage.TemporaryContentStorageTest'],
    ['org.jkiss.dbeaver.test.platform', 'org.jkiss.dbeaver.model.impl.data.formatters.DateTimeDataFormatterLocaleTest'],
    ['org.jkiss.dbeaver.test.platform', 'org.jkiss.dbeaver.model.impl.data.transformers.EpochTimeAttributeTransformerTest'],
    ['org.jkiss.dbeaver.test.platform', 'org.jkiss.dbeaver.model.exec.ExecutionContextReplacementTest'],
    ...['PostgreXmlPlanHierarchyTest', 'PostgreSavedPlanTest', 'PostgrePlanResponseTest', 'PostgrePlanTransactionTest']
        .map(name => ['org.jkiss.dbeaver.ext.postgresql.test', 'org.jkiss.dbeaver.ext.postgresql.model.plan.' + name])
];

export function verifyRegressionResults(report, startedMs) {
    assert(Number.isFinite(startedMs), 'Invalid test start time');
    assert(report.reports?.length > 0, 'No reports');
    for (const item of report.reports) {
        assert(Date.parse(item.modified) >= startedMs, `Stale report: ${item.file}`);
    }
    assert.equal(report.totals.failures + report.totals.errors, 0, 'Tests failed');
    assert(report.cases?.length > 0, 'No individual test outcomes');
    assert.equal(report.cases.length, report.totals.tests, 'Case count mismatch');
    const counts = {passed: 0, skipped: 0, failures: 0, errors: 0};
    for (const item of report.cases) {
        assert(Object.hasOwn(counts, item.outcome), 'Unknown test outcome');
        counts[item.outcome]++;
    }
    for (const key of Object.keys(counts)) assert.equal(counts[key], report.totals[key], `Outcome mismatch: ${key}`);
    for (const module of requiredModules) {
        assert(report.cases.some(item => item.module === module && item.outcome === 'passed'), `Module did not execute passing tests: ${module}`);
    }
    for (const [module, name] of requiredClasses) {
        const cases = report.cases.filter(item => item.module === module && item.class === name);
        assert(cases.length > 0, `Required test class missing: ${name}`);
        assert(cases.every(item => item.outcome === 'passed'), `Required component tests not all passed: ${name}`);
    }
    return report.totals;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const totals = verifyRegressionResults(JSON.parse(fs.readFileSync(process.argv[2], 'utf8')), Number(process.argv[3]));
    console.log(`Verified fresh module/class results: ${JSON.stringify(totals)}; skipped tests are not passes.`);
}
