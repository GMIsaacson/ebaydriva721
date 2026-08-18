const crypto = require('node:crypto');

function nonEmpty(value) {
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === 'object') return Object.keys(value).length > 0;
  return value !== null && value !== undefined && String(value).trim().length > 0;
}

function sha256(value) {
  return crypto.createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
}

function acceptDeliveredEngagement(delivered, context = {}, options = {}) {
  const reasons = [];
  const now = options.now || new Date().toISOString();
  if (delivered?.type !== 'delivered_engagement_v1') reasons.push('INVALID_DELIVERED_HANDOFF');
  if (!nonEmpty(delivered?.engagementId) || !nonEmpty(delivered?.deliveryId)) reasons.push('DELIVERY_IDENTITY_MISSING');
  if (!nonEmpty(delivered?.artifactVersion) || !nonEmpty(delivered?.artifactHash)) reasons.push('DELIVERED_VERSION_MISSING');
  if (!nonEmpty(delivered?.deliveryReceiptRef) || !nonEmpty(delivered?.deliveredAt)) reasons.push('DELIVERY_RECEIPT_MISSING');
  if (delivered?.state !== 'DELIVERED' || delivered?.nextOwner !== 'Customer Success') reasons.push('OWNERSHIP_HANDOFF_INVALID');
  if (!nonEmpty(context?.customerId)) reasons.push('CUSTOMER_ID_MISSING');

  if (reasons.length) {
    return {
      type: 'customer_success_rejection_v1', status: 'REJECTED', reasons: [...new Set(reasons)],
      remediationOwner: 'Delivery Control', externalActionsPerformed: 0, moneyMovementPerformed: 0
    };
  }

  const successId = context.successId || `SUCCESS:${delivered.engagementId}`;
  const permissions = context.permissions || {};
  return {
    type: 'customer_success_acceptance_v1',
    status: 'ACCEPTED',
    successRecord: {
      success_id: successId,
      engagement_id: delivered.engagementId,
      customer_id: context.customerId,
      acceptance_state: 'PENDING_CUSTOMER_ACCEPTANCE_OR_SUPPORT',
      issues: [],
      revisions: [],
      measured_outcome: 'NOT_MEASURED',
      satisfaction_evidence_refs: [],
      renewal_state: 'NOT_EVALUATED',
      expansion_state: 'NOT_EVALUATED',
      testimonial_permission: permissions.testimonial || 'UNKNOWN',
      referral_permission: permissions.referral || 'UNKNOWN',
      case_study_permission: permissions.caseStudy || 'UNKNOWN',
      created_at: now,
      updated_at: now
    },
    lifecycle: {priorState:'DELIVERED', newState:'ACCEPTANCE_SUPPORT', owner:'Customer Success'},
    deliveryEvidence: {
      deliveryId: delivered.deliveryId,
      artifactVersion: delivered.artifactVersion,
      artifactHash: delivered.artifactHash,
      deliveryReceiptRef: delivered.deliveryReceiptRef,
      deliveredAt: delivered.deliveredAt
    },
    correlationId: context.correlationId || `CS:${delivered.engagementId}`,
    idempotencyKey: context.idempotencyKey || sha256(`${delivered.deliveryId}|${delivered.deliveryReceiptRef}|${context.customerId}`),
    externalActionsPerformed: 0,
    moneyMovementPerformed: 0,
    authorityGranted: false
  };
}

