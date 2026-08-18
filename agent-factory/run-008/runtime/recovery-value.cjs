const TRANSIENT_FAILURES = new Set(['TRANSIENT_NETWORK','RATE_LIMIT','TEMPORARY_PROVIDER']);
const DETERMINISTIC_FAILURES = new Set(['VALIDATION','AUTHORITY','AUTHENTICATION','PERMISSION','COST_CEILING','POLICY']);
const DEAD_LETTER_STATES = new Set(['OPEN','RESOLVED','REJECTED']);
const CANCELLATION_STATES = new Set(['NONE','REQUESTED','ACKNOWLEDGED','CANCELLED']);

function canReplayAction(actionRecord) {
  const reasons = [];
  if (!actionRecord || typeof actionRecord !== 'object') return { allowed:false, reasons:['INVALID_ACTION_RECORD'] };
  if (!actionRecord.idempotencyKey) reasons.push('MISSING_IDEMPOTENCY_KEY');
  if (!['FAILED','CANCELLED'].includes(actionRecord.state)) reasons.push('STATE_NOT_REPLAYABLE');
  if (actionRecord.external === true && actionRecord.outcomeKnown === false) reasons.push('UNKNOWN_EXTERNAL_OUTCOME');
  if (actionRecord.external === true && !actionRecord.approvalRef) reasons.push('MISSING_APPROVAL_REF');
  return { allowed: reasons.length === 0, reasons };
}

function classifyRecovery({ failureType, external = false, outcomeKnown = true } = {}) {
  if (!failureType) return { mode:'HUMAN_REVIEW', reason:'UNKNOWN_FAILURE' };
  if (external && !outcomeKnown) return { mode:'HUMAN_REVIEW', reason:'UNKNOWN_EXTERNAL_OUTCOME' };
  if (TRANSIENT_FAILURES.has(failureType)) return { mode:'SAFE_RETRY', reason:'TRANSIENT_FAILURE' };
  if (DETERMINISTIC_FAILURES.has(failureType)) return { mode:'DO_NOT_RETRY', reason:'DETERMINISTIC_REJECTION' };
  return { mode:'HUMAN_REVIEW', reason:'UNCLASSIFIED_FAILURE' };
}

function retryDecision({
  failureType,
  attemptsUsed = 0,
  maximumRetryAttempts = 2,
  idempotencyKey,
  cancellationState = 'NONE',
  external = false,
  outcomeKnown = true
} = {}) {
  const reasons = [];
  if (!Number.isInteger(attemptsUsed) || attemptsUsed < 0) reasons.push('INVALID_ATTEMPTS_USED');
  if (!Number.isInteger(maximumRetryAttempts) || maximumRetryAttempts < 0) reasons.push('INVALID_RETRY_LIMIT');
  if (!CANCELLATION_STATES.has(cancellationState)) reasons.push('INVALID_CANCELLATION_STATE');
  if (reasons.length) return { mode:'BLOCKED', retry:false, deadLetter:false, reasons };

  if (cancellationState !== 'NONE') {
    return { mode:'CANCELLED', retry:false, deadLetter:false, reasons:['CANCELLATION_ACTIVE'] };
  }
  if (external && outcomeKnown === false) {
    return { mode:'HUMAN_REVIEW', retry:false, deadLetter:true, reasons:['UNKNOWN_EXTERNAL_OUTCOME'] };
  }

  const recovery = classifyRecovery({ failureType, external, outcomeKnown });
  if (recovery.mode === 'SAFE_RETRY') {
    if (!idempotencyKey) return { mode:'DEAD_LETTER', retry:false, deadLetter:true, reasons:['MISSING_IDEMPOTENCY_KEY'] };
    if (attemptsUsed >= maximumRetryAttempts) return { mode:'DEAD_LETTER', retry:false, deadLetter:true, reasons:['RETRY_BUDGET_EXHAUSTED'] };
    return {
      mode:'RETRY',
      retry:true,
      deadLetter:false,
      nextAttempt:attemptsUsed + 1,
      maximumRetryAttempts,
      reasons:['TRANSIENT_FAILURE']
    };
  }
  if (recovery.mode === 'DO_NOT_RETRY') {
    return { mode:'DEAD_LETTER', retry:false, deadLetter:true, reasons:['DETERMINISTIC_REJECTION'] };
  }
  return { mode:'HUMAN_REVIEW', retry:false, deadLetter:true, reasons:[recovery.reason] };
}

