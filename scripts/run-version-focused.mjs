import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {focusedRunnerPaths, temporaryPrefix} from './focused-runner-paths.mjs';
const {root, commonClasses, javaCommand, junitConsoleJar} = focusedRunnerPaths();
const output = fs.mkdtempSync(temporaryPrefix('version-focused-'));
const cp = [output];
for (const name of fs.readdirSync(root + '/plugins')) {
    const classes = root + '/plugins/' + name + '/target/classes';
    if (fs.existsSync(classes)) cp.push(classes);
}
cp.push(commonClasses);
cp.push(junitConsoleJar);
function run(bin, args) {
    const result = spawnSync(javaCommand(bin), args, {stdio: 'inherit'});
    if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log('Focused output: ' + output);
run('javac', ['--release', '21', '-cp', cp.join(path.delimiter), '-d', output,
    root + '/plugins/org.jkiss.dbeaver.model/src/org/jkiss/dbeaver/utils/VersionUtils.java',
    root + '/test/org.jkiss.dbeaver.test.platform/src/org/jkiss/dbeaver/utils/VersionUtilsTest.java']);
run('java', ['-cp', cp.join(path.delimiter), 'org.junit.platform.console.ConsoleLauncher', 'execute',
    '--select-class', 'org.jkiss.dbeaver.utils.VersionUtilsTest', '--details=summary', '--disable-banner']);
