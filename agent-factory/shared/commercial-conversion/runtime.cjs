const crypto = require('node:crypto');

const REQUIRED_QUALIFIED_OPPORTUNITY_FIELDS = [
  'opportunityId', 'canonicalLeadId', 'channel', 'sourceRef', 'observedAt',
  'buyerIdentity', 'buyerFitEvidence', 'painEvidence', 'buyingIntentEvidence',
  'leadScore', 'route', 'requestedOrInferredNeed', 'expectedDealValueRange',
  'communicationState', 'latestReplyOrSignalRef', 'nextRecommendedAction',
  'provenance', 'idempotencyKey'
];

const ACCEPTED_ROUTES = new Set(['HOT_REVIEW', 'WARM_QUEUE']);
const CONTACTABLE_STATES = new Set(['CONTACTABLE', 'REPLIED', 'OWNER_APPROVED_CONTACT_ROUTE']);
const BLOCKED_COMMUNICATION_STATES = new Set(['DO_NOT_CONTACT', 'OPTED_OUT', 'SUPPRESSED']);
const ACCEPTANCE_PAYMENT_STATES = new Set(['UNKNOWN', 'PENDING', 'NOT_REQUIRED_PRE_DELIVERY']);

function nonEmpty(value) {
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === 'object') return Object.keys(value).length > 0;
  return value !== null && value !== undefined && String(value).trim().length > 0;
}