function validateDeadLetterRecord(record) {
  const reasons = [];
  if (!record || typeof record !== 'object' || Array.isArray(record)) return { valid:false, reasons:['INVALID_DEAD_LETTER_RECORD'] };
  for (const field of ['deadLetterId','owner','subjectId','idempotencyKey','failureType','createdAt','evidenceRef','resolutionState']) {
    if (typeof record[field] !== 'string' || !record[field].trim()) reasons.push(`MISSING_${field.toUpperCase()}`);
  }
  if (!Number.isInteger(record.attemptsUsed) || record.attemptsUsed < 0) reasons.push('INVALID_ATTEMPTS_USED');
  if (record.createdAt && Number.isNaN(Date.parse(record.createdAt))) reasons.push('INVALID_CREATED_AT');
  if (record.resolutionState && !DEAD_LETTER_STATES.has(record.resolutionState)) reasons.push('INVALID_RESOLUTION_STATE');
  if (record.resolutionState === 'OPEN') {
    if (typeof record.nextReviewAt !== 'string' || !record.nextReviewAt.trim()) reasons.push('MISSING_NEXT_REVIEW_AT');
    else if (Number.isNaN(Date.parse(record.nextReviewAt))) reasons.push('INVALID_NEXT_REVIEW_AT');
  }
  return { valid:reasons.length === 0, reasons };
}

function evaluateCancellation(cancellation = {}) {
  const reasons = [];
  if (!cancellation || typeof cancellation !== 'object' || Array.isArray(cancellation)) {
    return { valid:false, blockNewRetries:true, requiresHumanReview:true, reasons:['INVALID_CANCELLATION'] };
  }
  const state = cancellation.state || 'NONE';
  if (!CANCELLATION_STATES.has(state)) reasons.push('INVALID_CANCELLATION_STATE');
  if (state !== 'NONE') {
    for (const field of ['cancellationRef','requestedBy','requestedAt']) {
      if (typeof cancellation[field] !== 'string' || !cancellation[field].trim()) reasons.push(`MISSING_${field.toUpperCase()}`);
    }
    if (cancellation.requestedAt && Number.isNaN(Date.parse(cancellation.requestedAt))) reasons.push('INVALID_REQUESTED_AT');
  }
  if (['ACKNOWLEDGED','CANCELLED'].includes(state)) {
    if (typeof cancellation.acknowledgedAt !== 'string' || !cancellation.acknowledgedAt.trim()) reasons.push('MISSING_ACKNOWLEDGED_AT');
    else if (Number.isNaN(Date.parse(cancellation.acknowledgedAt))) reasons.push('INVALID_ACKNOWLEDGED_AT');
  }
  const unknownExternalOutcome = cancellation.externalInFlight === true && cancellation.outcomeKnown === false;
  return {
    valid:reasons.length === 0,
    state:CANCELLATION_STATES.has(state) ? state : 'UNKNOWN',
    blockNewRetries:state !== 'NONE' || reasons.length > 0,
    terminal:state === 'CANCELLED',
    requiresHumanReview:unknownExternalOutcome || reasons.length > 0,
    reasons:unknownExternalOutcome ? [...reasons, 'UNKNOWN_EXTERNAL_OUTCOME'] : reasons
  };
}

function canRequeueDeadLetter(record, {
  approvalRef,
  evidenceRef,
  cancellationState = 'NONE',
  resumeApprovalRef,
  external = false,
  outcomeKnown = true
} = {}) {
  const validation = validateDeadLetterRecord(record);
  const reasons = validation.valid ? [] : validation.reasons.map((reason) => `DEAD_LETTER:${reason}`);
  if (record?.resolutionState === 'REJECTED') reasons.push('DEAD_LETTER_REJECTED');
  if (!approvalRef) reasons.push('MISSING_APPROVAL_REF');
  if (!evidenceRef) reasons.push('MISSING_REQUEUE_EVIDENCE_REF');
  if (!record?.idempotencyKey) reasons.push('MISSING_IDEMPOTENCY_KEY');
  if (!CANCELLATION_STATES.has(cancellationState)) reasons.push('INVALID_CANCELLATION_STATE');
  if (cancellationState !== 'NONE' && !resumeApprovalRef) reasons.push('CANCELLED_SUBJECT_REQUIRES_RESUME_APPROVAL');
  if (external && outcomeKnown === false) reasons.push('UNKNOWN_EXTERNAL_OUTCOME');
  return { allowed:reasons.length === 0, reasons };
}