function classifySupportCase(csAccepted, request = {}, options = {}) {
  if (csAccepted?.type !== 'customer_success_acceptance_v1') throw new Error('customer_success_acceptance_v1 required');
  const allowed = new Set(['CLARIFICATION','CORRECTION','IN_SCOPE_REVISION','NEW_SCOPE_REQUEST','INCIDENT','REFUND_REQUEST','COMPLAINT','PRAISE_OR_SUCCESS_SIGNAL']);
  if (!allowed.has(request.classification)) throw new Error('unsupported support classification');
  if (!nonEmpty(request.evidenceRef)) throw new Error('support evidenceRef required');
  const now = options.now || new Date().toISOString();
  const blocking = ['INCIDENT','REFUND_REQUEST','COMPLAINT'].includes(request.classification) || request.severity === 'Critical' || request.severity === 'Major';
  const needsFulfillment = ['CORRECTION','IN_SCOPE_REVISION','INCIDENT'].includes(request.classification);
  const needsCommercialConversion = request.classification === 'NEW_SCOPE_REQUEST';
  const needsOwnerEscalation = ['REFUND_REQUEST','COMPLAINT'].includes(request.classification) || request.severity === 'Critical';
  return {
    type:'support_case_v1',
    caseId: request.caseId || `CASE:${csAccepted.successRecord.engagement_id}:${sha256(request.evidenceRef).slice(0,12)}`,
    engagementId: csAccepted.successRecord.engagement_id,
    customerId: csAccepted.successRecord.customer_id,
    classification: request.classification,
    severity: request.severity || 'Normal',
    evidenceRef: request.evidenceRef,
    summary: request.summary || '',
    blocking,
    needsFulfillment,
    needsCommercialConversion,
    needsOwnerEscalation,
    draftResponseAllowed: true,
    externalSendAllowed: false,
    refundAuthorized: false,
    createdAt: now,
    externalActionsPerformed:0,
    moneyMovementPerformed:0
  };
}

function buildFulfillmentRemediationRequest(supportCase, details = {}, options = {}) {
  if (supportCase?.type !== 'support_case_v1' || !supportCase.needsFulfillment) throw new Error('fulfillment remediation requires qualifying support case');
  if (!nonEmpty(details.currentArtifactVersion) || !nonEmpty(details.currentArtifactHash)) throw new Error('current artifact identity required');
  return {
    type:'fulfillment_remediation_request_v1',
    caseId:supportCase.caseId,
    engagementId:supportCase.engagementId,
    classification:supportCase.classification,
    issueEvidenceRef:supportCase.evidenceRef,
    currentArtifactVersion:details.currentArtifactVersion,
    currentArtifactHash:details.currentArtifactHash,
    requestedRemediation:details.requestedRemediation || 'Investigate and return a new versioned artifact if remediation is in scope.',
    owner:'Fulfillment Control',
    preserveOriginalDelivery:true,
    requiresIndependentQa:true,
    requiresNewDeliveryApprovalIfArtifactChanges:true,
    createdAt: options.now || new Date().toISOString(),
    externalActionsPerformed:0,
    authorityGranted:false
  };
}

function recordCustomerAcceptance(csAccepted, evidence = {}, options = {}) {
  if (csAccepted?.type !== 'customer_success_acceptance_v1') throw new Error('customer_success_acceptance_v1 required');
  if (!nonEmpty(evidence.evidenceRef)) throw new Error('acceptance evidence required');
  if (!['ACCEPTED','ACCEPTED_WITH_CLARIFICATION','ISSUE_OPEN'].includes(evidence.acceptanceState)) throw new Error('invalid acceptance state');
  const now = options.now || new Date().toISOString();
  const record = {...csAccepted.successRecord};
  record.acceptance_state = evidence.acceptanceState;
  record.updated_at = now;
  if (evidence.acceptanceState === 'ISSUE_OPEN') record.issues = [...record.issues, {evidenceRef:evidence.evidenceRef, status:'OPEN'}];
  return {
    type:'customer_acceptance_evidence_v1',
    successRecord:record,
    nextState:evidence.acceptanceState === 'ISSUE_OPEN' ? 'ACCEPTANCE_SUPPORT' : 'SUCCESS_ACTIVE',
    evidenceRef:evidence.evidenceRef,
    externalActionsPerformed:0,
    authorityGranted:false
  };
}

