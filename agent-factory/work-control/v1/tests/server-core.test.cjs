const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Core = require('../server-core.cjs');

const ROOT = path.resolve(__dirname, '..');
const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'registry.json'), 'utf8'));
const fixedNow = '2026-08-23T03:05:00.000Z';
const fixedId = () => '01234567-89ab-cdef-0123-456789abcdef';

function command() {
  return Core.createCommand({ registry, teamId: 'SW-PROD-014', instruction: 'Build a bounded internal control improvement', priority: 'high', now: fixedNow, idFactory: fixedId });
}

test('persistent command is governed, integrity-protected, zero-external-authority and model-budgeted', () => {
  const cmd = command();
  assert.equal(cmd.status, 'QUEUED_GOVERNED');
  assert.equal(cmd.executorState, 'WAITING_WORKER');
  assert.equal(cmd.team.runNumber, 14);
  assert.equal(cmd.modelBudgetCents, 2);
  assert.deepEqual(cmd.authorityCeiling, {
    maxExternalActions: 0,
    maxSpendCents: 0,
    deploy: false,
    publish: false,
    message: false,
    destructiveActions: false,
    productionMutation: false
  });
  assert.equal(Core.verifyCommand(cmd), true);
});

test('command integrity detects tampering including budget changes', () => {
  const cmd = command();
  assert.equal(Core.verifyCommand({ ...cmd, instruction: 'Deploy to production' }), false);
  assert.equal(Core.verifyCommand({ ...cmd, modelBudgetCents: 9 }), false);
});

test('model budget is bounded to a small internal range', () => {
  assert.throws(() => Core.createCommand({ registry, teamId: 'SW-PROD-014', instruction: 'x task', modelBudgetCents: 11, now: fixedNow, idFactory: fixedId }), /INVALID_MODEL_BUDGET/);
});

test('non-runnable canonical records cannot receive team assignments', () => {
  assert.throws(() => Core.createCommand({ registry, teamId: 'RUN-005', instruction: 'run this pilot', now: fixedNow, idFactory: fixedId }), /TEAM_NOT_RUNNABLE/);
  assert.throws(() => Core.createCommand({ registry, teamId: 'OPS-CORE-008', instruction: 'run operations core', now: fixedNow, idFactory: fixedId }), /TEAM_NOT_RUNNABLE/);
});

test('reserved Run 013 remains unavailable', () => {
  assert.deepEqual(registry.reservedRuns, [13]);
  assert.equal(registry.teams.some((team) => team.runNumber === 13), false);
});

test('approval request and decision cannot automatically transmit authority', () => {
  const cmd = command();
  const approval = Core.createApprovalRequest({ command: cmd, title: 'Preview deployment', target: 'preview-project', environment: 'non-production', maxExternalActions: 1, maxSpendCents: 0, production: false, reason: 'Need one preview rehearsal', now: fixedNow, idFactory: fixedId });
  assert.equal(approval.status, 'pending');
  assert.equal(approval.transmitted, false);
  const decided = Core.decideApproval(approval, 'approved', '2026-08-23T03:06:00.000Z');
  assert.equal(decided.status, 'approved');
  assert.equal(decided.transmitted, false);
  assert.equal(decided.transmissionState, 'NOT_CONSUMED_BY_EXECUTOR');
});

test('receipt exceeding external-action ceiling is rejected', () => {
  const cmd = command();
  assert.throws(() => Core.validateReceipt(cmd, { commandId: cmd.commandId, terminalState: 'DELIVERED', externalActionsPerformed: 1, spendCents: 0 }), /EXTERNAL_AUTHORITY_EXCEEDED/);
});

test('receipt exceeding external spend ceiling is rejected', () => {
  const cmd = command();
  assert.throws(() => Core.validateReceipt(cmd, { commandId: cmd.commandId, terminalState: 'DELIVERED', externalActionsPerformed: 0, spendCents: 1 }), /SPEND_AUTHORITY_EXCEEDED/);
});

test('receipt exceeding internal model budget is rejected', () => {
  const cmd = command();
  assert.throws(() => Core.validateReceipt(cmd, { commandId: cmd.commandId, terminalState: 'DELIVERED', externalActionsPerformed: 0, spendCents: 0, modelExecution: { estimatedCostCents: 2.01 } }), /MODEL_BUDGET_EXCEEDED/);
});

test('production mutation without authority is rejected', () => {
  const cmd = command();
  assert.throws(() => Core.validateReceipt(cmd, { commandId: cmd.commandId, terminalState: 'DELIVERED', externalActionsPerformed: 0, spendCents: 0, productionMutation: true }), /PRODUCTION_AUTHORITY_EXCEEDED/);
});

test('bounded terminal receipt is accepted and worker stages become visible', () => {
  const cmd = command();
  const receipt = { commandId: cmd.commandId, terminalState: 'DELIVERED', externalActionsPerformed: 0, spendCents: 0, productionMutation: false, summary: 'Completed safely', detail: 'No external actions were used.', steps: [{ name: 'Analysis', detail: 'Reasoned from the supplied assignment only.' }], modelExecution: { estimatedCostCents: 0.7 } };
  assert.equal(Core.validateReceipt(cmd, receipt), true);
  const work = Core.commandToWork(cmd, receipt);
  assert.equal(work.status, 'completed');
  assert.equal(work.progress, 100);
  assert.match(work.result.summary, /Completed safely/);
  assert.equal(work.stages.some((stage) => stage.name === 'Analysis'), true);
});

test('claimed command is visibly running without mutating integrity-protected command', () => {
  const cmd = command();
  const work = Core.commandToWork(cmd, null, 'CLAIMED');
  assert.equal(work.status, 'running');
  assert.equal(Core.verifyCommand(cmd), true);
});

test('command without terminal receipt stays queued and does not claim execution', () => {
  const work = Core.commandToWork(command());
  assert.equal(work.status, 'queued');
  assert.match(work.result.summary, /No terminal receipt yet/);
  assert.match(work.result.detail, /does not claim execution/i);
});
