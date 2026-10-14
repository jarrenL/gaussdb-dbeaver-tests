import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {eclipseFileLocation, eclipsePlatform, focusedRunnerPaths, javaPropertiesPath,
    javaSourceOwnership, javaTestClassName, resolvedBundleEntries, resolvedBundlePath,
    temporaryPrefix} from './focused-runner-paths.mjs';

test('focused runner requires an explicit main checkout and uses portable defaults elsewhere', () => {
    assert.throws(() => focusedRunnerPaths({}), /DBEAVER_REPO/);
    const paths = focusedRunnerPaths({DBEAVER_REPO: '/work/main'});
    assert.equal(paths.root, path.resolve('/work/main'));
    assert.equal(path.basename(path.dirname(paths.commonClasses)), 'target');
    assert.equal(paths.junitConsoleJar.startsWith(path.join(os.homedir(), '.m2', 'repository')), true);
    assert.equal(paths.javaCommand('java'), 'java');
});

test('focused runner honors explicit repository and toolchain paths', () => {
    const paths = focusedRunnerPaths({
        DBEAVER_REPO: '/work/main',
        DBEAVER_COMMON_REPO: '/work/common',
        MAVEN_REPO_LOCAL: '/cache/maven',
        DBEAVER_RESOLVED_PLUGINS: '/work/plugins',
        JAVA_HOME: '/toolchains/jdk'
    });
    assert.equal(paths.root, path.resolve('/work/main'));
    assert.equal(paths.commonClasses, path.resolve('/work/common/modules/org.jkiss.utils/target/classes'));
    assert.equal(paths.mockitoJar, path.resolve(
        '/cache/maven/p2/osgi/bundle/org.mockito.mockito-core/4.8.1/org.mockito.mockito-core-4.8.1.jar'));
    assert.equal(paths.javaCommand('javac'), path.resolve('/toolchains/jdk/bin/javac'));
});

test('focused runner accepts the existing DBeaver Maven cache variable', () => {
    const paths = focusedRunnerPaths({
        DBEAVER_REPO: '/work/main',
        DBEAVER_MAVEN_REPOSITORY: '/cache/dbeaver-maven'
    });
    assert.equal(paths.junitConsoleJar, path.resolve(
        '/cache/dbeaver-maven/org/junit/platform/junit-platform-console-standalone/1.13.1/'
        + 'junit-platform-console-standalone-1.13.1.jar'));
});

test('resolved bundles come from Tycho config or an explicit populated directory', t => {
    const root = fs.mkdtempSync(temporaryPrefix('focused-paths-test-'));
    t.after(() => fs.rmSync(root, {recursive: true, force: true}));
    const bundleDirectory = path.join(root, 'bundles');
    const configDirectory = path.join(root, 'test', 'org.jkiss.dbeaver.test.platform',
        'target', 'work', 'configuration');
    fs.mkdirSync(bundleDirectory, {recursive: true});
    fs.mkdirSync(configDirectory, {recursive: true});
    const framework = path.join(bundleDirectory, 'framework.jar');
    const bundle = path.join(bundleDirectory, 'bundle.jar');
    fs.writeFileSync(framework, '');
    fs.writeFileSync(bundle, '');
    fs.writeFileSync(path.join(configDirectory, 'config.ini'),
        'osgi.framework=file\\:' + framework + '\n'
        + 'osgi.bundles=reference\\:file\\:' + bundle + '@4\\:start\n');

    assert.deepEqual(resolvedBundleEntries(root, {}), [framework, bundle]);
    assert.deepEqual(resolvedBundleEntries(root, {DBEAVER_RESOLVED_PLUGINS: bundleDirectory}).sort(),
        [bundle, framework].sort());
    fs.mkdirSync(path.join(configDirectory, 'misleading.jar'));
    assert.throws(() => resolvedBundleEntries(root, {DBEAVER_RESOLVED_PLUGINS: configDirectory}),
        /contains no JAR files/);
    assert.equal(resolvedBundlePath(
        'reference\\:file\\:/C\\:/Program%20Files/DBeaver/bundle.jar@4\\:start', 'win32'),
        path.win32.normalize('C:/Program Files/DBeaver/bundle.jar'));
    assert.equal(resolvedBundlePath('file\\:/tmp/100%25%20ready/bundle.jar', 'linux'),
        '/tmp/100% ready/bundle.jar');
    assert.throws(() => resolvedBundlePath('file\\:/tmp/encoded%2Fseparator.jar', 'linux'),
        /Invalid resolved bundle URI/);
});