function hashObject(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function validateQualifiedOpportunity(packet) {
  const reasons = [];
  if (!packet || typeof packet !== 'object') {
    return { valid: false, reasons: ['MISSING_REQUIRED_FIELD'] };
  }

  const missing = REQUIRED_QUALIFIED_OPPORTUNITY_FIELDS.filter((field) => !nonEmpty(packet[field]));
  if (missing.length) reasons.push('MISSING_REQUIRED_FIELD');

  if (BLOCKED_COMMUNICATION_STATES.has(packet.communicationState)) {
    reasons.push('DO_NOT_CONTACT');
  } else if (!CONTACTABLE_STATES.has(packet.communicationState)) {
    reasons.push('MISSING_REQUIRED_FIELD');
  }

  if (!Number.isFinite(packet.leadScore) || packet.leadScore < 60 || packet.leadScore > 100 || !ACCEPTED_ROUTES.has(packet.route)) {
    reasons.push('INVALID_SCORE_OR_ROUTE');
  }
  if (!nonEmpty(packet.buyerIdentity)) reasons.push('MISSING_BUYER_IDENTITY');
  if (!nonEmpty(packet.requestedOrInferredNeed)) reasons.push('MISSING_NEED');
  if (!nonEmpty(packet.buyerFitEvidence) || !nonEmpty(packet.painEvidence) || !nonEmpty(packet.buyingIntentEvidence) || !nonEmpty(packet.provenance)) {
    reasons.push('MISSING_EVIDENCE');
  }

  return { valid: reasons.length === 0, reasons: [...new Set(reasons)], missingFields: missing };
}

function receiveQualifiedOpportunity(packet, options = {}) {
  const seenKeys = options.seenKeys || new Set();
  const now = options.now || new Date().toISOString();
  const validation = validateQualifiedOpportunity(packet);

  if (packet?.idempotencyKey && seenKeys.has(packet.idempotencyKey)) {
    return {
      type: 'conversion_rejection_v1',
      status: 'REJECTED',
      opportunityId: packet.opportunityId || null,
      canonicalLeadId: packet.canonicalLeadId || null,
      reasons: ['DUPLICATE_OR_REPLAY'],
      remediationOwner: 'Demand & Acquisition',
      externalActionsPerformed: 0
    };
  }

  if (!validation.valid) {
    return {
      type: 'conversion_rejection_v1',
      status: 'REJECTED',
      opportunityId: packet?.opportunityId || null,
      canonicalLeadId: packet?.canonicalLeadId || null,
      reasons: validation.reasons,
      missingFields: validation.missingFields,
      remediationOwner: 'Demand & Acquisition',
      externalActionsPerformed: 0
    };
  }

  seenKeys.add(packet.idempotencyKey);

  const opportunityRecord = {
    opportunity_id: packet.opportunityId,
    lead_id: packet.canonicalLeadId,
    contract_version: 'CCLC-001-v1.0',
    record_mode: options.recordMode || 'SIMULATION',
    state: 'CONVERSION_ACTIVE',
    need_summary: packet.requestedOrInferredNeed,
    expected_value_range: packet.expectedDealValueRange,
    decision_maker: packet.buyerIdentity,
    fit_evidence_refs: packet.buyerFitEvidence,
    urgency: packet.route === 'HOT_REVIEW' ? 'HIGH' : 'MEDIUM',
    stage_owner: 'Pipeline & Reply Coordinator',
    next_action: 'Review buyer need and prepare exact proposal basis',
    next_action_owner: 'Pipeline & Reply Coordinator',
    next_action_due_at: options.nextActionDueAt || null,
    provenance_refs: packet.provenance,
    correlation_id: options.correlationId || `CONV:${packet.opportunityId}`,
    idempotency_key: packet.idempotencyKey,
    blocked_status: 'not_blocked',
    created_at: now,
    updated_at: now
  };

  return {
    type: 'conversion_acceptance_v1',
    status: 'ACCEPTED',
    acceptedAt: now,
    inputType: 'qualified_opportunity_v1',
    opportunityRecord,
    owner: 'Pipeline & Reply Coordinator',
    nextState: 'CONVERSION_ACTIVE',
    externalActionsPerformed: 0,
    authorityGranted: false
  };
}

function buildProposalDraft(input, options = {}) {
  const required = ['proposalId', 'opportunityId', 'version', 'price', 'currency', 'deliverables', 'exclusions', 'assumptions', 'expiresAt', 'evidenceRefs'];
  const missing = required.filter((field) => !nonEmpty(input?.[field]));
  if (missing.length) throw new Error(`missing proposal fields: ${missing.join(',')}`);
  if (!Number.isFinite(input.price) || input.price < 0) throw new Error('price must be a non-negative number');

  const snapshot = {
    opportunityId: input.opportunityId,
    version: input.version,
    price: input.price,
    currency: input.currency,
    deliverables: input.deliverables,
    exclusions: input.exclusions,
    assumptions: input.assumptions,
    expiresAt: input.expiresAt
  };
  const hash = hashObject(snapshot);
  const now = options.now || new Date().toISOString();

  return {
    type: 'proposal_draft_v1',
    proposalRecord: {
      proposal_id: input.proposalId,
      opportunity_id: input.opportunityId,
      version: input.version,
      hash,
      price: input.price,
      currency: input.currency,
      deliverables: input.deliverables,
      exclusions: input.exclusions,
      assumptions: input.assumptions,
      expires_at: input.expiresAt,
      approval_state: 'DRAFT_INTERNAL',
      send_state: 'BLOCKED_PENDING_OWNER_APPROVAL',
      evidence_refs: input.evidenceRefs,
      created_at: now
    },
    externalActionsPerformed: 0,
    authorityGranted: false
  };
}

function authorizeProposalForSend(proposalRecord, permit, options = {}) {
  const nowMs = Date.parse(options.now || new Date().toISOString());
  const valid = Boolean(
    proposalRecord &&
    permit &&
    permit.status === 'APPROVED' &&
    permit.proposalId === proposalRecord.proposal_id &&
    permit.proposalVersion === proposalRecord.version &&
    permit.proposalHash === proposalRecord.hash &&
    permit.approvedBy &&
    permit.approvedAt &&
    permit.expiresAt &&
    Date.parse(permit.expiresAt) > nowMs
  );

  if (!valid) {
    return {
      authorized: false,
      mode: 'BLOCKED_PENDING_EXACT_OWNER_APPROVAL',
      externalActionsPerformed: 0
    };
  }

  return {
    authorized: true,
    mode: 'PERMITTED_FOR_SEPARATE_EXTERNAL_EXECUTION',
    approvedProposal: {
      type: 'approved_proposal_v1',
      proposalId: proposalRecord.proposal_id,
      opportunityId: proposalRecord.opportunity_id,
      version: proposalRecord.version,
      hash: proposalRecord.hash,
      price: proposalRecord.price,
      currency: proposalRecord.currency,
      approvalPermitId: permit.permitId,
      approvedBy: permit.approvedBy,
      approvedAt: permit.approvedAt,
      expiresAt: permit.expiresAt
    },
    externalActionsPerformed: 0
  };
}

function recordCommercialAcceptance(proposalRecord, acceptance, options = {}) {
  if (!proposalRecord || !acceptance) throw new Error('proposal and acceptance are required');
  const required = ['acceptanceId', 'opportunityId', 'proposalId', 'acceptedVersion', 'acceptedHash', 'authoritativeContactId', 'acceptanceEvidenceRef', 'acceptedAt', 'paymentStatus'];
  const missing = required.filter((field) => !nonEmpty(acceptance[field]));
  if (missing.length) throw new Error(`missing acceptance fields: ${missing.join(',')}`);
  if (acceptance.opportunityId !== proposalRecord.opportunity_id || acceptance.proposalId !== proposalRecord.proposal_id || acceptance.acceptedVersion !== proposalRecord.version || acceptance.acceptedHash !== proposalRecord.hash) {
    throw new Error('acceptance does not match exact proposal version/hash');
  }
  if (!ACCEPTANCE_PAYMENT_STATES.has(acceptance.paymentStatus)) {
    throw new Error('payment status must remain UNKNOWN, PENDING, or NOT_REQUIRED_PRE_DELIVERY until authoritative verification');
  }

  return {
    type: 'commercial_acceptance_v1',
    commercialAcceptanceRecord: {
      acceptance_id: acceptance.acceptanceId,
      opportunity_id: acceptance.opportunityId,
      proposal_id: acceptance.proposalId,
      accepted_version: acceptance.acceptedVersion,
      accepted_hash: acceptance.acceptedHash,
      authoritative_contact_id: acceptance.authoritativeContactId,
      acceptance_evidence_ref: acceptance.acceptanceEvidenceRef,
      exceptions: acceptance.exceptions || [],
      payment_requirement: acceptance.paymentRequirement || 'VERIFY_APPLICABLE_CONDITION',
      payment_status: acceptance.paymentStatus,
      accepted_at: acceptance.acceptedAt
    },
    currentState: 'COMMERCIAL_ACCEPTED',
    nextState: 'PAYMENT_PENDING',
    paymentVerified: false,
    moneyMovementPerformed: 0,
    externalActionsPerformed: 0,
    authorityGranted: false
  };
}

module.exports = {
  REQUIRED_QUALIFIED_OPPORTUNITY_FIELDS,
  validateQualifiedOpportunity,
  receiveQualifiedOpportunity,
  buildProposalDraft,
  authorizeProposalForSend,
  recordCommercialAcceptance,
  hashObject
};
