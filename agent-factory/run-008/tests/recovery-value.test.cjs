const test = require('node:test');
const assert = require('node:assert/strict');
const { canReplayAction, classifyRecovery, automationValueReview } = require('../runtime/recovery-value.cjs');

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

test('value review keeps useful automation', () => {
  const review = automationValueReview({ runs:20, successfulRuns:19, manualMinutesAvoided:300, ownerMinutesRequired:20, operatingCostCents:500, avoidedCostCents:2500, incidents:10, falseAlerts:1, decisionsResolved:6 });
  assert.equal(review.recommendation, 'KEEP');
  assert.ok(review.netMinutesSaved > 0);
});

test('value review retires negative no-value automation', () => {
  const review = automationValueReview({ runs:12, successfulRuns:12, manualMinutesAvoided:0, ownerMinutesRequired:30, operatingCostCents:1000, avoidedCostCents:0, incidents:4, falseAlerts:0, decisionsResolved:0 });
  assert.equal(review.recommendation, 'RETIRE');
});
