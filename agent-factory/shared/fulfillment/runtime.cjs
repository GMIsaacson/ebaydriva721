const crypto = require('node:crypto');

function nonEmpty(value) {
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === 'object') return Object.keys(value).length > 0;
  return value !== null && value !== undefined && String(value).trim().length > 0;
}

function sha256(value) {
  return crypto.createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
}

function verifyClientReadiness(commercialAcceptance, evidence, options = {}) {
  const reasons = [];
  const now = options.now || new Date().toISOString();
  const accepted = commercialAcceptance?.commercialAcceptanceRecord;

  if (commercialAcceptance?.type !== 'commercial_acceptance_v1' || !accepted) reasons.push('INVALID_COMMERCIAL_ACCEPTANCE');
  if (!nonEmpty(evidence?.customerId) || !nonEmpty(evidence?.contactId)) reasons.push('MISSING_CUSTOMER_IDENTITY');
  if (evidence?.identityStatus !== 'VERIFIED') reasons.push('IDENTITY_NOT_VERIFIED');
  if (evidence?.authorityStatus !== 'VERIFIED' || !nonEmpty(evidence?.authorityEvidenceRef)) reasons.push('AUTHORITY_NOT_VERIFIED');
  if (evidence?.routeStatus !== 'APPROVED' || evidence?.optOutStatus !== 'NOT_OPTED_OUT') reasons.push('DELIVERY_ROUTE_NOT_APPROVED');
  if (!['COLLECTED', 'NOT_REQUIRED_PRE_DELIVERY'].includes(evidence?.paymentStatus) || !nonEmpty(evidence?.paymentEvidenceRef)) reasons.push('PAYMENT_CONDITION_NOT_VERIFIED');
  if (evidence?.intakeStatus !== 'COMPLETE' || !nonEmpty(evidence?.intakeEvidenceRefs)) reasons.push('INTAKE_INCOMPLETE');
  if (!nonEmpty(evidence?.deliveryDueAt)) reasons.push('DELIVERY_TIMING_MISSING');
  if (!nonEmpty(evidence?.projectOwner)) reasons.push('PROJECT_OWNER_MISSING');
  if (!nonEmpty(evidence?.productionAdapter)) reasons.push('PRODUCTION_ADAPTER_MISSING');

  if (accepted && evidence?.acceptedScope) {
    if (
      accepted.proposal_id !== evidence.acceptedScope.proposalId ||
      accepted.accepted_version !== evidence.acceptedScope.version ||
      accepted.accepted_hash !== evidence.acceptedScope.hash
    ) reasons.push('SCOPE_ACCEPTANCE_MISMATCH');
  } else {
    reasons.push('SCOPE_ACCEPTANCE_MISSING');
  }

  if (reasons.length) {
    return {
      type: 'fulfillment_rejection_v1',
      status: 'REJECTED',
      reasons: [...new Set(reasons)],
      remediationOwner: 'Commercial Conversion / Client Readiness',
      externalActionsPerformed: 0,
      moneyMovementPerformed: 0
    };
  }

  const engagementId = evidence.engagementId || `ENG:${accepted.acceptance_id}`;
  const correlationId = evidence.correlationId || `FULFILL:${engagementId}`;
  const idempotencyKey = evidence.idempotencyKey || sha256(`${accepted.acceptance_id}|${engagementId}|${evidence.productionAdapter}`);

  return {
    type: 'client_ready_v1',
    status: 'ACCEPTED',
    clientReady: {
      engagementId,
      customerId: evidence.customerId,
      contactId: evidence.contactId,
      acceptanceId: accepted.acceptance_id,
      proposalId: accepted.proposal_id,
      acceptedScopeVersion: accepted.accepted_version,
      acceptedScopeHash: accepted.accepted_hash,
      paymentStatus: evidence.paymentStatus,
      paymentEvidenceRef: evidence.paymentEvidenceRef,
      intakeEvidenceRefs: evidence.intakeEvidenceRefs,
      deliveryDueAt: evidence.deliveryDueAt,
      projectOwner: evidence.projectOwner,
      productionAdapter: evidence.productionAdapter,
      route: evidence.route,
      recipient: evidence.recipient,
      recordMode: evidence.recordMode || 'SIMULATION',
      state: 'CLIENT_READY',
      correlationId,
      idempotencyKey,
      createdAt: now
    },
    engagementProjectRecord: {
      engagement_id: engagementId,
      customer_id: evidence.customerId,
      acceptance_id: accepted.acceptance_id,
      accepted_scope_version: accepted.accepted_version,
      project_owner: evidence.projectOwner,
      production_adapter: evidence.productionAdapter,
      milestones: evidence.milestones || ['PRODUCTION', 'QA', 'DELIVERY_APPROVAL', 'DELIVERY'],
      due_at: evidence.deliveryDueAt,
      dependencies: [],
      status: 'CLIENT_READY',
      created_at: now,
      updated_at: now
    },
    externalActionsPerformed: 0,
    moneyMovementPerformed: 0,
    authorityGranted: false
  };
}

