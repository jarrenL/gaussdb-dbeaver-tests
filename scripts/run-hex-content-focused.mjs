import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {focusedRunnerPaths, resolvedBundleEntries, temporaryPrefix} from './focused-runner-paths.mjs';
const {root, commonClasses, javaCommand, mockitoJar, byteBuddyJar,
 byteBuddyAgentJar, objenesisJar, junitConsoleJar} = focusedRunnerPaths();
const output = fs.mkdtempSync(temporaryPrefix('hex-content-test-'));
const editorTests = root + '/test/org.jkiss.dbeaver.ui.editors.data.test/src/';
const cp = [output, editorTests, commonClasses];
for (const name of fs.readdirSync(root + '/plugins')) {
 const classes = path.join(root, 'plugins', name, 'target/classes');
 if (fs.existsSync(classes)) cp.push(classes);
}
for (const file of resolvedBundleEntries(root, process.env, ['org.jkiss.dbeaver.ext.gaussdb.debug.test'])) {
 if (!/\.source-|junit|mockito|byte.buddy|opentest4j/i.test(path.basename(file)) && !cp.includes(file)) cp.push(file);
}
const agent = byteBuddyAgentJar;
cp.push(agent,
 byteBuddyJar, mockitoJar, objenesisJar, junitConsoleJar);
function run(command, args) {
 const result = spawnSync(javaCommand(command), args, {stdio: 'inherit', timeout: 120000});
 if (result.status !== 0) process.exit(result.status ?? 1);
 if (command === 'javac') fs.writeFileSync(path.join(output, 'compiled-sources.json'),
  JSON.stringify({root, sources: args.filter(value => value.endsWith('.java'))}, null, 2));
}
console.log('Component output: ' + output);
const source = root + '/plugins/org.jkiss.dbeaver.ui.editors.hex/src/org/jkiss/dbeaver/ui/editors/binary/';
run('javac', ['--release', '21', '-cp', cp.join(path.delimiter), '-d', output,
 source + 'BinaryEditor.java', source + 'BinaryContent.java',
 root + '/plugins/org.jkiss.dbeaver.ui.editors.data/src/org/jkiss/dbeaver/ui/editors/content/ContentEditorInput.java',
 root + '/plugins/org.jkiss.dbeaver.ui.editors.data/src/org/jkiss/dbeaver/ui/editors/content/ContentEditorContributor.java',
 root + '/plugins/org.jkiss.dbeaver.model.jdbc/src/org/jkiss/dbeaver/model/impl/jdbc/data/JDBCContentBytes.java',
 ...['JDBCContentBLOB', 'JDBCContentCLOB', 'JDBCContentXML'].map(name =>
  root + '/plugins/org.jkiss.dbeaver.model.jdbc/src/org/jkiss/dbeaver/model/impl/jdbc/data/' + name + '.java'),
 ...['BytesContentStorage', 'StringContentStorage', 'TemporaryContentStorage'].map(name =>
  root + '/plugins/org.jkiss.dbeaver.model/src/org/jkiss/dbeaver/model/data/storage/' + name + '.java'),
 root + '/plugins/org.jkiss.dbeaver.ui.editors.data/src/org/jkiss/dbeaver/ui/data/managers/stream/TextEditorPart.java',
 root + '/plugins/org.jkiss.dbeaver.ui.editors.base/src/org/jkiss/dbeaver/ui/editors/text/FileRefDocumentProvider.java',
 editorTests + 'org/jkiss/dbeaver/acceptance/BinaryEditorContentReloadTest.java',
 root + '/test/org.jkiss.dbeaver.test.platform/src/org/jkiss/dbeaver/model/impl/jdbc/data/JDBCContentBytesReadTest.java',
 editorTests + 'org/jkiss/dbeaver/acceptance/TextEditorContentReloadTest.java',
 editorTests + 'org/jkiss/dbeaver/ui/editors/content/ContentEditorFileImportTest.java']);
run('java', ['-javaagent:' + agent, '-Djava.awt.headless=true', '-cp', cp.join(path.delimiter),
 'org.junit.platform.console.ConsoleLauncher', 'execute', '--select-class',
 'org.jkiss.dbeaver.acceptance.BinaryEditorContentReloadTest', '--fail-if-no-tests',
 '--select-class', 'org.jkiss.dbeaver.ui.editors.content.ContentEditorFileImportTest',
 '--select-class', 'org.jkiss.dbeaver.model.impl.jdbc.data.JDBCContentBytesReadTest',
 '--select-class', 'org.jkiss.dbeaver.acceptance.TextEditorContentReloadTest',
 '--reports-dir', output + '/reports', '--details=summary', '--disable-banner']);