const RUN_CONTROL_STATES = new Set(['RUNNING', 'PAUSED', 'KILLED']);

function evaluateRunControl(control) {
  const reasons = [];
  if (!control || typeof control !== 'object' || Array.isArray(control)) {
    return { allowed:false, state:'UNKNOWN', reasons:['MISSING_RUNTIME_CONTROL'] };
  }
  if (!RUN_CONTROL_STATES.has(control.state)) reasons.push('INVALID_CONTROL_STATE');
  if (!control.controlRef || typeof control.controlRef !== 'string') reasons.push('MISSING_CONTROL_REF');
  if (control.state === 'PAUSED') reasons.push('RUNTIME_PAUSED');
  if (control.state === 'KILLED') reasons.push('KILL_SWITCH_ACTIVE');
  return { allowed: reasons.length === 0, state: RUN_CONTROL_STATES.has(control.state) ? control.state : 'UNKNOWN', reasons };
}

function planRollback(input) {
  const reasons = [];
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { allowed:false, reasons:['INVALID_ROLLBACK_REQUEST'] };
  const { currentVersion, targetVersion, lastKnownGoodVersion, reason, evidenceRef } = input;
  if (!currentVersion) reasons.push('MISSING_CURRENT_VERSION');
  if (!targetVersion) reasons.push('MISSING_TARGET_VERSION');
  if (!lastKnownGoodVersion) reasons.push('MISSING_LAST_KNOWN_GOOD_VERSION');
  if (!reason) reasons.push('MISSING_ROLLBACK_REASON');
  if (!evidenceRef) reasons.push('MISSING_EVIDENCE_REF');
  if (currentVersion && targetVersion && currentVersion === targetVersion) reasons.push('TARGET_EQUALS_CURRENT_VERSION');
  if (targetVersion && lastKnownGoodVersion && targetVersion !== lastKnownGoodVersion) reasons.push('TARGET_NOT_LAST_KNOWN_GOOD');
  return {
    allowed: reasons.length === 0,
    currentVersion: currentVersion || null,
    targetVersion: targetVersion || null,
    reasons
  };
}

function automationValueReview(input) {
  const runs = Number(input?.runs || 0);
  const successfulRuns = Number(input?.successfulRuns || 0);
  const manualMinutesAvoided = Number(input?.manualMinutesAvoided || 0);
  const ownerMinutesRequired = Number(input?.ownerMinutesRequired || 0);
  const operatingCostCents = Number(input?.operatingCostCents || 0);
  const avoidedCostCents = Number(input?.avoidedCostCents || 0);
  const incidents = Number(input?.incidents || 0);
  const falseAlerts = Number(input?.falseAlerts || 0);
  const decisionsResolved = Number(input?.decisionsResolved || 0);

  const successRate = runs > 0 ? successfulRuns / runs : 0;
  const netMinutesSaved = manualMinutesAvoided - ownerMinutesRequired;
  const netFinancialValueCents = avoidedCostCents - operatingCostCents;
  const falseAlertRate = incidents > 0 ? falseAlerts / incidents : 0;

  let recommendation = 'KEEP';
  const reasons = [];
  if (runs >= 5 && successRate < 0.8) { recommendation = 'REVIEW'; reasons.push('LOW_SUCCESS_RATE'); }
  if (netMinutesSaved < 0) { recommendation = 'REVIEW'; reasons.push('NEGATIVE_TIME_VALUE'); }
  if (netFinancialValueCents < 0 && netMinutesSaved <= 0) { recommendation = 'RETIRE'; reasons.push('NEGATIVE_TOTAL_VALUE'); }
  if (falseAlertRate > 0.25) { recommendation = recommendation === 'RETIRE' ? 'RETIRE' : 'REVIEW'; reasons.push('HIGH_FALSE_ALERT_RATE'); }
  if (runs >= 10 && decisionsResolved === 0 && netMinutesSaved <= 0 && netFinancialValueCents <= 0) { recommendation = 'RETIRE'; reasons.push('NO_MEASURABLE_OUTCOME'); }

  return { runs, successRate, netMinutesSaved, netFinancialValueCents, falseAlertRate, decisionsResolved, recommendation, reasons };
}

module.exports = {
  canReplayAction,
  classifyRecovery,
  retryDecision,
  validateDeadLetterRecord,
  evaluateCancellation,
  canRequeueDeadLetter,
  evaluateRunControl,
  planRollback,
  automationValueReview
};
