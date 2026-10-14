import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {eclipseFileLocation, eclipsePlatform, focusedRunnerPaths, javaPropertiesPath,
 javaSourceOwnership, javaTestClassName, temporaryPrefix} from './focused-runner-paths.mjs';

// Reuse read-only resolved bundles, with explicitly compiled classes isolated by owning bundle.
// This is an OSGi regression runner, not a replacement for Maven/Tycho compilation.
const compiled = path.resolve(process.argv[2] || '');
const {root, sources} = JSON.parse(fs.readFileSync(path.join(compiled, 'compiled-sources.json'), 'utf8'));
const module = process.argv.find(value => value.startsWith('--module='))?.slice('--module='.length)
 || 'org.jkiss.dbeaver.ext.gaussdb.test';
if (!['org.jkiss.dbeaver.ext.gaussdb.test', 'org.jkiss.dbeaver.ext.gaussdb.debug.test',
 'org.jkiss.dbeaver.ext.postgresql.test',
 'org.jkiss.dbeaver.test.platform', 'org.jkiss.dbeaver.ui.editors.data.test'].includes(module)) {
 throw new Error('Unsupported test module: ' + module);
}
const editorModule = module === 'org.jkiss.dbeaver.ui.editors.data.test';
const base = path.join(root, 'test', editorModule ? 'org.jkiss.dbeaver.ext.gaussdb.debug.test' : module, 'target');
const output = fs.mkdtempSync(temporaryPrefix('gauss-existing-osgi-'));
const configuration = path.join(output, 'configuration');
fs.mkdirSync(configuration);
fs.mkdirSync(path.join(output, 'reports'));
const owners = new Map();
for (const source of sources) {
 const {category, bundle, classPath} = javaSourceOwnership(root, source);
 const classSegments = classPath.split('/');
 const overlay = path.join(output, 'classes', bundle);
 const destination = path.join(overlay, ...classSegments.slice(0, -1));
 fs.mkdirSync(destination, {recursive: true});
 const name = classSegments.at(-1).slice(0, -'.java'.length);
 const compiledDirectory = path.join(compiled, ...classSegments.slice(0, -1));
 const files = fs.readdirSync(compiledDirectory)
  .filter(file => file === name + '.class' || file.startsWith(name + '$') && file.endsWith('.class'));
 if (!files.includes(name + '.class')) throw new Error('Missing compiled class: ' + classPath);
 for (const file of files) fs.copyFileSync(path.join(compiledDirectory, file), path.join(destination, file));
 owners.set(bundle, [overlay, path.join(root, category, bundle, 'target/classes')]);
}
const devFile = path.join(output, 'dev.properties');
if (editorModule) {
 owners.get(module).push(path.join(root, 'test', module, 'src'));
}
fs.writeFileSync(devFile, [...owners].map(([bundle, paths]) =>
 bundle + '=' + paths.map(value => javaPropertiesPath(value)).join(',')).join('\n') + '\n');
let config = fs.readFileSync(path.join(base, 'work/configuration/config.ini'), 'utf8');
if (editorModule) {
 const hex = path.join(root, 'plugins/org.jkiss.dbeaver.ui.editors.hex/target/org.jkiss.dbeaver.ui.editors.hex-1.0.185-SNAPSHOT.jar');
 if (!fs.existsSync(hex)) throw new Error('Missing resolved hex editor bundle');
 const additions = [path.join(root, 'test', module), hex];
 config = config.replace(/^osgi\.bundles=.*$/m, line =>
  line + additions.map(file => ',' + eclipseFileLocation(file, {reference: true})).join(''));
}
config = config.replace(/^osgi\.dev=.*$/m, 'osgi.dev=' + eclipseFileLocation(devFile));
fs.writeFileSync(path.join(configuration, 'config.ini'), config);
let properties = fs.readFileSync(path.join(base, 'surefire.properties'), 'utf8')
 .split(/\r?\n/).filter(line => !line.startsWith('__provider.tc.')).join('\n');