function buildProductionPacket(clientReadyResult, input = {}, options = {}) {
  const cr = clientReadyResult?.clientReady;
  if (clientReadyResult?.type !== 'client_ready_v1' || !cr || cr.state !== 'CLIENT_READY') {
    throw new Error('production requires accepted client_ready_v1');
  }
  if (!nonEmpty(input.scopeInstructions) || !nonEmpty(input.requiredOutputs)) {
    throw new Error('scopeInstructions and requiredOutputs are required');
  }
  const now = options.now || new Date().toISOString();
  return {
    type: 'production_packet_v1',
    engagementId: cr.engagementId,
    customerId: cr.customerId,
    scopeVersion: cr.acceptedScopeVersion,
    scopeHash: cr.acceptedScopeHash,
    productionAdapter: cr.productionAdapter,
    scopeInstructions: input.scopeInstructions,
    requiredOutputs: input.requiredOutputs,
    exclusions: input.exclusions || [],
    evidenceRefs: input.evidenceRefs || [],
    dueAt: cr.deliveryDueAt,
    recordMode: cr.recordMode,
    state: 'IN_DELIVERY',
    createdAt: now,
    externalActionsPerformed: 0,
    authorityGranted: false
  };
}

function runSyntheticProductionAdapter(packet, options = {}) {
  if (packet?.type !== 'production_packet_v1' || packet?.recordMode !== 'SIMULATION') {
    throw new Error('P3 adapter accepts simulation production_packet_v1 only');
  }
  if (packet.productionAdapter !== 'SYNTHETIC-TEXT-DELIVERABLE-v1') {
    throw new Error('unsupported P3 production adapter');
  }
  const now = options.now || new Date().toISOString();
  const artifactVersion = options.artifactVersion || 'v1.0';
  const content = options.content || `Synthetic deliverable for ${packet.engagementId}\nScope: ${packet.scopeVersion}\nOutputs: ${packet.requiredOutputs.join(', ')}`;
  const artifactHash = sha256(content);
  return {
    type: 'qa_eligible_delivery_v1',
    engagementId: packet.engagementId,
    scopeVersion: packet.scopeVersion,
    scopeHash: packet.scopeHash,
    artifactVersion,
    artifactHash,
    artifactManifest: [{name: 'synthetic-deliverable.txt', sha256: artifactHash}],
    artifactContent: content,
    evidenceRefs: [...(packet.evidenceRefs || []), 'SIMULATED_PRODUCTION_EVIDENCE'],
    producedBy: 'SYNTHETIC-TEXT-DELIVERABLE-v1',
    producedAt: now,
    recordMode: 'SIMULATION',
    state: 'QA_REVIEW',
    externalActionsPerformed: 0,
    authorityGranted: false
  };
}

