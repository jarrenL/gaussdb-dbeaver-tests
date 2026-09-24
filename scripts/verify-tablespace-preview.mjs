import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';

export function verifyTablespacePreview(dump, name) {
    assert.match(name, /^pg_(default|global)$/);
    assert.match(dump, /\nOK\s*$/);
    assert.doesNotMatch(dump, /\bFAIL\b|ERROR WHILE READING SOURCE/);
    assert.match(dump, new RegExp(`Text ${name} visible=true enabled=true`));
    assert.match(dump, new RegExp(`StyledText CREATE TABLESPACE ${name} visible=true enabled=true`));
    return {name, preview: 'passed', ddlExecution: 'not_checked'};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    console.log(JSON.stringify(verifyTablespacePreview(fs.readFileSync(process.argv[2], 'utf8'), process.argv[3])));
}