function recordSuccessOutcome(csState, outcome = {}, options = {}) {
  const record = csState?.successRecord;
  if (!record) throw new Error('SuccessRecord required');
  if (record.acceptance_state === 'ISSUE_OPEN' || (record.issues || []).some(i => i.status === 'OPEN')) throw new Error('cannot close success outcome with unresolved issue');
  if (!nonEmpty(outcome.measuredOutcome)) throw new Error('measuredOutcome or NOT_MEASURED required');
  if (outcome.measuredOutcome !== 'NOT_MEASURED' && !nonEmpty(outcome.outcomeEvidenceRefs)) throw new Error('measured outcome requires evidence');
  const now = options.now || new Date().toISOString();
  const updated = {...record,
    measured_outcome: outcome.measuredOutcome,
    satisfaction_evidence_refs: outcome.satisfactionEvidenceRefs || [],
    updated_at: now
  };
  const proofPermission = updated.case_study_permission === 'GRANTED' || updated.testimonial_permission === 'GRANTED';
  return {
    type:'success_outcome_v1',
    engagementId:updated.engagement_id,
    customerId:updated.customer_id,
    successRecord:updated,
    lifecycleState:'SUCCESS_ACTIVE',
    measuredOutcome:outcome.measuredOutcome,
    outcomeEvidenceRefs:outcome.outcomeEvidenceRefs || [],
    publicProofEligible:Boolean(proofPermission && nonEmpty(outcome.permissionEvidenceRef)),
    publicProofPermissionEvidenceRef: proofPermission ? (outcome.permissionEvidenceRef || null) : null,
    analyticsEligible:true,
    externalActionsPerformed:0,
    publishActionsPerformed:0,
    authorityGranted:false
  };
}

function buildRenewalExpansionOpportunity(successOutcome, signal = {}, options = {}) {
  if (successOutcome?.type !== 'success_outcome_v1') throw new Error('success_outcome_v1 required');
  const allowed = new Set(['EXPLICIT_CUSTOMER_REQUEST','CONTRACTED_RENEWAL_WINDOW','EVIDENCE_BACKED_ONGOING_NEED','CUSTOMER_REQUESTED_NEW_SCOPE']);
  if (!allowed.has(signal.signalType)) throw new Error('unsupported renewal/expansion signal');
  if (!nonEmpty(signal.evidenceRef)) throw new Error('renewal/expansion evidence required');
  const blockers = signal.blockers || [];
  if (blockers.length) {
    return {type:'customer_success_escalation_v1', status:'BLOCKED', blockers, owner:'Customer Success / Owner', externalActionsPerformed:0};
  }
  return {
    type:'renewal_or_expansion_opportunity_v1',
    engagementId:successOutcome.engagementId,
    customerId:successOutcome.customerId,
    signalType:signal.signalType,
    evidenceRef:signal.evidenceRef,
    needSummary:signal.needSummary || '',
    expectedValueRange:signal.expectedValueRange || null,
    state:'RENEWAL_EXPANSION',
    sender:'Customer Success',
    receiver:'Commercial Conversion',
    commercialCommitmentMade:false,
    priceQuoted:false,
    externalActionsPerformed:0,
    authorityGranted:false,
    createdAt:options.now || new Date().toISOString()
  };
}

function authorizeCustomerSuccessExternalAction(action, permit, options = {}) {
  const nowMs = Date.parse(options.now || new Date().toISOString());
  const valid = Boolean(action?.actionId && action?.exactPayloadHash && permit && permit.status === 'APPROVED' && permit.actionId === action.actionId && permit.exactPayloadHash === action.exactPayloadHash && permit.expiresAt && Date.parse(permit.expiresAt) > nowMs);
  return valid
    ? {authorized:true, mode:'PERMITTED_FOR_SEPARATE_EXTERNAL_EXECUTION', externalActionsPerformed:0}
    : {authorized:false, mode:'BLOCKED_PENDING_EXACT_OWNER_APPROVAL', externalActionsPerformed:0};
}

module.exports = {
  sha256,
  acceptDeliveredEngagement,
  classifySupportCase,
  buildFulfillmentRemediationRequest,
  recordCustomerAcceptance,
  recordSuccessOutcome,
  buildRenewalExpansionOpportunity,
  authorizeCustomerSuccessExternalAction
};
