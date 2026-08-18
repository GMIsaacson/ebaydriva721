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
  if (['TRANSIENT_NETWORK','RATE_LIMIT','TEMPORARY_PROVIDER'].includes(failureType)) return { mode:'SAFE_RETRY', reason:'TRANSIENT_FAILURE' };
  if (['VALIDATION','AUTHORITY','COST_CEILING','POLICY'].includes(failureType)) return { mode:'DO_NOT_RETRY', reason:'DETERMINISTIC_REJECTION' };
  return { mode:'HUMAN_REVIEW', reason:'UNCLASSIFIED_FAILURE' };
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

module.exports = { canReplayAction, classifyRecovery, evaluateRunControl, planRollback, automationValueReview };
