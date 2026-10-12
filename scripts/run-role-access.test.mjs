import test from 'node:test';
import assert from 'node:assert/strict';
import {readConnectionAccount, withTemporaryRole} from './run-role-access.mjs';

const fixture = {role: 'dbv_hist_grantee_abcdef', password: 'Dbv!0123456789abcdef01239a',
    account: 'distributed_lab', group: 'dual_group'};

test('successful and failed test runs both clean only their newly created role', () => {
    for (const status of [0, 1]) {
        const statements = [];
        const actual = withTemporaryRole({...fixture, sql: s => statements.push(s), run: () => status});
        assert.equal(actual, status);
        assert.equal(statements.length, 6);
        assert.equal(statements[3], `REVOKE USAGE ON NODE GROUP dual_group FROM ${fixture.role};`);
        assert.equal(statements[4], `REVOKE ${fixture.role} FROM distributed_lab;`);
        assert.equal(statements[5], `DROP ROLE ${fixture.role};`);
    }
});
test('create failure never removes a possibly preexisting role', () => {
    const statements = [];
    assert.throws(() => withTemporaryRole({...fixture, sql: s => { statements.push(s); throw Error('exists'); },
        run: () => assert.fail('must not run')}));
    assert.equal(statements.length, 1);
});
test('setup failure cleans completed grants and newly created role', () => {
    const statements = [];
    assert.throws(() => withTemporaryRole({...fixture, sql: s => {
        statements.push(s); if (s.startsWith('GRANT USAGE')) throw Error('denied');
    }, run: () => assert.fail('must not run')}));
    assert.equal(statements.at(-2), `REVOKE ${fixture.role} FROM distributed_lab;`);
    assert.equal(statements.at(-1), `DROP ROLE ${fixture.role};`);
});
test('runner exception still cleans and cleanup failures are not hidden', () => {
    assert.throws(() => withTemporaryRole({...fixture, sql: () => {}, run: () => { throw Error('runner failed'); }}), /runner failed/);
    assert.throws(() => withTemporaryRole({...fixture, sql: s => {
        if (s.startsWith('DROP')) throw Error('dependent object');
    }, run: () => 0}), /Cleanup incomplete/);
});
test('unsafe identifiers are rejected before any SQL', () => {
    assert.throws(() => withTemporaryRole({...fixture, account: 'name;drop', sql: () => assert.fail(), run: () => 0}), /Unsafe/);
});

test('role grant target comes from the explicit connection account', () => {
    assert.equal(readConnectionAccount('url=jdbc:postgresql://host/db\nuser=dbv_hist_account_1234\n'),
        'dbv_hist_account_1234');
    for (const source of ['url=jdbc:postgresql://host/db\n', 'user=name;drop\n', 'user=MixedCase\n']) {
        assert.throws(() => readConnectionAccount(source), /safe explicit user/);
    }
});
