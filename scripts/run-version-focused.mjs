import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
const root = process.env.DBEAVER_REPO || '/Users/lj/Documents/GaussDB/dbeaver-icbc-26.1.5';
const java = '/Library/Java/JavaVirtualMachines/jdk-25.jdk/Contents/Home/bin/';
const output = fs.mkdtempSync('/tmp/version-focused-');
const cp = [output];
for (const name of fs.readdirSync(root + '/plugins')) {
    const classes = root + '/plugins/' + name + '/target/classes';
    if (fs.existsSync(classes)) cp.push(classes);
}
cp.push('/Users/lj/Documents/GaussDB/dbeaver-common/modules/org.jkiss.utils/target/classes');
cp.push('/Users/lj/.m2/repository/org/junit/platform/junit-platform-console-standalone/1.13.1/junit-platform-console-standalone-1.13.1.jar');
function run(bin, args) {
    const result = spawnSync(java + bin, args, {stdio: 'inherit'});
    if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log('Focused output: ' + output);
run('javac', ['--release', '21', '-cp', cp.join(':'), '-d', output,
    root + '/plugins/org.jkiss.dbeaver.model/src/org/jkiss/dbeaver/utils/VersionUtils.java',
    root + '/test/org.jkiss.dbeaver.test.platform/src/org/jkiss/dbeaver/utils/VersionUtilsTest.java']);
run('java', ['-cp', cp.join(':'), 'org.junit.platform.console.ConsoleLauncher', 'execute',
    '--select-class', 'org.jkiss.dbeaver.utils.VersionUtilsTest', '--details=summary', '--disable-banner']);