properties = properties.replace(/^reportsdirectory=.*$/m,
 'reportsdirectory=' + javaPropertiesPath(path.join(output, 'reports')))
 .replace(/^testpluginname=.*$/m, 'testpluginname=' + module)
 .replace(/^testclassesdirectory=.*$/m,
  'testclassesdirectory=' + javaPropertiesPath(path.join(output, 'classes', module)));
const classes = process.argv.includes('--all-core') || process.argv.includes('--all-module')
 ? sources.map(source => javaTestClassName(root, source, {bundle: module})).filter(Boolean).sort()
 : ['GaussDBDialectTest', 'GaussDBInsertFromDataTest', 'GaussDBPredicateScannerTest']
   .map(name => 'org.jkiss.dbeaver.ext.gaussdb.model.' + name);
if (classes.length === 0 || classes.some(name => name.endsWith('LiveTest'))) {
 throw new Error('Invalid core-only test selection');
}
properties += '\n' + classes.map((name, index) => '__provider.tc.' + index + '=' + name).join('\n');
const propertiesFile = path.join(output, 'surefire.properties');
fs.writeFileSync(propertiesFile, properties);
console.log('OSGi output: ' + output);
console.log('Selected classes: ' + classes.join(', '));
console.log('Compiled bundle overlays: ' + [...owners.keys()].join(', '));
const {javaCommand, equinoxLauncherJar, byteBuddyAgentJar} = focusedRunnerPaths(process.env,
 {requireRepository: false});
const eclipse = eclipsePlatform();
const java = javaCommand('java');
const launcher = equinoxLauncherJar;
const result = spawnSync(java, ['-Xmx1024m', '-Djava.awt.headless=true',
 ...(editorModule ? ['-javaagent:' + byteBuddyAgentJar] : []),
 '-Dosgi.noShutdown=false', '-Dosgi.os=' + eclipse.os, '-Dosgi.ws=' + eclipse.ws, '-Dosgi.arch=' + eclipse.arch,
 '-Dosgi.clean=true', '-jar', launcher, '-data', path.join(output, 'data'), '-install', path.join(base, 'work'),
 '-configuration', configuration, '-application', 'org.eclipse.tycho.surefire.osgibooter.headlesstest',
 '-testproperties', propertiesFile, '-testApplication', 'org.jkiss.dbeaver.headless.application',
 '-product', 'org.jkiss.dbeaver.headless.product'], {stdio: 'inherit', timeout: 180000});
if (result.error) console.error(result.error.message);
console.log('Launcher completion: ' + JSON.stringify({status: result.status, signal: result.signal}));
if (result.status === 0) {
 const outcomes = classes.map(name => {
  const report = fs.readFileSync(path.join(output, 'reports', name + '.txt'), 'utf8');
  const counts = /Tests run: (\d+), Failures: (\d+), Errors: (\d+), Skipped: (\d+)/.exec(report);
  if (!counts || Number(counts[1]) === 0 || counts.slice(2).some(value => Number(value) !== 0)) {
   throw new Error('Required class did not complete without failure or skip: ' + name);
  }
  return {class: name, tests: Number(counts[1]), failures: 0, errors: 0, skipped: 0};
 });
 fs.writeFileSync(path.join(output, 'verified-results.json'), JSON.stringify({
  scope: 'existing OSGi bundles with explicit compiled overlays; not a full build or live-database run',
  excludedLiveClasses: module === 'org.jkiss.dbeaver.test.platform' || editorModule
   || module === 'org.jkiss.dbeaver.ext.postgresql.test' ? []
   : module.endsWith('.debug.test') ? ['GaussDBSessionLiveTest', 'GaussDBHistoricalJdbcLiveTest']
    : ['GaussDBReviewLiveTest', 'GaussDBDumpAllLiveTest', 'GaussDBNativeLiveTest'],
  classes: outcomes, total: outcomes.reduce((sum, entry) => sum + entry.tests, 0)
 }, null, 2));
 console.log('Verified reports: ' + outcomes.length + ' classes, ' + outcomes.reduce((sum, entry) => sum + entry.tests, 0) + ' tests');
}
process.exit(result.status ?? 1);
