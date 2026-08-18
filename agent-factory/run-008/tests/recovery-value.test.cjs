const test = require('node:test');
const assert = require('node:assert/strict');
const {
  canReplayAction,
  classifyRecovery,
  retryDecision,
  validateDeadLetterRecord,
  evaluateCancellation,
  canRequeueDeadLetter,
  evaluateRunControl,
  planRollback,
  automationValueReview
} = require('../runtime/recovery-value.cjs');

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

test('transient retry is bounded and requires idempotency', () => {
  const first = retryDecision({ failureType:'TRANSIENT_NETWORK', attemptsUsed:0, maximumRetryAttempts:2, idempotencyKey:'idem:retry:1' });
  assert.equal(first.mode, 'RETRY');
  assert.equal(first.nextAttempt, 1);

  const missingIdempotency = retryDecision({ failureType:'RATE_LIMIT', attemptsUsed:0, maximumRetryAttempts:2 });
  assert.equal(missingIdempotency.mode, 'DEAD_LETTER');
  assert.ok(missingIdempotency.reasons.includes('MISSING_IDEMPOTENCY_KEY'));
});

test('retry budget exhaustion routes work to dead letter', () => {
  const result = retryDecision({ failureType:'TEMPORARY_PROVIDER', attemptsUsed:2, maximumRetryAttempts:2, idempotencyKey:'idem:retry:2' });
  assert.equal(result.retry, false);
  assert.equal(result.deadLetter, true);
  assert.equal(result.mode, 'DEAD_LETTER');
  assert.ok(result.reasons.includes('RETRY_BUDGET_EXHAUSTED'));
});

test('deterministic rejection goes to owned review path rather than retry loop', () => {
  const result = retryDecision({ failureType:'PERMISSION', attemptsUsed:0, idempotencyKey:'idem:permission:1' });
  assert.equal(result.mode, 'DEAD_LETTER');
  assert.equal(result.retry, false);
  assert.ok(result.reasons.includes('DETERMINISTIC_REJECTION'));
});

test('unknown external outcome never automatically retries', () => {
  const result = retryDecision({ failureType:'TRANSIENT_NETWORK', attemptsUsed:0, idempotencyKey:'idem:external:1', external:true, outcomeKnown:false });
  assert.equal(result.mode, 'HUMAN_REVIEW');
  assert.equal(result.retry, false);
  assert.equal(result.deadLetter, true);
  assert.ok(result.reasons.includes('UNKNOWN_EXTERNAL_OUTCOME'));
});

test('cancellation suppresses future retry decisions immediately', () => {
  for (const cancellationState of ['REQUESTED','ACKNOWLEDGED','CANCELLED']) {
    const result = retryDecision({ failureType:'TRANSIENT_NETWORK', attemptsUsed:0, idempotencyKey:'idem:cancel:1', cancellationState });
    assert.equal(result.mode, 'CANCELLED');
    assert.equal(result.retry, false);
  }
});

test('open dead letter requires accountable owner evidence and review date', () => {
  const incomplete = validateDeadLetterRecord({
    deadLetterId:'dlq:1', subjectId:'subject:1', idempotencyKey:'idem:1', failureType:'RATE_LIMIT', attemptsUsed:2,
    createdAt:'2026-08-18T16:00:00Z', evidenceRef:'evidence:1', resolutionState:'OPEN'
  });
  assert.equal(incomplete.valid, false);
  assert.ok(incomplete.reasons.includes('MISSING_OWNER'));
  assert.ok(incomplete.reasons.includes('MISSING_NEXT_REVIEW_AT'));

  const complete = validateDeadLetterRecord({
    deadLetterId:'dlq:1', owner:'Aberdeen / Operations', subjectId:'subject:1', idempotencyKey:'idem:1', failureType:'RATE_LIMIT', attemptsUsed:2,
    createdAt:'2026-08-18T16:00:00Z', evidenceRef:'evidence:1', resolutionState:'OPEN', nextReviewAt:'2026-08-19T16:00:00Z'
  });
  assert.equal(complete.valid, true);
});

test('cancellation record blocks new retries and unknown in-flight external outcome requires human review', () => {
  const result = evaluateCancellation({
    state:'ACKNOWLEDGED', cancellationRef:'cancel:1', requestedBy:'owner', requestedAt:'2026-08-18T16:00:00Z',
    acknowledgedAt:'2026-08-18T16:01:00Z', externalInFlight:true, outcomeKnown:false
  });
  assert.equal(result.valid, true);
  assert.equal(result.blockNewRetries, true);
  assert.equal(result.requiresHumanReview, true);
  assert.ok(result.reasons.includes('UNKNOWN_EXTERNAL_OUTCOME'));
});

test('dead-letter requeue requires approval and cannot bypass cancellation', () => {
  const record = {
    deadLetterId:'dlq:2', owner:'Aberdeen / Operations', subjectId:'subject:2', idempotencyKey:'idem:2', failureType:'RATE_LIMIT', attemptsUsed:2,
    createdAt:'2026-08-18T16:00:00Z', evidenceRef:'evidence:dlq:2', resolutionState:'OPEN', nextReviewAt:'2026-08-19T16:00:00Z'
  };
  const blocked = canRequeueDeadLetter(record, { evidenceRef:'evidence:requeue:2', cancellationState:'CANCELLED' });
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.reasons.includes('MISSING_APPROVAL_REF'));
  assert.ok(blocked.reasons.includes('CANCELLED_SUBJECT_REQUIRES_RESUME_APPROVAL'));

  const allowed = canRequeueDeadLetter(record, {
    approvalRef:'approval:requeue:2', evidenceRef:'evidence:requeue:2', cancellationState:'CANCELLED', resumeApprovalRef:'approval:resume:2'
  });
  assert.equal(allowed.allowed, true);
});

test('dead-letter requeue blocks unknown external outcome', () => {
  const record = {
    deadLetterId:'dlq:3', owner:'Aberdeen / Operations', subjectId:'subject:3', idempotencyKey:'idem:3', failureType:'TEMPORARY_PROVIDER', attemptsUsed:2,
    createdAt:'2026-08-18T16:00:00Z', evidenceRef:'evidence:dlq:3', resolutionState:'OPEN', nextReviewAt:'2026-08-19T16:00:00Z'
  };
  const result = canRequeueDeadLetter(record, {
    approvalRef:'approval:3', evidenceRef:'evidence:requeue:3', external:true, outcomeKnown:false
  });
  assert.equal(result.allowed, false);
  assert.ok(result.reasons.includes('UNKNOWN_EXTERNAL_OUTCOME'));
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
