import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {rewriteReviewProperties} from './prepare-centralized-review-connection.mjs';

const source = [
    '# original comments and unrelated properties must remain byte-for-byte',
    'url=jdbc:gaussdb://example.invalid:8000/postgres?sslmode=require',
    'user=tester',
    'password=s\\=e\\:c\\\\ret',
    'driverClass=com.huawei.gaussdb.jdbc.Driver',
    'host=example.invalid',
    'port=8000',
    'database=postgres',
    'instanceId=old',
    'review.modes=old'
].join('\n');

// Huawei Cloud instance IDs are opaque safe tokens and are not necessarily UUIDs.
const instanceId = 'a'.repeat(36);
const boundManifest = {
    centralized: {
        instance_id: instanceId,
        phase: 'bound',
        endpoint: {host: 'example.invalid', port: 8000},
    },
};

test('rewrites only the isolated database and centralized review metadata', () => {
    const actual = rewriteReviewProperties(source, boundManifest, 'review_0917_50520080_');
    assert.match(actual,
        /^url=jdbc:gaussdb:\/\/example\.invalid:8000\/review_0917_50520080_ora\?sslmode=require$/m);
    assert.match(actual, /^database=review_0917_50520080_ora$/m);
    assert.match(actual, new RegExp(`^instanceId=${instanceId}$`, 'm'));
    assert.match(actual, /^review\.endpoint=example\.invalid:8000$/m);
    const expectedBinding = createHash('sha256')
        .update(instanceId, 'utf8').update('\0', 'utf8').update('example.invalid:8000', 'utf8').digest('hex');
    assert.match(actual, new RegExp(`^review\\.endpointBinding=${expectedBinding}$`, 'm'));
    assert.match(actual, /^review\.deployment=centralized$/m);
    assert.match(actual, /^review\.modes=ora$/m);
    assert.match(actual, /^password=s\\=e\\:c\\\\ret$/m);
    assert.match(actual, /^# original comments and unrelated properties must remain byte-for-byte$/m);
    assert.equal(actual.match(/^url=/gm).length, 1);
    assert.equal(actual.match(/^database=/gm).length, 1);
    assert.equal(actual.match(/^instanceId=/gm).length, 1);
    assert.equal(actual.match(/^review\.modes=/gm).length, 1);
});

test('refuses an unbound instance or an unsafe database prefix', () => {
    assert.throws(() => rewriteReviewProperties(source, {
        centralized: {...boundManifest.centralized, phase: 'active'}
    }, 'review_0917_50520080_'), /not bound/);
    assert.throws(() => rewriteReviewProperties(source, boundManifest, 'postgres;drop_'), /Invalid review prefix/);
    assert.throws(() => rewriteReviewProperties(source, {
        centralized: {...boundManifest.centralized, instance_id: 'central-id'}
    }, 'review_0917_50520080_'), /identity is invalid/);
});

test('refuses to combine a bound instance identity with another connection endpoint', () => {
    assert.throws(() => rewriteReviewProperties(source, {
        centralized: {...boundManifest.centralized, endpoint: {host: 'other.invalid', port: 8000}}
    }, 'review_0917_50520080_'), /does not match the bound centralized instance/);
    assert.throws(() => rewriteReviewProperties(source, {
        centralized: {...boundManifest.centralized, endpoint: {host: 'example.invalid', port: 8001}}
    }, 'review_0917_50520080_'), /does not match the bound centralized instance/);
    assert.throws(() => rewriteReviewProperties(source, {
        centralized: {instance_id: instanceId, phase: 'bound'}
    }, 'review_0917_50520080_'), /must declare endpoint/);
});

test('refuses a non-GaussDB URL and endpoint ambiguity', () => {
    assert.throws(() => rewriteReviewProperties(
        source.replace('jdbc:gaussdb:', 'jdbc:https:'), boundManifest, 'review_0917_50520080_'),
    /jdbc:gaussdb/);
    assert.throws(() => rewriteReviewProperties(
        source.replace('host=example.invalid', 'host=other.invalid'), boundManifest, 'review_0917_50520080_'),
    /host does not match/);
    assert.throws(() => rewriteReviewProperties(
        source.replace('port=8000', 'port=8001'), boundManifest, 'review_0917_50520080_'),
    /port does not match/);
    assert.throws(() => rewriteReviewProperties(
        source.replace('database=postgres', 'database=otherdb'), boundManifest, 'review_0917_50520080_'),
    /database does not match/);
    assert.throws(() => rewriteReviewProperties(
        `${source}\nhost=duplicate.invalid`, boundManifest, 'review_0917_50520080_'),
    /ambiguous host/);
});

test('refuses credentials, fragments, continuations and malformed driver classes', () => {
    assert.throws(() => rewriteReviewProperties(
        source.replace('gaussdb://', 'gaussdb://user:secret@'), boundManifest, 'review_0917_50520080_'),
    /credential-free/);
    assert.throws(() => rewriteReviewProperties(
        source.replace('?sslmode=require', '?sslmode=require&password=secret'),
        boundManifest, 'review_0917_50520080_'), /credential-free/);
    assert.throws(() => rewriteReviewProperties(
        source.replace('?sslmode=require', '#fragment'), boundManifest, 'review_0917_50520080_'),
    /credential-free/);
    assert.throws(() => rewriteReviewProperties(
        `${source}\ncontinued=value\\`, boundManifest, 'review_0917_50520080_'),
    /Multiline/);
    assert.throws(() => rewriteReviewProperties(
        source.replace('com.huawei.gaussdb.jdbc.Driver', 'bad class'), boundManifest, 'review_0917_50520080_'),
    /driver class is invalid/);
});

test('command writes an owner-only file atomically and refuses to overwrite an input', t => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gaussdb-central-review-'));
    t.after(() => fs.rmSync(directory, {recursive: true, force: true}));
    const sourceFile = path.join(directory, 'source.properties');
    const manifestFile = path.join(directory, 'manifest.json');
    const outputFile = path.join(directory, 'review.properties');
    fs.writeFileSync(sourceFile, source, {encoding: 'utf8', mode: 0o600});
    fs.writeFileSync(manifestFile, JSON.stringify(boundManifest), {encoding: 'utf8', mode: 0o600});
    const script = path.join(path.dirname(fileURLToPath(import.meta.url)),
        'prepare-centralized-review-connection.mjs');
    const result = spawnSync(process.execPath,
        [script, sourceFile, manifestFile, outputFile, 'review_0917_50520080_'],
        {encoding: 'utf8'});
    assert.equal(result.status, 0, result.stderr);
    assert.equal(fs.statSync(outputFile).mode & 0o777, 0o600);
    assert.match(fs.readFileSync(outputFile, 'utf8'),
        /^database=review_0917_50520080_ora$/m);

    const overwrite = spawnSync(process.execPath,
        [script, sourceFile, manifestFile, sourceFile, 'review_0917_50520080_'],
        {encoding: 'utf8'});
    assert.notEqual(overwrite.status, 0);
    assert.match(overwrite.stderr, /must not replace an input/);

    const alias = path.join(directory, 'directory-alias');
    fs.symlinkSync(directory, alias, 'dir');
    const aliasOverwrite = spawnSync(process.execPath,
        [script, sourceFile, manifestFile, path.join(alias, 'source.properties'), 'review_0917_50520080_'],
        {encoding: 'utf8'});
    assert.notEqual(aliasOverwrite.status, 0);
    assert.match(aliasOverwrite.stderr, /must not replace an input/);
});
