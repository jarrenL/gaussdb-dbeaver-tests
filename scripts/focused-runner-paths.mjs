import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const scriptsDirectory = path.dirname(fileURLToPath(import.meta.url));
const workspaceDirectory = path.resolve(scriptsDirectory, '..', '..');

export function focusedRunnerPaths(env = process.env, {requireRepository = true} = {}) {
    if (requireRepository && !env.DBEAVER_REPO) {
        throw new Error('DBEAVER_REPO must point to the intended DBeaver source checkout');
    }
    const root = path.resolve(env.DBEAVER_REPO || path.join(workspaceDirectory, 'dbeaver'));
    const commonRoot = path.resolve(env.DBEAVER_COMMON_REPO || path.join(workspaceDirectory, 'dbeaver-common'));
    const mavenRepository = path.resolve(env.MAVEN_REPO_LOCAL || env.DBEAVER_MAVEN_REPOSITORY
        || path.join(os.homedir(), '.m2', 'repository'));
    const mavenArtifact = (...segments) => path.join(mavenRepository, ...segments);

    return {
        root,
        commonClasses: path.join(commonRoot, 'modules', 'org.jkiss.utils', 'target', 'classes'),
        javaCommand: name => env.JAVA_HOME ? path.join(path.resolve(env.JAVA_HOME), 'bin', name) : name,
        mockitoJar: mavenArtifact('p2', 'osgi', 'bundle', 'org.mockito.mockito-core', '4.8.1',
            'org.mockito.mockito-core-4.8.1.jar'),
        byteBuddyJar: mavenArtifact('p2', 'osgi', 'bundle', 'net.bytebuddy.byte-buddy', '1.18.8',
            'net.bytebuddy.byte-buddy-1.18.8.jar'),
        byteBuddyAgentJar: mavenArtifact('p2', 'osgi', 'bundle', 'net.bytebuddy.byte-buddy-agent', '1.18.8',
            'net.bytebuddy.byte-buddy-agent-1.18.8.jar'),
        objenesisJar: mavenArtifact('p2', 'osgi', 'bundle', 'org.objenesis', '3.2.0',
            'org.objenesis-3.2.0.jar'),
        junitConsoleJar: mavenArtifact('org', 'junit', 'platform', 'junit-platform-console-standalone', '1.13.1',
            'junit-platform-console-standalone-1.13.1.jar'),
        equinoxLauncherJar: mavenArtifact('p2', 'osgi', 'bundle', 'org.eclipse.equinox.launcher',
            '1.7.100.v20251111-0406', 'org.eclipse.equinox.launcher-1.7.100.v20251111-0406.jar')
    };
}

export function resolvedBundlePath(entry, platform = process.platform) {
    const location = entry.trim().replaceAll('\\:', ':')
        .replace(/^reference:/, '')
        .replace(/@\d+(?::start)?$/, '');
    if (!location.startsWith('file:')) {
        throw new Error('Resolved bundle is not a file URI: ' + location);
    }
    let file;
    try {
        file = fileURLToPath(location, {windows: platform === 'win32'});
    } catch (error) {
        throw new Error('Invalid resolved bundle URI: ' + location, {cause: error});
    }
    const absolute = platform === 'win32' ? path.win32.isAbsolute(file) : path.posix.isAbsolute(file);
    if (!absolute) {
        throw new Error('Resolved bundle path is not absolute: ' + file);
    }
    return file;
}

export function resolvedBundleEntries(root, env = process.env,
    modules = ['org.jkiss.dbeaver.test.platform']) {
    if (env.DBEAVER_RESOLVED_PLUGINS) {
        const directory = path.resolve(env.DBEAVER_RESOLVED_PLUGINS);
        const entries = fs.readdirSync(directory)
            .filter(name => name.endsWith('.jar') && fs.statSync(path.join(directory, name)).isFile())
            .map(name => path.join(directory, name));
        if (entries.length === 0) {
            throw new Error('DBEAVER_RESOLVED_PLUGINS contains no JAR files: ' + directory);
        }
        return entries;
    }

    const locations = modules.flatMap(module => {
        const configFile = path.join(path.resolve(root), 'test', module,
            'target', 'work', 'configuration', 'config.ini');
        const config = fs.readFileSync(configFile, 'utf8');
        const framework = config.split(/\r?\n/).find(line => line.startsWith('osgi.framework='));
        const bundles = config.split(/\r?\n/).find(line => line.startsWith('osgi.bundles='));
        if (!framework || !bundles) {
            throw new Error('Resolved OSGi framework or bundle list is missing: ' + configFile);
        }
        return [framework.slice('osgi.framework='.length),
            ...bundles.slice('osgi.bundles='.length).split(',')];
    });
    return [...new Set(locations.map(entry => {
        const file = resolvedBundlePath(entry);
        if (!fs.existsSync(file)) throw new Error('Missing resolved bundle: ' + file);
        return file;
    }))];
}

export function temporaryPrefix(name) {
    if (!name || path.basename(name) !== name) {
        throw new Error('Temporary directory prefix must be a single path segment');
    }
    return path.join(os.tmpdir(), name);
}

export function eclipsePlatform(env = process.env, platform = process.platform, architecture = process.arch) {
    const defaults = {
        darwin: {os: 'macosx', ws: 'cocoa'},
        linux: {os: 'linux', ws: 'gtk'},
        win32: {os: 'win32', ws: 'win32'}
    }[platform];
    if ((!defaults?.os && !env.OSGI_OS) || (!defaults?.ws && !env.OSGI_WS)) {
        throw new Error('Unsupported host platform; set OSGI_OS and OSGI_WS explicitly');
    }
    const arch = {arm64: 'aarch64', x64: 'x86_64', ia32: 'x86'}[architecture] || architecture;
    return {
        os: env.OSGI_OS || defaults.os,
        ws: env.OSGI_WS || defaults.ws,
        arch: env.OSGI_ARCH || arch
    };
}

export function javaSourceOwnership(root, source, platform = process.platform) {
    const paths = platform === 'win32' ? path.win32 : path.posix;
    const relative = paths.relative(paths.resolve(root), paths.resolve(source));
    if (!relative || paths.isAbsolute(relative) || relative === '..' || relative.startsWith(`..${paths.sep}`)) {
        throw new Error('Java source is outside the DBeaver checkout: ' + source);
    }
    const segments = relative.split(paths.sep);
    if (segments.length < 4 || !['plugins', 'test'].includes(segments[0])
        || !segments[1] || segments[2] !== 'src'
        || !segments.at(-1).endsWith('.java') || segments.slice(3).some(segment => !segment)) {
        throw new Error('Unrecognized source ownership: ' + relative);
    }
    return {
        category: segments[0],
        bundle: segments[1],
        classPath: segments.slice(3).join('/'),
    };
}

export function javaTestClassName(root, source, {bundle, platform = process.platform} = {}) {
    const ownership = javaSourceOwnership(root, source, platform);
    if (ownership.category !== 'test' || bundle && ownership.bundle !== bundle
        || !ownership.classPath.endsWith('Test.java')) {
        return null;
    }
    return ownership.classPath.slice(0, -'.java'.length).replaceAll('/', '.');
}

export function eclipseFileLocation(file, {platform = process.platform, reference = false} = {}) {
    const location = pathToFileURL(file, {windows: platform === 'win32'}).href.replaceAll(':', '\\:');
    return (reference ? 'reference\\:' : '') + location;
}

export function javaPropertiesPath(file, platform = process.platform) {
    const paths = platform === 'win32' ? path.win32 : path.posix;
    return paths.resolve(file).split(paths.sep).join('/');
}
