const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluateControlledExecution, evaluateRollbackRecovery } = require('../runtime/controlled-execution.cjs');

const safeAction = {
  actionId: 'act:run008:synthetic:control-proof',
  idempotencyKey: 'idem:run008:control-proof:001',
  estimatedCostCents: 0,
  external: false,
  authorityContext: {
    mode: 'INTERNAL_WRITE',
    externalActionAuthorized: false,
    approvalRef: null,
    costCeilingCents: 0
  }
};

test('RUNNING permits bounded internal execution', () => {
  const result = evaluateControlledExecution({
    action: safeAction,
    runControl: { state: 'RUNNING', controlRef: 'ctrl:run008:control-proof:running' }
  });
  assert.equal(result.allowed, true);
  assert.equal(result.controlState, 'RUNNING');
  assert.deepEqual(result.reasons, []);
});

test('PAUSED blocks the same bounded action', () => {
  const result = evaluateControlledExecution({
    action: safeAction,
    runControl: { state: 'PAUSED', controlRef: 'ctrl:run008:control-proof:paused' }
  });
  assert.equal(result.allowed, false);
  assert.ok(result.reasons.includes('CONTROL:RUNTIME_PAUSED'));
});

test('KILLED blocks the same bounded action', () => {
  const result = evaluateControlledExecution({
    action: safeAction,
    runControl: { state: 'KILLED', controlRef: 'ctrl:run008:control-proof:killed' }
  });
  assert.equal(result.allowed, false);
  assert.ok(result.reasons.includes('CONTROL:KILL_SWITCH_ACTIVE'));
});

test('rollback recovery only permits retained last-known-good plus RUNNING control', () => {
  const denied = evaluateRollbackRecovery({
    rollback: {
      currentVersion: 'v1.3',
      targetVersion: 'v1.1',
      lastKnownGoodVersion: 'v1.2',
      reason: 'Synthetic regression',
      evidenceRef: 'evidence:run008:rollback-proof:001'
    },
    recoveredRunControl: { state: 'RUNNING', controlRef: 'ctrl:run008:control-proof:recovered' }
  });
  assert.equal(denied.allowed, false);
  assert.ok(denied.reasons.includes('ROLLBACK:TARGET_NOT_LAST_KNOWN_GOOD'));

  const allowed = evaluateRollbackRecovery({
    rollback: {
      currentVersion: 'v1.3',
      targetVersion: 'v1.2',
      lastKnownGoodVersion: 'v1.2',
      reason: 'Synthetic regression',
      evidenceRef: 'evidence:run008:rollback-proof:001'
    },
    recoveredRunControl: { state: 'RUNNING', controlRef: 'ctrl:run008:control-proof:recovered' }
  });
  assert.equal(allowed.allowed, true);
  assert.equal(allowed.targetVersion, 'v1.2');
  assert.equal(allowed.recoveredControlState, 'RUNNING');
  assert.deepEqual(allowed.reasons, []);
});
