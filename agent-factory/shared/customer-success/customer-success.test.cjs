const test = require('node:test');
const assert = require('node:assert/strict');
const {
  acceptDeliveredEngagement,
  classifySupportCase,
  buildFulfillmentRemediationRequest,
  recordCustomerAcceptance,
  recordSuccessOutcome,
  buildRenewalExpansionOpportunity,
  authorizeCustomerSuccessExternalAction,
  sha256
} = require('./runtime.cjs');

const delivered = {
  type:'delivered_engagement_v1', engagementId:'ENG-SIM-CS-001', deliveryId:'DEL-SIM-CS-001',
  artifactVersion:'v1.0', artifactHash:'a'.repeat(64), recipient:'SIMULATED_CUSTOMER', route:'SIMULATION_SINK',
  deliveryReceiptRef:'SIM-RECEIPT-CS-001', deliveredAt:'2026-08-18T10:33:00Z', state:'DELIVERED',
  nextOwner:'Customer Success', nextState:'ACCEPTANCE_SUPPORT', externalActionsPerformed:0, moneyMovementPerformed:0
};

function accepted(overrides = {}) {
  return acceptDeliveredEngagement({...delivered, ...overrides}, {
    customerId:'CUS-SIM-001',
    permissions:{testimonial:'UNKNOWN', referral:'UNKNOWN', caseStudy:'UNKNOWN'}
  }, {now:'2026-08-18T10:34:00Z'});
}

function customerAccepted() {
  return recordCustomerAcceptance(accepted(), {
    acceptanceState:'ACCEPTED', evidenceRef:'EVID-CUSTOMER-ACCEPT-001'
  }, {now:'2026-08-18T10:35:00Z'});
}

test('rejects delivered handoff without delivery receipt', () => {
  const result = accepted({deliveryReceiptRef:null});
  assert.equal(result.type, 'customer_success_rejection_v1');
  assert.ok(result.reasons.includes('DELIVERY_RECEIPT_MISSING'));
  assert.equal(result.externalActionsPerformed, 0);
});

test('accepts valid delivered_engagement_v1 and creates canonical SuccessRecord', () => {
  const result = accepted();
  assert.equal(result.type, 'customer_success_acceptance_v1');
  assert.equal(result.lifecycle.newState, 'ACCEPTANCE_SUPPORT');
  assert.equal(result.lifecycle.owner, 'Customer Success');
  assert.equal(result.successRecord.measured_outcome, 'NOT_MEASURED');
  assert.equal(result.successRecord.testimonial_permission, 'UNKNOWN');
  assert.equal(result.externalActionsPerformed, 0);
  assert.equal(result.authorityGranted, false);
});

test('silence is not customer acceptance', () => {
  assert.throws(() => recordCustomerAcceptance(accepted(), {
    acceptanceState:'NO_RESPONSE', evidenceRef:'EVID-NONE'
  }), /invalid acceptance state/);
});

test('clarification remains customer success owned and cannot send externally', () => {
  const support = classifySupportCase(accepted(), {
    classification:'CLARIFICATION', evidenceRef:'EVID-Q-001', summary:'Question about delivered analysis.'
  });
  assert.equal(support.needsFulfillment, false);
  assert.equal(support.needsCommercialConversion, false);
  assert.equal(support.externalSendAllowed, false);
});

test('in-scope revision routes to fulfillment remediation and preserves original delivery', () => {
  const support = classifySupportCase(accepted(), {
    classification:'IN_SCOPE_REVISION', evidenceRef:'EVID-REV-001'
  });
  const remediation = buildFulfillmentRemediationRequest(support, {
    currentArtifactVersion:'v1.0', currentArtifactHash:'a'.repeat(64)
  });
  assert.equal(remediation.type, 'fulfillment_remediation_request_v1');
  assert.equal(remediation.owner, 'Fulfillment Control');
  assert.equal(remediation.preserveOriginalDelivery, true);
  assert.equal(remediation.requiresIndependentQa, true);
  assert.equal(remediation.requiresNewDeliveryApprovalIfArtifactChanges, true);
});

test('refund request escalates and never authorizes refund', () => {
  const support = classifySupportCase(accepted(), {
    classification:'REFUND_REQUEST', evidenceRef:'EVID-REFUND-001'
  });
  assert.equal(support.needsOwnerEscalation, true);
  assert.equal(support.refundAuthorized, false);
  assert.equal(support.moneyMovementPerformed, 0);
});

test('customer acceptance moves to SUCCESS_ACTIVE only with evidence', () => {
  const result = customerAccepted();
  assert.equal(result.nextState, 'SUCCESS_ACTIVE');
  assert.equal(result.successRecord.acceptance_state, 'ACCEPTED');
  assert.equal(result.externalActionsPerformed, 0);
});