function independentQaReview(qaEligible, review = {}, options = {}) {
  if (qaEligible?.type !== 'qa_eligible_delivery_v1') throw new Error('qa_eligible_delivery_v1 required');
  if (!nonEmpty(review.qaReviewerId)) throw new Error('qaReviewerId required');
  if (review.qaReviewerId === qaEligible.producedBy) throw new Error('QA reviewer must be independent from producer');
  if (sha256(qaEligible.artifactContent) !== qaEligible.artifactHash) throw new Error('artifact hash mismatch');
  if (!nonEmpty(qaEligible.scopeVersion) || !nonEmpty(qaEligible.scopeHash)) throw new Error('scope identity missing');

  const findings = review.findings || [];
  const openBlocking = findings.filter(f => ['Critical', 'Major'].includes(f.severity) && f.status !== 'CLOSED');
  const verdict = review.forceVerdict === 'ESCALATE' ? 'ESCALATE' : openBlocking.length ? 'FAIL' : 'PASS';
  const now = options.now || new Date().toISOString();
  const deliveryId = review.deliveryId || `DEL:${qaEligible.engagementId}:${qaEligible.artifactVersion}`;

  return {
    type: 'qa_review_v1',
    verdict,
    deliveryId,
    engagementId: qaEligible.engagementId,
    artifactVersion: qaEligible.artifactVersion,
    artifactHash: qaEligible.artifactHash,
    qaReviewerId: review.qaReviewerId,
    findings,
    reviewedAt: now,
    currentState: 'QA_REVIEW',
    nextState: verdict === 'PASS' ? 'DELIVERY_APPROVAL_PENDING' : 'IN_DELIVERY',
    deliveryAuthorized: false,
    externalActionsPerformed: 0
  };
}

function authorizeDelivery(qaResult, permit, deliveryTarget, options = {}) {
  const nowMs = Date.parse(options.now || new Date().toISOString());
  if (qaResult?.verdict !== 'PASS') {
    return {authorized: false, mode: 'BLOCKED_QA_NOT_PASS', externalActionsPerformed: 0};
  }
  const valid = Boolean(
    permit &&
    permit.status === 'APPROVED' &&
    permit.deliveryId === qaResult.deliveryId &&
    permit.artifactVersion === qaResult.artifactVersion &&
    permit.artifactHash === qaResult.artifactHash &&
    permit.recipient === deliveryTarget?.recipient &&
    permit.route === deliveryTarget?.route &&
    permit.approvedBy && permit.approvedAt && permit.expiresAt &&
    Date.parse(permit.expiresAt) > nowMs
  );
  if (!valid) return {authorized: false, mode: 'BLOCKED_PENDING_EXACT_OWNER_APPROVAL', externalActionsPerformed: 0};
  return {
    authorized: true,
    mode: 'PERMITTED_FOR_SEPARATE_DELIVERY_EXECUTION',
    approvedDelivery: {
      type: 'approved_delivery_v1',
      deliveryId: qaResult.deliveryId,
      engagementId: qaResult.engagementId,
      artifactVersion: qaResult.artifactVersion,
      artifactHash: qaResult.artifactHash,
      recipient: deliveryTarget.recipient,
      route: deliveryTarget.route,
      approvalPermitId: permit.permitId,
      approvedBy: permit.approvedBy,
      approvedAt: permit.approvedAt,
      expiresAt: permit.expiresAt
    },
    externalActionsPerformed: 0
  };
}

function recordSimulatedDelivery(approved, receipt, options = {}) {
  if (!approved?.authorized || approved?.approvedDelivery?.type !== 'approved_delivery_v1') {
    throw new Error('approved_delivery_v1 required');
  }
  const d = approved.approvedDelivery;
  if (d.route !== 'SIMULATION_SINK' || d.recipient !== 'SIMULATED_CUSTOMER') {
    throw new Error('P3 validation delivery is simulation-only');
  }
  if (!nonEmpty(receipt?.receiptId) || !nonEmpty(receipt?.deliveredAt)) throw new Error('delivery receipt required');
  const now = options.now || receipt.deliveredAt;
  return {
    type: 'delivered_engagement_v1',
    engagementId: d.engagementId,
    deliveryId: d.deliveryId,
    artifactVersion: d.artifactVersion,
    artifactHash: d.artifactHash,
    recipient: d.recipient,
    route: d.route,
    deliveryReceiptRef: receipt.receiptId,
    deliveredAt: receipt.deliveredAt,
    state: 'DELIVERED',
    nextOwner: 'Customer Success',
    nextState: 'ACCEPTANCE_SUPPORT',
    recordedAt: now,
    externalActionsPerformed: 0,
    moneyMovementPerformed: 0,
    authorityGranted: false
  };
}

module.exports = {
  sha256,
  verifyClientReadiness,
  buildProductionPacket,
  runSyntheticProductionAdapter,
  independentQaReview,
  authorizeDelivery,
  recordSimulatedDelivery
};
