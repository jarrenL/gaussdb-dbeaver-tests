import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const SAME_NAME_ROUTINE = Object.freeze({schema: 'dbv_debug_e2e_repeatable', routine: 'same_name'});
const LARGE_ROUTINE = Object.freeze({schema: 'dbv_debug_e2e_repeatable', routine: 'large_locals'});
const WAIT_ROUTINE = Object.freeze({schema: 'dbv_debug_e2e_repeatable', routine: 'write_then_wait'});

// An adapter executes these semantic actions against DBeaver and returns one sanitized event per
// action. Widget ids are deliberately absent: they are transient and must be resolved afresh by
// the adapter after every UI transition.
export const DEBUG_WORKFLOWS = Object.freeze({
    'breakpoint-step-continue-relaunch': Object.freeze([
        {id: 'launch-1', action: 'launch', target: SAME_NAME_ROUTINE, databaseSlot: 'A'},
        {id: 'breakpoint-1', action: 'await-breakpoint', target: SAME_NAME_ROUTINE, databaseSlot: 'A'},
        {id: 'variables-1', action: 'read-and-change-variable', databaseSlot: 'A'},
        {id: 'step-over', action: 'step-over', databaseSlot: 'A'},
        {id: 'continue', action: 'continue', databaseSlot: 'A'},
        {id: 'relaunch', action: 'launch', target: SAME_NAME_ROUTINE, databaseSlot: 'A'},
        {id: 'breakpoint-2', action: 'await-breakpoint', target: SAME_NAME_ROUTINE, databaseSlot: 'A'},
        {id: 'finish', action: 'continue', databaseSlot: 'A'},
    ]),
    'terminate-relaunch': Object.freeze([
        {id: 'launch-1', action: 'launch', target: WAIT_ROUTINE, databaseSlot: 'A'},
        {id: 'breakpoint-1', action: 'await-breakpoint', target: WAIT_ROUTINE, databaseSlot: 'A'},
        {id: 'continue-to-wait', action: 'continue', databaseSlot: 'A'},
        {id: 'terminate', action: 'terminate', databaseSlot: 'A'},
        {id: 'relaunch', action: 'launch', target: WAIT_ROUTINE, databaseSlot: 'A'},
        {id: 'breakpoint-2', action: 'await-breakpoint', target: WAIT_ROUTINE, databaseSlot: 'A'},
        {id: 'terminate-relaunch', action: 'terminate', databaseSlot: 'A'},
    ]),
    'database-a-b-a-large-routine': Object.freeze([
        {id: 'select-a', action: 'select-database', target: LARGE_ROUTINE, databaseSlot: 'A'},
        {id: 'launch-a', action: 'launch-and-await-breakpoint', target: LARGE_ROUTINE, databaseSlot: 'A'},
        {id: 'terminate-a', action: 'terminate', databaseSlot: 'A'},
        {id: 'select-b', action: 'select-database', target: LARGE_ROUTINE, databaseSlot: 'B'},
        {id: 'launch-b', action: 'launch-and-await-breakpoint', target: LARGE_ROUTINE, databaseSlot: 'B'},
        {id: 'terminate-b', action: 'terminate', databaseSlot: 'B'},
        {id: 'select-a-return', action: 'select-database', target: LARGE_ROUTINE, databaseSlot: 'A'},
        {id: 'launch-a-return', action: 'launch-and-await-breakpoint', target: LARGE_ROUTINE, databaseSlot: 'A'},
        {id: 'terminate-a-return', action: 'terminate', databaseSlot: 'A'},
    ]),
});

function reject(condition, message) {
    if (condition) throw new Error(message);
}

function requireString(value, label) {
    reject(typeof value !== 'string' || value.length === 0, `Missing ${label}`);
    return value;
}

function requireState(event, state) {
    reject(event.state !== state, `${event.stepId} must report state=${state}`);
}

function targetKey(event, includeOid = true) {
    const target = event.target;
    reject(!target || typeof target !== 'object', `Missing target identity at ${event.stepId}`);
    const identity = [
        requireString(target.databaseFingerprint, `${event.stepId} database fingerprint`),
        requireString(target.databaseName, `${event.stepId} database name`),
        requireString(target.schema, `${event.stepId} schema`),
        requireString(target.routine, `${event.stepId} routine`),
    ];
    if (includeOid) {
        reject(!Number.isSafeInteger(target.oid) || target.oid <= 0, `Invalid routine OID at ${event.stepId}`);
        identity.push(target.oid);
    }
    return JSON.stringify(identity);
}

function sameSession(events, indexes) {
    const ids = indexes.map(index => requireString(events[index].sessionId, `${events[index].stepId} session id`));
    reject(new Set(ids).size !== 1, `Steps must belong to one debug session: ${indexes.map(i => events[i].stepId).join(', ')}`);
    return ids[0];
}

