import test from 'node:test';
import assert from 'node:assert/strict';
import {
    normalizeConnectionProperties,
    resolveDriverClass,
    resolveJdbcScheme,
    withCentralFixture
} from './run-centralized-live.mjs';
const base = {database: 'dbv_hist_central_20260930', password: 'Dbv!' + 'a'.repeat(24) + '9a'};
function fixture(overrides = {}) {
    const events = [];
    return {events, options: {...base, sql(s) { events.push(s); return '0'; },
        installAccess() { events.push('install'); }, removeAccess() { events.push('restore'); },
        run() { events.push('run'); return 0; }, ...overrides}};
}
test('two sequential runs independently create and clean fixtures, preserving exit status', () => {
    for (const code of [0, 1]) {
        const f = fixture({run: () => code});
        assert.equal(withCentralFixture(f.options), code);
        assert.equal(f.events.at(-3), 'restore');
        assert.match(f.events.at(-2), /^DROP DATABASE/);
        assert.match(f.events.at(-1), /^DROP ROLE/);
    }
});
test('preexisting database or role is never adopted or deleted', () => {
    for (const existing of ['pg_database', 'pg_roles']) {
        const calls = [];
        const f = fixture({sql(s) { calls.push(s); return s.includes(existing) ? '1' : '0'; }});
        assert.throws(() => withCentralFixture(f.options), /already exists/);
        assert(calls.every(s => s.startsWith('SELECT')));
        assert.equal(f.events.length, 0);
    }
});
test('failed database creation cleans only successfully created role', () => {
    const calls = [];
    const f = fixture({sql(s) { calls.push(s); if (s.startsWith('CREATE DATABASE')) throw Error('create failed'); return '0'; }});
    assert.throws(() => withCentralFixture(f.options), /create failed/);
    assert.equal(calls.filter(s => s.startsWith('DROP DATABASE')).length, 0);
    assert.match(calls.at(-1), /^DROP ROLE/);
});
test('partially applied access setup is restored before database removal', () => {
    const f = fixture({installAccess() { throw Error('reload failed'); }});
    assert.throws(() => withCentralFixture(f.options), /reload failed/);
    assert.equal(f.events.at(-3), 'restore');
});
test('runner failure is preserved and all cleanup actions still attempted', () => {
    const f = fixture({run() { throw Error('runner failed'); }, removeAccess() { throw Error('restore failed'); }});
    assert.throws(() => withCentralFixture(f.options), e =>
        e instanceof AggregateError && e.errors.length === 2 && e.errors[0].message === 'runner failed');
    assert.match(f.events.at(-2), /^DROP DATABASE/);
    assert.match(f.events.at(-1), /^DROP ROLE/);
});
test('unsafe identifiers fail before SQL', () => {
    const f = fixture({database: 'postgres'});
    assert.throws(() => withCentralFixture(f.options), /Invalid isolated/);
    assert.equal(f.events.length, 0);
});

const review = {role: 'dbv_debug_0123456789abcdef', password: 'Dbv!' + 'b'.repeat(24) + '9a'};
test('review uses independent admin identity, removed after its database, ordinary identity never elevated', () => {
    const f = fixture({review});
    assert.equal(withCentralFixture(f.options), 0);
    const adminCreates = f.events.filter(s => s.includes('SYSADMIN'));
    assert.equal(adminCreates.length, 1);
    assert(adminCreates[0].startsWith(`CREATE ROLE ${review.role} `));
    assert(f.events.indexOf(`DROP ROLE ${review.role};`) > f.events.indexOf(`DROP DATABASE ${base.database};`));
    assert(!f.events.some(s => s.startsWith('ALTER ROLE')));
});
test('review role creation failure never drops an unowned role and cleans its database', () => {
    const calls = [];
    const f = fixture({review, sql(s) { calls.push(s); if (s.includes('SYSADMIN')) throw Error('exists'); return '0'; }});
    assert.throws(() => withCentralFixture(f.options), /exists/);
    assert(!calls.includes(`DROP ROLE ${review.role};`));
    assert(calls.includes(`DROP DATABASE ${base.database};`));
});
test('invalid privileged identity is rejected before any effect', () => {
    const f = fixture({review: {...review, role: 'gausscore'}});
    assert.throws(() => withCentralFixture(f.options), /Invalid review/);
    assert.equal(f.events.length, 0);
});

test('central fixture uses the source driver class before the environment fallback', () => {
    assert.equal(resolveDriverClass('url=jdbc:gaussdb://host/db\ndriverClass=org.postgresql.Driver\n',
        'com.huawei.gaussdb.jdbc.Driver'), 'org.postgresql.Driver');
});

test('central fixture accepts an explicit driver environment fallback', () => {
    assert.equal(resolveDriverClass('url=jdbc:gaussdb://host/db\n', 'org.postgresql.Driver'),
        'org.postgresql.Driver');
});

test('central fixture rejects missing or malformed driver classes before creating credentials', () => {
    assert.throws(() => resolveDriverClass('url=jdbc:gaussdb://host/db\n'), /valid driverClass/);
    for (const value of ['Driver', 'org.postgresql.Driver;rm', '../Driver', '']) {
        assert.throws(() => resolveDriverClass(`driverClass=${value}\n`), /valid driverClass/);
    }
});

test('known driver classes select a URL scheme accepted by that driver family', () => {
    const source = 'url=jdbc:gaussdb://host/db\n';
    assert.equal(resolveJdbcScheme(source, 'org.postgresql.Driver'), 'postgresql');
    assert.equal(resolveJdbcScheme(source, 'com.huawei.gaussdb.jdbc.Driver'), 'gaussdb');
});

test('custom drivers retain the source scheme or require a valid explicit override', () => {
    assert.equal(resolveJdbcScheme('url=jdbc:vendor://host/db\n', 'com.vendor.Driver'), 'vendor');
    assert.equal(resolveJdbcScheme('url=jdbc:vendor://host/db\n', 'com.vendor.Driver', 'gaussdb'), 'gaussdb');
    assert.throws(() => resolveJdbcScheme('url=jdbc:vendor://host/db\n', 'com.vendor.Driver', '../bad'),
        /Invalid GAUSSDB_HISTORY_JDBC_SCHEME/);
    assert.throws(() => resolveJdbcScheme('user=test\n', 'com.vendor.Driver'), /Cannot determine JDBC scheme/);
});

test('temporary connection normalization preserves credentials while fixing URL and driver', () => {
    const original = 'url=jdbc:gaussdb://127.0.0.1:55432/db\nuser=test\npassword=a:b#c!\n';
    const normalized = normalizeConnectionProperties(original, 'org.postgresql.Driver', 'postgresql');
    assert.match(normalized, /^url=jdbc:postgresql:\/\/127\.0\.0\.1:55432\/db$/m);
    assert.match(normalized, /^driverClass=org\.postgresql\.Driver$/m);
    assert.match(normalized, /^password=a:b#c!$/m);
    assert.equal(normalized.match(/^driverClass=/gm).length, 1);
});

test('temporary connection normalization replaces a stale driver and rejects relative URLs', () => {
    const normalized = normalizeConnectionProperties(
        'url=jdbc:gaussdb://host/db\ndriverClass=com.old.Driver\n', 'org.postgresql.Driver', 'postgresql');
    assert.match(normalized, /^driverClass=org\.postgresql\.Driver$/m);
    assert.doesNotMatch(normalized, /com\.old\.Driver/);
    assert.throws(() => normalizeConnectionProperties('url=db\n', 'org.postgresql.Driver', 'postgresql'),
        /absolute JDBC URL/);
});
