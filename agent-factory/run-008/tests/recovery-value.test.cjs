const test = require('node:test');
const assert = require('node:assert/strict');
const { canReplayAction, classifyRecovery, evaluateRunControl, planRollback, automationValueReview } = require('../runtime/recovery-value.cjs');

test('unknown external outcome blocks replay', () => {
  const result = canReplayAction({ state:'FAILED', idempotencyKey:'idem:1', external:true, outcomeKnown:false, approvalRef:'apr:1' });
  assert.equal(result.allowed, false);
  assert.ok(result.reasons.includes('UNKNOWN_EXTERNAL_OUTCOME'));
});

test('transient internal failure is safe retry', () => {
  assert.equal(classifyRecovery({ failureType:'TRANSIENT_NETWORK', external:false }).mode, 'SAFE_RETRY');
});

test('policy rejection is not retried', () => {
  assert.equal(classifyRecovery({ failureType:'AUTHORITY' }).mode, 'DO_NOT_RETRY');
});

test('missing runtime control fails closed', () => {
  const result = evaluateRunControl();
  assert.equal(result.allowed, false);
  assert.ok(result.reasons.includes('MISSING_RUNTIME_CONTROL'));
});

test('kill switch blocks execution', () => {
  const result = evaluateRunControl({ state:'KILLED', controlRef:'ctrl:run008:1' });
  assert.equal(result.allowed, false);
  assert.ok(result.reasons.includes('KILL_SWITCH_ACTIVE'));
});

test('paused runtime blocks execution', () => {
  const result = evaluateRunControl({ state:'PAUSED', controlRef:'ctrl:run008:2' });
  assert.equal(result.allowed, false);
  assert.ok(result.reasons.includes('RUNTIME_PAUSED'));
});

test('running state requires retained control reference and permits execution', () => {
  assert.equal(evaluateRunControl({ state:'RUNNING' }).allowed, false);
  const result = evaluateRunControl({ state:'RUNNING', controlRef:'ctrl:run008:3' });
  assert.equal(result.allowed, true);
  assert.deepEqual(result.reasons, []);
});

test('rollback fails closed unless target is the last known good version with evidence', () => {
  const result = planRollback({ currentVersion:'v1.3', targetVersion:'v1.1', lastKnownGoodVersion:'v1.2', reason:'Regression', evidenceRef:'evidence:1' });
  assert.equal(result.allowed, false);
  assert.ok(result.reasons.includes('TARGET_NOT_LAST_KNOWN_GOOD'));
});

test('rollback to retained last-known-good version is allowed', () => {
  const result = planRollback({ currentVersion:'v1.3', targetVersion:'v1.2', lastKnownGoodVersion:'v1.2', reason:'Regression after v1.3', evidenceRef:'evidence:rollback-1' });
  assert.equal(result.allowed, true);
  assert.deepEqual(result.reasons, []);
});

test('value review keeps useful automation', () => {
  const review = automationValueReview({ runs:20, successfulRuns:19, manualMinutesAvoided:300, ownerMinutesRequired:20, operatingCostCents:500, avoidedCostCents:2500, incidents:10, falseAlerts:1, decisionsResolved:6 });
  assert.equal(review.recommendation, 'KEEP');
  assert.ok(review.netMinutesSaved > 0);
});

test('value review retires negative no-value automation', () => {
  const review = automationValueReview({ runs:12, successfulRuns:12, manualMinutesAvoided:0, ownerMinutesRequired:30, operatingCostCents:1000, avoidedCostCents:0, incidents:4, falseAlerts:0, decisionsResolved:0 });
  assert.equal(review.recommendation, 'RETIRE');
});