function requireBreakpoint(event) {
    const breakpoint = event.breakpoint;
    reject(!breakpoint || typeof breakpoint !== 'object', `Missing breakpoint evidence at ${event.stepId}`);
    requireString(breakpoint.key, `${event.stepId} persisted breakpoint key`);
    reject(breakpoint.hit !== true || breakpoint.enabled !== true, `Breakpoint was not enabled and hit at ${event.stepId}`);
    reject(!Number.isInteger(breakpoint.line) || breakpoint.line <= 0, `Invalid breakpoint line at ${event.stepId}`);
    return breakpoint;
}

function validateCommon(name, trace) {
    const plan = DEBUG_WORKFLOWS[name];
    reject(!plan, `Unknown debug workflow: ${name}`);
    reject(!Array.isArray(trace), 'Workflow trace must be an array');
    reject(trace.length !== plan.length, `Expected ${plan.length} events, received ${trace.length}`);
    trace.forEach((event, index) => validateStep(plan[index], event, index));
    return plan;
}

function validateStep(step, event, index) {
    reject(!event || typeof event !== 'object', `Malformed event at index ${index}`);
    reject(event.stepId !== step.id, `Expected step ${step.id} at index ${index}`);
    reject(event.action !== step.action, `Unexpected action at ${step.id}`);
    reject(event.ok !== true, `Step did not pass: ${step.id}`);
}

function verifyLifecycle(trace) {
    requireState(trace[0], 'started');
    requireState(trace[1], 'suspended');
    requireState(trace[3], 'suspended');
    requireState(trace[4], 'completed');
    requireState(trace[5], 'started');
    requireState(trace[6], 'suspended');
    requireState(trace[7], 'completed');
    const firstSession = sameSession(trace, [0, 1, 2, 3, 4]);
    const secondSession = sameSession(trace, [5, 6, 7]);
    reject(firstSession === secondSession, 'Relaunch reused the completed debug session identity');
    const target = targetKey(trace[0]);
    for (const index of [1, 2, 3, 4, 5, 6, 7]) {
        reject(targetKey(trace[index]) !== target, `Target changed at ${trace[index].stepId}`);
    }
    const firstBreakpoint = requireBreakpoint(trace[1]);
    const secondBreakpoint = requireBreakpoint(trace[6]);
    reject(firstBreakpoint.key !== secondBreakpoint.key || firstBreakpoint.line !== secondBreakpoint.line,
        'Persisted breakpoint was not restored on relaunch');
    const variables = trace[2].variables;
    reject(!variables || variables.p_seed !== '7' || variables.v_value !== '8'
        || variables.v_database_tag !== '101', 'Initial variables do not match the deterministic fixture');
    const mutation = trace[2].variableMutation;
    reject(!mutation || mutation.name !== 'v_value' || mutation.requested !== '99'
        || mutation.observed !== '99' || mutation.serverRoundTrip !== true,
    'Variable change was not confirmed by a server round trip');
    reject(!Number.isInteger(trace[3].frameLine) || trace[3].frameLine <= firstBreakpoint.line,
        'Step Over did not advance to a later suspended line');
    return {sessions: 2, breakpointKey: firstBreakpoint.key};
}

