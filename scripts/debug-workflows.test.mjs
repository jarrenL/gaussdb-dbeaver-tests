import test from 'node:test';
import assert from 'node:assert/strict';
import {DEBUG_WORKFLOWS, runDebugWorkflow, verifyDebugWorkflowTrace} from './debug-workflows.mjs';

const routineA = Object.freeze({databaseFingerprint: 'source-a/database-a', databaseName: 'database_a',
    schema: 'dbv_debug_e2e_repeatable', routine: 'same_name', oid: 1001});
const waitA = Object.freeze({...routineA, routine: 'write_then_wait', oid: 1002});
const largeA = Object.freeze({...routineA, routine: 'large_locals', oid: 1003});
const largeB = Object.freeze({databaseFingerprint: 'source-b/database-b', databaseName: 'database_b',
    schema: largeA.schema, routine: largeA.routine, oid: 2003});

function base(name) {
    return DEBUG_WORKFLOWS[name].map(step => ({stepId: step.id, action: step.action, ok: true}));
}

function lifecycle() {
    const events = base('breakpoint-step-continue-relaunch');
    events.forEach((event, index) => Object.assign(event, {target: {...routineA}, sessionId: index < 5 ? 'session-1' : 'session-2'}));
    Object.assign(events[0], {state: 'started'});
    Object.assign(events[1], {state: 'suspended', breakpoint: {key: 'workspace:large:line-5', line: 5, hit: true, enabled: true}});
    Object.assign(events[2], {variables: {p_seed: '7', v_value: '8', v_database_tag: '101'},
        variableMutation: {name: 'v_value', requested: '99', observed: '99', serverRoundTrip: true}});
    Object.assign(events[3], {state: 'suspended', frameLine: 6});
    Object.assign(events[4], {state: 'completed'});
    Object.assign(events[5], {state: 'started'});
    Object.assign(events[6], {state: 'suspended', breakpoint: {key: 'workspace:large:line-5', line: 5, hit: true, enabled: true}});
    Object.assign(events[7], {state: 'completed'});
    return events;
}

function termination() {
    const events = base('terminate-relaunch');
    events.forEach((event, index) => Object.assign(event, {target: {...waitA}, sessionId: index < 4 ? 'session-1' : 'session-2'}));
    Object.assign(events[0], {state: 'started'});
    Object.assign(events[1], {state: 'suspended', breakpoint: {key: 'workspace:wait:insert', line: 5, hit: true, enabled: true}});
    Object.assign(events[2], {state: 'running', targetQuery: 'CALL dbv_debug_e2e_repeatable.write_then_wait(2); -- pg_sleep(300)'});
    Object.assign(events[3], {state: 'terminated', targetGone: true, connectionReusable: true,
        transactionRolledBack: true, baselineRows: 1});
    Object.assign(events[4], {state: 'started'});
    Object.assign(events[5], {state: 'suspended', breakpoint: {key: 'workspace:wait:insert', line: 5, hit: true, enabled: true}});
    Object.assign(events[6], {state: 'terminated', targetGone: true, connectionReusable: true});
    return events;
}

function isolation() {
    const events = base('database-a-b-a-large-routine');
    for (const [indexes, target, session, tag, hash] of [
        [[0, 1, 2], largeA, 'session-a-1', '101', 'source-a-hash'],
        [[3, 4, 5], largeB, 'session-b', '202', 'source-b-hash'],
        [[6, 7, 8], largeA, 'session-a-2', '101', 'source-a-hash'],
    ]) {
        for (const index of indexes) Object.assign(events[index], {target: {...target}, sessionId: session});
        Object.assign(events[indexes[0]], {state: 'selected'});
        Object.assign(events[indexes[1]], {state: 'suspended', sourceLines: 260, localVariableCount: 64,
            sourceHash: hash, variables: {v_database_tag: tag},
            breakpoint: {key: `workspace:${target.databaseName}:large`, line: 70, hit: true, enabled: true}});
        Object.assign(events[indexes[2]], {state: 'terminated', targetGone: true});
    }
    return events;
}

test('defines three high-value workflows without transient widget ids', () => {
    assert.deepEqual(Object.keys(DEBUG_WORKFLOWS), [
        'breakpoint-step-continue-relaunch', 'terminate-relaunch', 'database-a-b-a-large-routine']);
    assert(!JSON.stringify(DEBUG_WORKFLOWS).includes('widget'));
});

test('accepts breakpoint, variables, step, continue and a fresh relaunch', () => {
    const summary = verifyDebugWorkflowTrace('breakpoint-step-continue-relaunch', lifecycle());
    assert.equal(summary.passed, true);
    assert.equal(summary.sessions, 2);
});

test('executes an adapter in the declared order and validates its final trace', async () => {
    const events = lifecycle();
    const calls = [];
    const result = await runDebugWorkflow('breakpoint-step-continue-relaunch', async (step, context) => {
        calls.push([step.id, [...context.completed]]);
        return structuredClone(events[calls.length - 1]);
    });
    assert.equal(result.summary.steps, events.length);
    assert.deepEqual(calls.map(item => item[0]), DEBUG_WORKFLOWS['breakpoint-step-continue-relaunch'].map(step => step.id));
    assert.deepEqual(calls.at(-1)[1], events.slice(0, -1).map(event => event.stepId));
});