test('temporary prefixes stay under the platform temporary directory', () => {
    assert.equal(temporaryPrefix('focused-test-'), path.join(os.tmpdir(), 'focused-test-'));
    assert.throws(() => temporaryPrefix('../escape-'), /single path segment/);
});

test('Eclipse platform defaults follow the host and allow explicit overrides', () => {
    assert.deepEqual(eclipsePlatform({}, 'darwin', 'arm64'), {os: 'macosx', ws: 'cocoa', arch: 'aarch64'});
    assert.deepEqual(eclipsePlatform({}, 'linux', 'x64'), {os: 'linux', ws: 'gtk', arch: 'x86_64'});
    assert.deepEqual(eclipsePlatform({OSGI_OS: 'custom-os', OSGI_WS: 'custom-ws', OSGI_ARCH: 'custom-arch'},
        'unsupported', 'other'), {os: 'custom-os', ws: 'custom-ws', arch: 'custom-arch'});
    assert.throws(() => eclipsePlatform({}, 'unsupported', 'other'), /Unsupported host platform/);
});

test('Java source ownership accepts Windows separators without weakening checkout containment', () => {
    assert.deepEqual(javaSourceOwnership(
        'C:\\work\\dbeaver',
        'C:\\work\\dbeaver\\test\\org.jkiss.dbeaver.ext.gaussdb.test\\src\\org\\jkiss\\ExampleTest.java',
        'win32'), {
        category: 'test',
        bundle: 'org.jkiss.dbeaver.ext.gaussdb.test',
        classPath: 'org/jkiss/ExampleTest.java',
    });
    assert.deepEqual(javaSourceOwnership(
        '/work/dbeaver', '/work/dbeaver/plugins/org.jkiss.example/src/org/jkiss/Example.java', 'linux'), {
        category: 'plugins',
        bundle: 'org.jkiss.example',
        classPath: 'org/jkiss/Example.java',
    });
    assert.throws(() => javaSourceOwnership(
        'C:\\work\\dbeaver', 'D:\\other\\ExampleTest.java', 'win32'), /outside the DBeaver checkout/);
    assert.throws(() => javaSourceOwnership(
        'C:\\work\\dbeaver', 'C:\\work\\dbeaver\\docs\\Example.java', 'win32'),
    /Unrecognized source ownership/);
    assert.equal(javaTestClassName(
        'C:\\work\\dbeaver',
        'C:\\work\\dbeaver\\test\\org.jkiss.dbeaver.ext.gaussdb.test\\src\\org\\jkiss\\ExampleTest.java',
        {bundle: 'org.jkiss.dbeaver.ext.gaussdb.test', platform: 'win32'}),
    'org.jkiss.ExampleTest');
    assert.equal(javaTestClassName(
        'C:\\work\\dbeaver',
        'C:\\work\\dbeaver\\test\\org.jkiss.dbeaver.ext.gaussdb.test\\src\\org\\jkiss\\Example.java',
        {bundle: 'org.jkiss.dbeaver.ext.gaussdb.test', platform: 'win32'}), null);
    assert.equal(javaTestClassName(
        'C:\\work\\dbeaver',
        'C:\\work\\dbeaver\\test\\org.jkiss.dbeaver.ext.gaussdb.test\\src\\org\\jkiss\\ExampleTest.java',
        {bundle: 'another.bundle', platform: 'win32'}), null);
});

test('Eclipse and Java properties paths encode Windows drives and spaces portably', () => {
    assert.equal(eclipseFileLocation('C:\\Program Files\\DBeaver\\bundle.jar', {
        platform: 'win32', reference: true,
    }), 'reference\\:file\\:///C\\:/Program%20Files/DBeaver/bundle.jar');
    assert.equal(eclipseFileLocation('C:\\Program Files\\DBeaver\\dev.properties', {
        platform: 'win32',
    }), 'file\\:///C\\:/Program%20Files/DBeaver/dev.properties');
    assert.equal(javaPropertiesPath('C:\\Program Files\\DBeaver\\reports', 'win32'),
        'C:/Program Files/DBeaver/reports');
});
