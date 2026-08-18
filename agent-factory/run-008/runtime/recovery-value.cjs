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

module.exports = { canReplayAction, classifyRecovery, automationValueReview };