test('open issue blocks success outcome closeout', () => {
  const issue = recordCustomerAcceptance(accepted(), {
    acceptanceState:'ISSUE_OPEN', evidenceRef:'EVID-ISSUE-001'
  });
  assert.throws(() => recordSuccessOutcome(issue, {
    measuredOutcome:'NOT_MEASURED'
  }), /unresolved issue/);
});

test('measured outcome requires evidence and is never fabricated', () => {
  assert.throws(() => recordSuccessOutcome(customerAccepted(), {
    measuredOutcome:'Saved 12 hours per month'
  }), /requires evidence/);
  const result = recordSuccessOutcome(customerAccepted(), {
    measuredOutcome:'NOT_MEASURED'
  });
  assert.equal(result.measuredOutcome, 'NOT_MEASURED');
});

test('unknown proof permission blocks public proof use', () => {
  const result = recordSuccessOutcome(customerAccepted(), {
    measuredOutcome:'NOT_MEASURED'
  });
  assert.equal(result.publicProofEligible, false);
  assert.equal(result.analyticsEligible, true);
  assert.equal(result.publishActionsPerformed, 0);
});

test('explicit case-study permission plus evidence can make outcome proof-eligible without publishing', () => {
  const cs = acceptDeliveredEngagement(delivered, {
    customerId:'CUS-SIM-001', permissions:{testimonial:'UNKNOWN', referral:'UNKNOWN', caseStudy:'GRANTED'}
  });
  const acceptedState = recordCustomerAcceptance(cs, {
    acceptanceState:'ACCEPTED', evidenceRef:'EVID-CUSTOMER-ACCEPT-002'
  });
  const result = recordSuccessOutcome(acceptedState, {
    measuredOutcome:'Improved processing cycle by 20%',
    outcomeEvidenceRefs:['EVID-OUTCOME-020'],
    permissionEvidenceRef:'EVID-PERMISSION-CS-001'
  });
  assert.equal(result.publicProofEligible, true);
  assert.equal(result.publishActionsPerformed, 0);
});

test('renewal/expansion requires evidence and creates no commercial commitment', () => {
  const outcome = recordSuccessOutcome(customerAccepted(), {measuredOutcome:'NOT_MEASURED'});
  assert.throws(() => buildRenewalExpansionOpportunity(outcome, {
    signalType:'EXPLICIT_CUSTOMER_REQUEST'
  }), /evidence required/);
  const result = buildRenewalExpansionOpportunity(outcome, {
    signalType:'EXPLICIT_CUSTOMER_REQUEST', evidenceRef:'EVID-RENEW-001',
    needSummary:'Customer asked for ongoing monthly automation monitoring.'
  });
  assert.equal(result.type, 'renewal_or_expansion_opportunity_v1');
  assert.equal(result.receiver, 'Commercial Conversion');
  assert.equal(result.commercialCommitmentMade, false);
  assert.equal(result.priceQuoted, false);
});

test('open blockers suppress renewal/expansion handoff', () => {
  const outcome = recordSuccessOutcome(customerAccepted(), {measuredOutcome:'NOT_MEASURED'});
  const result = buildRenewalExpansionOpportunity(outcome, {
    signalType:'EVIDENCE_BACKED_ONGOING_NEED', evidenceRef:'EVID-NEED-001', blockers:['OPEN_COMPLAINT']
  });
  assert.equal(result.type, 'customer_success_escalation_v1');
  assert.equal(result.status, 'BLOCKED');
  assert.equal(result.externalActionsPerformed, 0);
});

test('external customer-success action requires exact payload-hash permit and still executes separately', () => {
  const payload = {to:'SIMULATED_CUSTOMER', body:'Would you like us to continue next month?'};
  const action = {actionId:'CS-ACT-001', exactPayloadHash:sha256(payload)};
  const wrong = authorizeCustomerSuccessExternalAction(action, {
    status:'APPROVED', actionId:'CS-ACT-001', exactPayloadHash:'wrong', expiresAt:'2099-01-01T00:00:00Z'
  });
  assert.equal(wrong.authorized, false);
  const valid = authorizeCustomerSuccessExternalAction(action, {
    status:'APPROVED', actionId:'CS-ACT-001', exactPayloadHash:action.exactPayloadHash, expiresAt:'2099-01-01T00:00:00Z'
  });
  assert.equal(valid.authorized, true);
  assert.equal(valid.mode, 'PERMITTED_FOR_SEPARATE_EXTERNAL_EXECUTION');
  assert.equal(valid.externalActionsPerformed, 0);
});
