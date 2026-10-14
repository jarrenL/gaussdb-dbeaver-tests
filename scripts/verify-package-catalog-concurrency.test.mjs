import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {verifyPackageCatalogConcurrency} from './verify-package-catalog-concurrency.mjs';

const packageOid = '1734092';
const schemaOid = '1734088';
const ownerOid = '10';
const oldDigest = '1'.repeat(64);
const refreshedDigest = '2'.repeat(64);
const labels = [
    'isolated schema and package are owned by the test account',
    'initial package invocation returns 42',
    'connection A cached the old authoritative body by OID',
    'connection B replacement returns 84',
    'connection A refreshed the authoritative body by the same OID',
    'refreshed source differs from the stale cache',
    'replay selected only the refreshed source',
    'authoritative replay preserves value 84',
    'schema identity and owner remain stable',
    'package identity and owner remain stable',
    'specification object identity and valid state remain stable',
    'body object identity and valid state remain stable',
    'isolated schema is cleaned with RESTRICT',
];

function fixture() {
    return {
        targetExitCode: 0,
        targetLog: [
            ...labels.slice(0, 3).map(label => `PASS ${label}`),
            `SOURCE OLD packageOid=${packageOid} digest=${oldDigest} value=42`,
            `PASS ${labels[3]}`,
            `CONCURRENT UPDATE packageOid=${packageOid} value=84 connection=B`,
            ...labels.slice(4, 7).map(label => `PASS ${label}`),
            `SOURCE REFRESH packageOid=${packageOid} digest=${refreshedDigest} value=84 staleSelected=false`,
            `PASS ${labels[7]}`,
            `REPLAY packageOid=${packageOid} source=refreshed value=84`,
            ...labels.slice(8, 12).map(label => `PASS ${label}`),
            `IDENTITY schemaOid=${schemaOid} schemaOwner=${ownerOid} packageOid=${packageOid} packageOwner=${ownerOid} specObjectOid=${packageOid} bodyObjectOid=${packageOid} schemaStable=true ownerStable=true packageStable=true specStable=true bodyStable=true specValid=true bodyValid=true`,
            `PASS ${labels[12]}`,
            'CLEANED schema=dbv_pkg_catalog_refresh',
            'TOTAL CHECKS 13 PASS 13 FAIL 0',
            'RESULT PASS test=package-catalog-concurrency scope=server-jdbc-catalog gui=false osgi=false',
        ].join('\n'),
    };
}

test('accepts one complete authoritative-source concurrency run', () => {
    assert.deepEqual(verifyPackageCatalogConcurrency(fixture()), {
        packageOid, schemaOid, ownerOid, oldDigest, refreshedDigest,
        scope: 'server-jdbc-catalog', gui: false, osgi: false, passed: true,
    });
});

test('fixture re-queries GS_SOURCE by OID and never uses CASCADE cleanup', () => {
    const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
    const source = fs.readFileSync(
        path.join(repository, 'integration', 'PackageCatalogConcurrencyFixture.java'), 'utf8');
    assert.match(source, /FROM dbe_pldeveloper\.gs_source[^;]+WHERE id=\?/s);
    assert.match(source, /String replaySource = refreshedSource\.sql\(\)/);
    assert.match(source, /GuiPackageFixture\.asCreateOrReplace\(replaySource\)/);
    assert.match(source, /DROP SCHEMA " \+ SCHEMA \+ " RESTRICT/);
    assert.doesNotMatch(source, /DROP SCHEMA[^;\n]*CASCADE/i);
    assert.doesNotMatch(source, /GRANT\s/i);
});

for (const [name, change] of [
    ['nonzero exit', value => { value.targetExitCode = 1; }],
    ['missing exit', value => { delete value.targetExitCode; }],
    ['failure line', value => { value.targetLog += '\nFAIL stale replay'; }],
    ['uncaught exception', value => { value.targetLog += '\nException in thread "main"'; }],
    ['missing old source', value => { value.targetLog = value.targetLog.replace(/^SOURCE OLD.*\n/m, ''); }],
    ['duplicate old source', value => { value.targetLog += `\nSOURCE OLD packageOid=${packageOid} digest=${oldDigest} value=42`; }],
    ['old source claims 84', value => { value.targetLog = value.targetLog.replace('value=42', 'value=84'); }],
    ['missing B update', value => { value.targetLog = value.targetLog.replace(/^CONCURRENT UPDATE.*\n/m, ''); }],
    ['wrong update connection', value => { value.targetLog = value.targetLog.replace('connection=B', 'connection=A'); }],
    ['stale source selected', value => { value.targetLog = value.targetLog.replace('staleSelected=false', 'staleSelected=true'); }],
    ['unchanged digest', value => { value.targetLog = value.targetLog.replace(refreshedDigest, oldDigest); }],
    ['changed OID on refresh', value => { value.targetLog = value.targetLog.replace(
        `SOURCE REFRESH packageOid=${packageOid}`, 'SOURCE REFRESH packageOid=1734999'); }],
    ['replayed stale value', value => { value.targetLog = value.targetLog.replace(
        `REPLAY packageOid=${packageOid} source=refreshed value=84`,
        `REPLAY packageOid=${packageOid} source=refreshed value=42`); }],
    ['replayed cached source', value => { value.targetLog = value.targetLog.replace('source=refreshed', 'source=cached'); }],
    ['identity owner changed', value => { value.targetLog = value.targetLog.replace('ownerStable=true', 'ownerStable=false'); }],
    ['identity package OID changed', value => { value.targetLog = value.targetLog.replace(
        `IDENTITY schemaOid=${schemaOid} schemaOwner=${ownerOid} packageOid=${packageOid}`,
        `IDENTITY schemaOid=${schemaOid} schemaOwner=${ownerOid} packageOid=1734999`); }],
    ['S object OID differs', value => { value.targetLog = value.targetLog.replace(
        `specObjectOid=${packageOid}`, 'specObjectOid=1734999'); }],
    ['body invalid', value => { value.targetLog = value.targetLog.replace('bodyValid=true', 'bodyValid=false'); }],
    ['missing cleanup', value => { value.targetLog = value.targetLog.replace(/^CLEANED.*\n/m, ''); }],
    ['wrong cleanup schema', value => { value.targetLog = value.targetLog.replace(
        'CLEANED schema=dbv_pkg_catalog_refresh', 'CLEANED schema=public'); }],
    ['CASCADE claim', value => { value.targetLog += '\ncleanup used CASCADE'; }],
    ['missing PASS label', value => { value.targetLog = value.targetLog.replace(`PASS ${labels[5]}\n`, ''); }],
    ['duplicate PASS label', value => { value.targetLog += `\nPASS ${labels[5]}`; }],
    ['wrong summary', value => { value.targetLog = value.targetLog.replace(
        'TOTAL CHECKS 13 PASS 13 FAIL 0', 'TOTAL CHECKS 13 PASS 12 FAIL 1'); }],
    ['missing result', value => { value.targetLog = value.targetLog.replace(/^RESULT .*$/m, ''); }],
    ['duplicate result', value => { value.targetLog += '\nRESULT PASS test=package-catalog-concurrency scope=server-jdbc-catalog gui=false osgi=false'; }],
    ['GUI scope claim', value => { value.targetLog = value.targetLog.replace('gui=false', 'gui=true'); }],
    ['OSGi scope claim', value => { value.targetLog = value.targetLog.replace('osgi=false', 'osgi=true'); }],
]) {
    test('rejects ' + name, () => {
        const value = fixture();
        change(value);
        assert.throws(() => verifyPackageCatalogConcurrency(value));
    });
}
