import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const root = process.env.DBEAVER_REPO || '/Users/lj/Documents/GaussDB/dbeaver-icbc-26.1.5';
const java = '/Library/Java/JavaVirtualMachines/jdk-25.jdk/Contents/Home/bin/';
const output = fs.mkdtempSync('/tmp/hex-content-test-');
const editorTests = root + '/test/org.jkiss.dbeaver.ui.editors.data.test/src/';
const cp = [output, editorTests, '/Users/lj/Documents/GaussDB/dbeaver-common/modules/org.jkiss.utils/target/classes'];
for (const name of fs.readdirSync(root + '/plugins')) {
 const classes = path.join(root, 'plugins', name, 'target/classes');
 if (fs.existsSync(classes)) cp.push(classes);
}
const bundles = '/tmp/history-bot-build.IP5Su0/plugins';
for (const name of fs.readdirSync(bundles)) {
 if (name.endsWith('.jar') && !/junit|mockito|byte.buddy|opentest4j/i.test(name)) cp.push(path.join(bundles, name));
}
const m2 = '/Users/lj/.m2/repository/';
const agent = m2 + 'p2/osgi/bundle/net.bytebuddy.byte-buddy-agent/1.18.8/net.bytebuddy.byte-buddy-agent-1.18.8.jar';
cp.push(agent,
 m2 + 'p2/osgi/bundle/net.bytebuddy.byte-buddy/1.18.8/net.bytebuddy.byte-buddy-1.18.8.jar',
 m2 + 'p2/osgi/bundle/org.mockito.mockito-core/4.8.1/org.mockito.mockito-core-4.8.1.jar',
 m2 + 'p2/osgi/bundle/org.objenesis/3.2.0/org.objenesis-3.2.0.jar',
 m2 + 'org/junit/platform/junit-platform-console-standalone/1.13.1/junit-platform-console-standalone-1.13.1.jar');
function run(command, args) {
 const result = spawnSync(java + command, args, {stdio: 'inherit', timeout: 120000});
 if (result.status !== 0) process.exit(result.status ?? 1);
 if (command === 'javac') fs.writeFileSync(path.join(output, 'compiled-sources.json'),
  JSON.stringify({root, sources: args.filter(value => value.endsWith('.java'))}, null, 2));
}
console.log('Component output: ' + output);
const source = root + '/plugins/org.jkiss.dbeaver.ui.editors.hex/src/org/jkiss/dbeaver/ui/editors/binary/';
run('javac', ['--release', '21', '-cp', cp.join(':'), '-d', output,
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
run('java', ['-javaagent:' + agent, '-Djava.awt.headless=true', '-cp', cp.join(':'),
 'org.junit.platform.console.ConsoleLauncher', 'execute', '--select-class',
 'org.jkiss.dbeaver.acceptance.BinaryEditorContentReloadTest', '--fail-if-no-tests',
 '--select-class', 'org.jkiss.dbeaver.ui.editors.content.ContentEditorFileImportTest',
 '--select-class', 'org.jkiss.dbeaver.model.impl.jdbc.data.JDBCContentBytesReadTest',
 '--select-class', 'org.jkiss.dbeaver.acceptance.TextEditorContentReloadTest',
 '--reports-dir', output + '/reports', '--details=summary', '--disable-banner']);