function verifyTermination(trace) {
    requireState(trace[0], 'started');
    requireState(trace[1], 'suspended');
    requireState(trace[2], 'running');
    requireState(trace[3], 'terminated');
    requireState(trace[4], 'started');
    requireState(trace[5], 'suspended');
    requireState(trace[6], 'terminated');
    const firstSession = sameSession(trace, [0, 1, 2, 3]);
    const secondSession = sameSession(trace, [4, 5, 6]);
    reject(firstSession === secondSession, 'Relaunch reused the terminated debug session identity');
    const target = targetKey(trace[0]);
    for (const index of [1, 2, 3, 4, 5, 6]) {
        reject(targetKey(trace[index]) !== target, `Target changed at ${trace[index].stepId}`);
    }
    reject(typeof trace[2].targetQuery !== 'string' || !/\bpg_sleep\s*\(/i.test(trace[2].targetQuery),
        'Termination was not exercised while the target was executing pg_sleep');
    for (const index of [3, 6]) {
        const event = trace[index];
        reject(event.targetGone !== true || event.connectionReusable !== true,
            `${event.stepId} did not prove target cleanup and connection reuse`);
    }
    reject(trace[3].transactionRolledBack !== true || trace[3].baselineRows !== 1,
        'First termination did not prove rollback to the committed baseline');
    const firstBreakpoint = requireBreakpoint(trace[1]);
    const secondBreakpoint = requireBreakpoint(trace[5]);
    reject(firstBreakpoint.key !== secondBreakpoint.key || firstBreakpoint.line !== secondBreakpoint.line,
        'Breakpoint was not retained after terminating the running target');
    return {sessions: 2, rollbackVerified: true, connectionReusable: true};
}

function verifyDatabaseIsolation(trace) {
    for (const index of [0, 3, 6]) requireState(trace[index], 'selected');
    for (const index of [1, 4, 7]) {
        requireState(trace[index], 'suspended');
        requireBreakpoint(trace[index]);
        reject(!Number.isInteger(trace[index].sourceLines) || trace[index].sourceLines < 200,
            `${trace[index].stepId} did not expose the large-source fixture`);
        reject(!Number.isInteger(trace[index].localVariableCount) || trace[index].localVariableCount < 64,
            `${trace[index].stepId} did not expose at least 64 local variables`);
    }
    for (const index of [2, 5, 8]) {
        requireState(trace[index], 'terminated');
        reject(trace[index].targetGone !== true, `Target remained after ${trace[index].stepId}`);
    }
    const selectedA = targetKey(trace[0]);
    const launchedA = targetKey(trace[1]);
    const selectedB = targetKey(trace[3]);
    const launchedB = targetKey(trace[4]);
    const selectedAReturn = targetKey(trace[6]);
    const launchedAReturn = targetKey(trace[7]);
    reject(selectedA !== launchedA || selectedB !== launchedB || selectedAReturn !== launchedAReturn,
        'Launch resolved a different routine than the selected database object');
    reject(selectedA !== selectedAReturn || launchedA !== launchedAReturn,
        'A→B→A did not return to the original database and routine identity');
    const aWithoutOid = targetKey(trace[1], false);
    const bWithoutOid = targetKey(trace[4], false);
    reject(aWithoutOid === bWithoutOid, 'Database A and B identities were not isolated');
    reject(trace[1].target.schema !== trace[4].target.schema
        || trace[1].target.routine !== trace[4].target.routine,
    'The isolation scenario must use the same schema and routine name in both databases');
    reject(trace[1].variables?.v_database_tag !== '101' || trace[4].variables?.v_database_tag !== '202'
        || trace[7].variables?.v_database_tag !== '101', 'Database-specific variables leaked across A→B→A');
    reject(requireString(trace[1].sourceHash, 'database A source hash')
        !== requireString(trace[7].sourceHash, 'returned database A source hash'),
    'Database A source changed after returning from database B');
    reject(trace[1].sourceHash === trace[4].sourceHash, 'Database-specific fixture sources are indistinguishable');
    const sessions = [trace[1], trace[4], trace[7]].map(event => requireString(event.sessionId, `${event.stepId} session id`));
    reject(new Set(sessions).size !== 3, 'Database switches reused a stale debug session');
    return {sessions: 3, switchOrder: ['A', 'B', 'A'], sourceLines: trace[1].sourceLines,
        localVariableCount: trace[1].localVariableCount};
}

export function verifyDebugWorkflowTrace(name, trace) {
    validateCommon(name, trace);
    const details = name === 'breakpoint-step-continue-relaunch' ? verifyLifecycle(trace)
        : name === 'terminate-relaunch' ? verifyTermination(trace)
            : verifyDatabaseIsolation(trace);
    return {workflow: name, steps: trace.length, passed: true, ...details};
}

export async function runDebugWorkflow(name, executeStep) {
    const plan = DEBUG_WORKFLOWS[name];
    reject(!plan, `Unknown debug workflow: ${name}`);
    reject(typeof executeStep !== 'function', 'A debug workflow adapter function is required');
    const trace = [];
    for (const step of plan) {
        const event = await executeStep({...step, target: step.target ? {...step.target} : undefined},
            Object.freeze({workflow: name, completed: trace.map(item => item.stepId)}));
        validateStep(step, event, trace.length);
        trace.push(event);
    }
    return {summary: verifyDebugWorkflowTrace(name, trace), trace};
}

async function main() {
    const [name, mode, file] = process.argv.slice(2);
    if (name === '--list') {
        console.log(Object.keys(DEBUG_WORKFLOWS).join('\n'));
        return;
    }
    reject(!DEBUG_WORKFLOWS[name] || !['--trace', '--adapter'].includes(mode) || !file,
        'Usage: debug-workflows.mjs <workflow> --trace <json> | --adapter <module>');
    if (mode === '--trace') {
        const document = JSON.parse(fs.readFileSync(file, 'utf8'));
        const trace = Array.isArray(document) ? document : document.events;
        if (!Array.isArray(document) && document.workflow !== undefined) {
            reject(document.workflow !== name, 'Trace workflow name does not match the requested workflow');
        }
        console.log(JSON.stringify(verifyDebugWorkflowTrace(name, trace)));
        return;
    }
    const module = await import(pathToFileURL(path.resolve(file)).href);
    reject(typeof module.executeDebugStep !== 'function', 'Adapter must export executeDebugStep(step, context)');
    const result = await runDebugWorkflow(name, module.executeDebugStep);
    console.log(JSON.stringify(result.summary));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
