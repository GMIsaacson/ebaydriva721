const { normalizeDecision } = require('../runtime/decision-notification.cjs');

function run006ExceptionToDecision(exception) {
  if (!exception || typeof exception !== 'object') return { valid:false, errors:['INVALID_RUN006_EXCEPTION'] };
  const authorityRequired = exception.humanApproval === true ? 'OWNER_APPROVAL' : 'NONE';
  const severity = exception.severity === 'High' ? 'URGENT' : exception.severity === 'Medium' ? 'ATTENTION' : 'INFO';
  return normalizeDecision({
    producerId: 'SUB-OPS-006',
    subjectId: exception.subjectId || `subscription:${String(exception.vendor || 'unknown').toLowerCase().replace(/[^a-z0-9]+/g,'-')}`,
    decisionType: exception.code || exception.type || 'SUBSCRIPTION_EXCEPTION',
    naturalKey: exception.naturalKey || exception.evidenceId || exception.deadlineAt || '',
    subject: exception.subject || `${exception.vendor || 'Subscription'} requires review`,
    reason: exception.reason || exception.message || exception.code || 'Subscription exception requires review.',
    recommendation: exception.recommendation || 'Review the evidence and decide whether any owner-authorized action is required.',
    authorityRequired,
    severity,
    status: 'OPEN',
    deadlineAt: exception.deadlineAt || null,
    estimatedCostCents: Number.isInteger(exception.estimatedCostCents) ? exception.estimatedCostCents : 0,
    evidenceRefs: Array.isArray(exception.evidenceRefs) ? exception.evidenceRefs : exception.evidenceId ? [exception.evidenceId] : []
  });
}

module.exports = { run006ExceptionToDecision };
