const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  validateQualifiedOpportunity,
  receiveQualifiedOpportunity,
  buildProposalDraft,
  authorizeProposalForSend,
  recordCommercialAcceptance
} = require('./runtime.cjs');

const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/qualified-opportunity.json'), 'utf8'));

function buildProposal() {
  return buildProposalDraft({
    proposalId: 'PROP-SIM-001',
    opportunityId: fixture.opportunityId,
    version: 'v1.0',
    price: 1500,
    currency: 'USD',
    deliverables: ['One bounded automation implementation'],
    exclusions: ['No autonomous spending', 'No phone outreach'],
    assumptions: ['Client provides required access after approval'],
    expiresAt: '2026-09-01T00:00:00Z',
    evidenceRefs: ['EVID-PROP-001']
  }, { now: '2026-08-18T10:10:00Z' }).proposalRecord;
}

test('accepts a valid HOT_REVIEW qualified opportunity and creates canonical Opportunity state', () => {
  assert.equal(validateQualifiedOpportunity(fixture).valid, true);
  const result = receiveQualifiedOpportunity(fixture, { now: '2026-08-18T10:05:00Z', nextActionDueAt: '2026-08-19T10:05:00Z' });
  assert.equal(result.status, 'ACCEPTED');
  assert.equal(result.opportunityRecord.state, 'CONVERSION_ACTIVE');
  assert.equal(result.opportunityRecord.stage_owner, 'Pipeline & Reply Coordinator');
  assert.equal(result.externalActionsPerformed, 0);
  assert.equal(result.authorityGranted, false);
});

test('accepts WARM_QUEUE at threshold 60', () => {
  const warm = {...fixture, opportunityId:'OPP-SIM-002', idempotencyKey:'SIM-002', leadScore:60, route:'WARM_QUEUE'};
  assert.equal(receiveQualifiedOpportunity(warm).status, 'ACCEPTED');
});

test('rejects NURTURE/low-score opportunities back to acquisition', () => {
  const low = {...fixture, opportunityId:'OPP-SIM-003', idempotencyKey:'SIM-003', leadScore:57, route:'NURTURE'};
  const result = receiveQualifiedOpportunity(low);
  assert.equal(result.status, 'REJECTED');
  assert.ok(result.reasons.includes('INVALID_SCORE_OR_ROUTE'));
  assert.equal(result.remediationOwner, 'Demand & Acquisition');
});

test('explicit opt-out blocks conversion', () => {
  const dnc = {...fixture, opportunityId:'OPP-SIM-004', idempotencyKey:'SIM-004', communicationState:'DO_NOT_CONTACT'};
  const result = receiveQualifiedOpportunity(dnc);
  assert.equal(result.status, 'REJECTED');
  assert.ok(result.reasons.includes('DO_NOT_CONTACT'));
  assert.equal(result.externalActionsPerformed, 0);
});

test('missing evidence is rejected rather than invented', () => {
  const bad = {...fixture, opportunityId:'OPP-SIM-005', idempotencyKey:'SIM-005', painEvidence:[]};
  const result = receiveQualifiedOpportunity(bad);
  assert.equal(result.status, 'REJECTED');
  assert.ok(result.reasons.includes('MISSING_EVIDENCE') || result.reasons.includes('MISSING_REQUIRED_FIELD'));
});

test('duplicate/replayed handoff is suppressed', () => {
  const seen = new Set();
  assert.equal(receiveQualifiedOpportunity(fixture, { seenKeys: seen }).status, 'ACCEPTED');
  const replay = receiveQualifiedOpportunity(fixture, { seenKeys: seen });
  assert.equal(replay.status, 'REJECTED');
  assert.deepEqual(replay.reasons, ['DUPLICATE_OR_REPLAY']);
});

test('proposal draft is versioned/hashed and remains blocked from send', () => {
  const proposal = buildProposal();
  assert.match(proposal.hash, /^[a-f0-9]{64}$/);
  assert.equal(proposal.approval_state, 'DRAFT_INTERNAL');
  assert.equal(proposal.send_state, 'BLOCKED_PENDING_OWNER_APPROVAL');
});

test('mismatched approval permit cannot authorize proposal', () => {
  const proposal = buildProposal();
  const permit = {
    permitId:'PERMIT-001', status:'APPROVED', proposalId:proposal.proposal_id,
    proposalVersion:proposal.version, proposalHash:'wrong-hash', approvedBy:'OWNER',
    approvedAt:'2026-08-18T10:20:00Z', expiresAt:'2026-08-19T10:20:00Z'
  };
  const result = authorizeProposalForSend(proposal, permit, { now:'2026-08-18T10:30:00Z' });
  assert.equal(result.authorized, false);
  assert.equal(result.externalActionsPerformed, 0);
});

test('exact unexpired permit authorizes separate execution but does not send', () => {
  const proposal = buildProposal();
  const permit = {
    permitId:'PERMIT-002', status:'APPROVED', proposalId:proposal.proposal_id,
    proposalVersion:proposal.version, proposalHash:proposal.hash, approvedBy:'OWNER',
    approvedAt:'2026-08-18T10:20:00Z', expiresAt:'2026-08-19T10:20:00Z'
  };
  const result = authorizeProposalForSend(proposal, permit, { now:'2026-08-18T10:30:00Z' });
  assert.equal(result.authorized, true);
  assert.equal(result.mode, 'PERMITTED_FOR_SEPARATE_EXTERNAL_EXECUTION');
  assert.equal(result.externalActionsPerformed, 0);
});

test('commercial acceptance must match exact proposal version/hash', () => {
  const proposal = buildProposal();
  assert.throws(() => recordCommercialAcceptance(proposal, {
    acceptanceId:'ACC-001', opportunityId:proposal.opportunity_id, proposalId:proposal.proposal_id,
    acceptedVersion:proposal.version, acceptedHash:'wrong', authoritativeContactId:'CONTACT-001',
    acceptanceEvidenceRef:'EVID-ACC-001', acceptedAt:'2026-08-18T11:00:00Z', paymentStatus:'PENDING'
  }), /exact proposal version\/hash/);
});

test('commercial acceptance cannot invent collected payment', () => {
  const proposal = buildProposal();
  assert.throws(() => recordCommercialAcceptance(proposal, {
    acceptanceId:'ACC-002', opportunityId:proposal.opportunity_id, proposalId:proposal.proposal_id,
    acceptedVersion:proposal.version, acceptedHash:proposal.hash, authoritativeContactId:'CONTACT-001',
    acceptanceEvidenceRef:'EVID-ACC-002', acceptedAt:'2026-08-18T11:00:00Z', paymentStatus:'COLLECTED'
  }), /payment status must remain/);
});

test('valid commercial acceptance moves only to payment pending and performs no money action', () => {
  const proposal = buildProposal();
  const result = recordCommercialAcceptance(proposal, {
    acceptanceId:'ACC-003', opportunityId:proposal.opportunity_id, proposalId:proposal.proposal_id,
    acceptedVersion:proposal.version, acceptedHash:proposal.hash, authoritativeContactId:'CONTACT-001',
    acceptanceEvidenceRef:'EVID-ACC-003', acceptedAt:'2026-08-18T11:00:00Z', paymentStatus:'PENDING'
  });
  assert.equal(result.type, 'commercial_acceptance_v1');
  assert.equal(result.currentState, 'COMMERCIAL_ACCEPTED');
  assert.equal(result.nextState, 'PAYMENT_PENDING');
  assert.equal(result.paymentVerified, false);
  assert.equal(result.moneyMovementPerformed, 0);
});
