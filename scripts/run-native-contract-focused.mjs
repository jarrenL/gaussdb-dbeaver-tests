import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const root = process.env.DBEAVER_REPO || '/Users/lj/Documents/GaussDB/dbeaver-icbc-26.1.5';
const java = '/Library/Java/JavaVirtualMachines/jdk-25.jdk/Contents/Home/bin/';
const output = fs.mkdtempSync('/tmp/native-contract-focused-');
const cp = [output];
for (const name of fs.readdirSync(root + '/plugins')) {
    const classes = root + '/plugins/' + name + '/target/classes';
    if (fs.existsSync(classes)) cp.push(classes);
}
cp.push('/Users/lj/Documents/GaussDB/dbeaver-common/modules/org.jkiss.utils/target/classes');
const dirs = [
 '/tmp/history-bot-build.IP5Su0/plugins',
 root + '/test/org.jkiss.dbeaver.ext.gaussdb.test/target/work/plugins/org.jkiss.bundle.apache.poi_5.4.2/lib'
];
for (const dir of dirs) for (const name of fs.readdirSync(dir)) {
 if (name.endsWith('.jar') && !/junit|mockito|byte.buddy|opentest4j/i.test(name)) cp.push(path.join(dir, name));
}
cp.push('/Users/lj/.m2/repository/p2/osgi/bundle/org.mockito.mockito-core/4.8.1/org.mockito.mockito-core-4.8.1.jar');
cp.push('/Users/lj/.m2/repository/p2/osgi/bundle/net.bytebuddy.byte-buddy/1.18.8/net.bytebuddy.byte-buddy-1.18.8.jar');
const agent = '/Users/lj/.m2/repository/p2/osgi/bundle/net.bytebuddy.byte-buddy-agent/1.18.8/net.bytebuddy.byte-buddy-agent-1.18.8.jar';
cp.push(agent);
cp.push('/Users/lj/.m2/repository/p2/osgi/bundle/org.objenesis/3.2.0/org.objenesis-3.2.0.jar');
const consoleJar = '/Users/lj/.m2/repository/org/junit/platform/junit-platform-console-standalone/1.13.1/junit-platform-console-standalone-1.13.1.jar';
cp.push(consoleJar);
function run(bin, args) {
 const result = spawnSync(java + bin, args, {stdio: 'inherit'});
 if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log('Focused output: ' + output);
run('javac', ['--release', '21', '-cp', cp.join(':'), '-d', output,
 root + '/plugins/org.jkiss.dbeaver.ext.postgresql/src/org/jkiss/dbeaver/ext/postgresql/tasks/PostgreDatabaseBackupHandler.java',
 root + '/test/org.jkiss.dbeaver.ext.gaussdb.test/src/org/jkiss/dbeaver/ext/gaussdb/model/GaussDBBackupPublishTest.java',
 root + '/plugins/org.jkiss.dbeaver.ext.postgresql/src/org/jkiss/dbeaver/ext/postgresql/tasks/PostgreNativeToolHandler.java',
 root + '/plugins/org.jkiss.dbeaver.ext.postgresql/src/org/jkiss/dbeaver/ext/postgresql/tasks/PostgreDatabaseRestoreHandler.java',
 root + '/plugins/org.jkiss.dbeaver.ext.postgresql/src/org/jkiss/dbeaver/ext/postgresql/tasks/PostgreScriptExecuteHandler.java',
 root + '/test/org.jkiss.dbeaver.ext.gaussdb.test/src/org/jkiss/dbeaver/ext/gaussdb/model/GaussDBNativePasswordTest.java']);
run('java', ['-javaagent:' + agent, '-Djava.awt.headless=true', '-cp', cp.join(':'),
 'org.junit.platform.console.ConsoleLauncher', 'execute', '--select-class',
 'org.jkiss.dbeaver.ext.gaussdb.model.GaussDBNativePasswordTest', '--select-class',
 'org.jkiss.dbeaver.ext.gaussdb.model.GaussDBBackupPublishTest', '--details=summary', '--disable-banner']);