test('rejects an out-of-order or failed workflow event', () => {
    const reordered = lifecycle();
    [reordered[1], reordered[2]] = [reordered[2], reordered[1]];
    assert.throws(() => verifyDebugWorkflowTrace('breakpoint-step-continue-relaunch', reordered), /Expected step/);
    const failed = lifecycle();
    failed[3].ok = false;
    assert.throws(() => verifyDebugWorkflowTrace('breakpoint-step-continue-relaunch', failed), /did not pass/);
});

test('adapter execution fails before later actions after a bad step result', async () => {
    const events = lifecycle();
    let calls = 0;
    await assert.rejects(() => runDebugWorkflow('breakpoint-step-continue-relaunch', async () => {
        const event = structuredClone(events[calls++]);
        if (calls === 2) event.ok = false;
        return event;
    }), /did not pass/);
    assert.equal(calls, 2);
});

test('rejects stale sessions, lost breakpoints and a no-op Step Over', () => {
    const stale = lifecycle();
    for (let index = 5; index < stale.length; index++) stale[index].sessionId = 'session-1';
    assert.throws(() => verifyDebugWorkflowTrace('breakpoint-step-continue-relaunch', stale), /reused/);
    const lost = lifecycle();
    lost[6].breakpoint.key = 'new-breakpoint';
    assert.throws(() => verifyDebugWorkflowTrace('breakpoint-step-continue-relaunch', lost), /not restored/);
    const noStep = lifecycle();
    noStep[3].frameLine = noStep[1].breakpoint.line;
    assert.throws(() => verifyDebugWorkflowTrace('breakpoint-step-continue-relaunch', noStep), /did not advance/);
});

test('rejects variable values copied from another fixture or frame', () => {
    const events = lifecycle();
    events[2].variables.v_database_tag = '202';
    assert.throws(() => verifyDebugWorkflowTrace('breakpoint-step-continue-relaunch', events), /variables/);
    const stale = lifecycle();
    stale[2].variableMutation.observed = '8';
    assert.throws(() => verifyDebugWorkflowTrace('breakpoint-step-continue-relaunch', stale), /server round trip/);
});

test('accepts running termination, rollback, connection reuse and relaunch', () => {
    const summary = verifyDebugWorkflowTrace('terminate-relaunch', termination());
    assert.deepEqual({sessions: summary.sessions, rollback: summary.rollbackVerified, reusable: summary.connectionReusable},
        {sessions: 2, rollback: true, reusable: true});
});

test('termination must occur during execution and prove cleanup', () => {
    const paused = termination();
    paused[2].state = 'suspended';
    assert.throws(() => verifyDebugWorkflowTrace('terminate-relaunch', paused), /state=running/);
    const noWait = termination();
    noWait[2].targetQuery = 'CALL quick_routine()';
    assert.throws(() => verifyDebugWorkflowTrace('terminate-relaunch', noWait), /pg_sleep/);
    const orphan = termination();
    orphan[3].targetGone = false;
    assert.throws(() => verifyDebugWorkflowTrace('terminate-relaunch', orphan), /target cleanup/);
});

test('termination must prove rollback, connection reuse and breakpoint retention', () => {
    for (const mutate of [
        events => { events[3].transactionRolledBack = false; },
        events => { events[3].connectionReusable = false; },
        events => { events[5].breakpoint.line++; },
    ]) {
        const events = termination();
        mutate(events);
        assert.throws(() => verifyDebugWorkflowTrace('terminate-relaunch', events));
    }
});

test('accepts A→B→A isolation with the same routine name and a large fixture', () => {
    const summary = verifyDebugWorkflowTrace('database-a-b-a-large-routine', isolation());
    assert.deepEqual(summary.switchOrder, ['A', 'B', 'A']);
    assert.equal(summary.localVariableCount, 64);
});

test('database isolation rejects stale resolution and failure to return to A', () => {
    const staleB = isolation();
    for (const index of [3, 4, 5]) staleB[index].target = {...largeA};
    assert.throws(() => verifyDebugWorkflowTrace('database-a-b-a-large-routine', staleB), /not isolated/);
    const wrongReturn = isolation();
    wrongReturn[6].target.oid++;
    wrongReturn[7].target.oid++;
    assert.throws(() => verifyDebugWorkflowTrace('database-a-b-a-large-routine', wrongReturn), /original database/);
});

test('database isolation rejects leaked variables, stale source and small fixtures', () => {
    const leaked = isolation();
    leaked[4].variables.v_database_tag = '101';
    assert.throws(() => verifyDebugWorkflowTrace('database-a-b-a-large-routine', leaked), /leaked/);
    const sameSource = isolation();
    sameSource[4].sourceHash = sameSource[1].sourceHash;
    assert.throws(() => verifyDebugWorkflowTrace('database-a-b-a-large-routine', sameSource), /indistinguishable/);
    const small = isolation();
    small[7].localVariableCount = 63;
    assert.throws(() => verifyDebugWorkflowTrace('database-a-b-a-large-routine', small), /64 local variables/);
});

test('unknown workflows and short traces fail closed', async () => {
    assert.throws(() => verifyDebugWorkflowTrace('missing', []), /Unknown/);
    assert.throws(() => verifyDebugWorkflowTrace('terminate-relaunch', termination().slice(1)), /Expected 7/);
    await assert.rejects(() => runDebugWorkflow('missing', async () => ({})), /Unknown/);
});
