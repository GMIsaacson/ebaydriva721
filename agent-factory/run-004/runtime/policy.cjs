const { calculateEconomics } = require('./economics.cjs');

const ALLOWED_ACTIONS = Object.freeze([
  'read_internal',
  'read_public_evidence',
  'write_internal_evidence',
  'recommend',
  'draft_unpublished',
]);

const PROHIBITED_ACTIONS = Object.freeze([
  'purchase',
  'bid',
  'outreach',
  'send',
  'publish',
  'list',
  'spend',
  'schedule',
  'change_permission',
  'delete_evidence',
]);

function decision(status, reason, extras = {}) {
  return {
    status,
    reason,
    gateAdvance: status === 'Accepted',
    externalActions: 0,
    spendingCents: 0,
    humanReviewRequired: ['Review', 'Incomplete', 'Rejected'].includes(status),
    loggedEvents: [],
    ...extras,
  };
}

function evaluatePolicy(request, config) {
  if (!request || typeof request !== 'object') return decision('Rejected', 'request is required');
  if (!ALLOWED_ACTIONS.includes(request.requestedAction)) {
    const label = PROHIBITED_ACTIONS.includes(request.requestedAction)
      ? `prohibited action: ${request.requestedAction}`
      : `unknown action: ${request.requestedAction}`;
    return decision('Rejected', label);
  }
  if (request.candidateCount > config.maxCandidates) return decision('Rejected', 'candidate cap exceeded');
  if (request.sourceRequestCount > config.maxSourceRequests) {
    return decision('Rejected', 'source-request cap exceeded');
  }
  if ((request.spendingRequestedCents || 0) > config.spendingAuthorityCents) {
    return decision('Rejected', 'spending authority exceeded');
  }
  if (request.requestedAction === 'draft_unpublished' && !request.approvalRef) {
    return decision('Rejected', 'exact owner approval is required for Builder drafting');
  }
  if (!request.exactIdentity) return decision('Incomplete', 'exact candidate identity is uncertain');
  if (!request.hasSoldEvidence) return decision('Incomplete', 'sold evidence is missing');
  if (request.partialFailure) return decision('Incomplete', 'partial failure cannot advance');
  if (request.evidenceAgeDays > config.evidenceMaxAgeDays) {
    return decision('Review', 'evidence is stale');
  }
  if (request.conflictingEvidence) {
    return decision('Review', 'conflicting evidence retained with provenance', {
      loggedEvents: ['conflicting-evidence'],
    });
  }

  const economics = calculateEconomics(request.economics || {});
  if (economics.status !== 'Complete') {
    return decision('Incomplete', 'deterministic economics inputs are incomplete', { economics });
  }

  const loggedEvents = request.promptInjection ? ['prompt-injection-ignored'] : [];
  return decision('Accepted', 'bounded internal action permitted', { economics, loggedEvents });
}

module.exports = {
  ALLOWED_ACTIONS,
  PROHIBITED_ACTIONS,
  evaluatePolicy,
};
