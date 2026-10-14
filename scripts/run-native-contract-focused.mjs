import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {focusedRunnerPaths, resolvedBundleEntries, temporaryPrefix} from './focused-runner-paths.mjs';
const {root, commonClasses, javaCommand, mockitoJar, byteBuddyJar,
 byteBuddyAgentJar, objenesisJar, junitConsoleJar} = focusedRunnerPaths();
const output = fs.mkdtempSync(temporaryPrefix('native-contract-focused-'));
const cp = [output];
for (const name of fs.readdirSync(root + '/plugins')) {
    const classes = root + '/plugins/' + name + '/target/classes';
    if (fs.existsSync(classes)) cp.push(classes);
}
cp.push(commonClasses);
const dirs = [
 root + '/test/org.jkiss.dbeaver.ext.gaussdb.test/target/work/plugins/org.jkiss.bundle.apache.poi_5.4.2/lib'
];
for (const file of resolvedBundleEntries(root)) {
 if (!/\.source-|junit|mockito|byte.buddy|opentest4j/i.test(path.basename(file)) && !cp.includes(file)) cp.push(file);
}
for (const dir of dirs) for (const name of fs.readdirSync(dir)) {
 if (name.endsWith('.jar') && !/junit|mockito|byte.buddy|opentest4j/i.test(name)) cp.push(path.join(dir, name));
}
cp.push(mockitoJar);
cp.push(byteBuddyJar);
const agent = byteBuddyAgentJar;
cp.push(agent);
cp.push(objenesisJar);
const consoleJar = junitConsoleJar;
cp.push(consoleJar);
function run(bin, args) {
 const result = spawnSync(javaCommand(bin), args, {stdio: 'inherit'});
 if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log('Focused output: ' + output);
run('javac', ['--release', '21', '-cp', cp.join(path.delimiter), '-d', output,
 root + '/plugins/org.jkiss.dbeaver.tasks.native/src/org/jkiss/dbeaver/tasks/nativetool/AbstractNativeToolHandler.java',
 root + '/plugins/org.jkiss.dbeaver.ext.postgresql/src/org/jkiss/dbeaver/ext/postgresql/tasks/PostgreDatabaseBackupHandler.java',
 root + '/test/org.jkiss.dbeaver.ext.gaussdb.test/src/org/jkiss/dbeaver/ext/gaussdb/model/GaussDBBackupPublishTest.java',
 root + '/plugins/org.jkiss.dbeaver.ext.postgresql/src/org/jkiss/dbeaver/ext/postgresql/tasks/PostgreNativeToolHandler.java',
 root + '/plugins/org.jkiss.dbeaver.ext.postgresql/src/org/jkiss/dbeaver/ext/postgresql/tasks/PostgreDatabaseRestoreHandler.java',
 root + '/plugins/org.jkiss.dbeaver.ext.postgresql/src/org/jkiss/dbeaver/ext/postgresql/tasks/PostgreScriptExecuteHandler.java',
 root + '/test/org.jkiss.dbeaver.ext.gaussdb.test/src/org/jkiss/dbeaver/ext/gaussdb/model/GaussDBNativePasswordTest.java']);
run('java', ['-javaagent:' + agent, '-Djava.awt.headless=true', '-cp', cp.join(path.delimiter),
 'org.junit.platform.console.ConsoleLauncher', 'execute', '--select-class',
 'org.jkiss.dbeaver.ext.gaussdb.model.GaussDBNativePasswordTest', '--select-class',
 'org.jkiss.dbeaver.ext.gaussdb.model.GaussDBBackupPublishTest', '--details=summary', '--disable-banner']);
