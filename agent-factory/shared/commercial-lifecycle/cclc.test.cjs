const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const contract = JSON.parse(fs.readFileSync(path.join(__dirname, 'cclc-v1.0.json'), 'utf8'));
const run012 = JSON.parse(fs.readFileSync(path.join(__dirname, '../../run-012/contracts/handoff-contract.json'), 'utf8'));

const canonicalRecordNames = [
  'Lead','Opportunity','ProposalScope','CommercialAcceptance','CustomerAccount',
  'EngagementProject','QADeliveryRecord','SuccessRecord','RevenueEvent','LifecycleEvent'
];

const requiredHandoffs = [
  'qualified_opportunity_v1','approved_proposal_v1','commercial_acceptance_v1','client_ready_v1',
  'production_packet_v1','qa_eligible_delivery_v1','approved_delivery_v1','delivered_engagement_v1',
  'success_outcome_v1','renewal_or_expansion_opportunity_v1'
];

test('CCLC identifies the canonical shared contract without granting authority', () => {
  assert.equal(contract.contractId, 'CCLC-001');
  assert.equal(contract.version, '1.0.0');
  assert.equal(contract.architectureRef, 'A0-COMM-001-v1.0');
  assert.equal(contract.authorityEffect, 'NONE');
});

test('all canonical records are present with stable identity and lifecycle fields', () => {
  assert.deepEqual(Object.keys(contract.canonicalRecords), canonicalRecordNames);
  for (const [name, fields] of Object.entries(contract.canonicalRecords)) {
    assert.ok(fields.length >= 8, `${name} must be a substantive typed record`);
    assert.ok(fields.some(f => /_id$/.test(f)), `${name} must have a stable id`);
  }
});

test('every non-terminal lifecycle state has an explicit owner', () => {
  const active = contract.states.filter(s => !s.terminal);
  assert.ok(active.length >= 10);
  for (const state of active) {
    assert.ok(state.owner && state.owner.trim().length > 0, `${state.id} missing owner`);
  }
});

test('all canonical handoffs define sender, receiver and rejection ownership', () => {
  assert.deepEqual(Object.keys(contract.handoffs), requiredHandoffs);
  for (const [name, h] of Object.entries(contract.handoffs)) {
    assert.ok(h.sender, `${name} sender missing`);
    assert.ok(h.receiver, `${name} receiver missing`);
    assert.ok(h.rejectReturnsTo, `${name} rejection path missing`);
  }
});

test('revenue semantics keep booked, invoiced and collected distinct', () => {
  const types = new Set(contract.revenueEventTypes);
  assert.ok(types.has('BOOKED'));
  assert.ok(types.has('INVOICED'));
  assert.ok(types.has('COLLECTED'));
  assert.ok(types.has('REFUNDED'));
  assert.equal(types.size, contract.revenueEventTypes.length);
});

test('authority invariants protect readiness, QA, payment and delivery boundaries', () => {
  const text = contract.invariants.join(' ');
  assert.match(text, /Production may not begin before CLIENT_READY/);
  assert.match(text, /Payment verification is separate from money movement/);
  assert.match(text, /may not self-issue independent QA PASS/);
  assert.match(text, /Unknown external outcome fails closed/);
});

test('Run 012 binds to CCLC and typed Commercial Conversion at qualified_opportunity_v1', () => {
  const q = run012.handoffs.qualified_opportunity_v1;
  assert.ok(q, 'Run 012 must expose qualified_opportunity_v1');
  assert.equal(q.direction, 'outbound_to_commercial_conversion');
  assert.equal(q.receiverContract, 'COMM-CONV-001-v1.0');
  assert.equal(q.receiverOwner, 'Pipeline & Reply Coordinator');
  assert.ok(q.required.includes('opportunityId'));
  assert.ok(q.required.includes('canonicalLeadId'));
  assert.ok(q.required.includes('idempotencyKey'));
  assert.match(q.acceptanceRule, /conversion_acceptance_v1/);
  assert.match(q.acceptanceRule, /conversion_rejection_v1/);
  assert.ok(run012.rules.some(r => r.includes('ends operational ownership at qualified_opportunity_v1')));
  assert.ok(run012.rules.some(r => /rejected conversion handoff returns ownership/i.test(r)));
});

test('transition chain enforces explicit downstream acceptance before fulfillment', () => {
  const transition = (from, to) => contract.transitionRules.find(t => t.from === from && t.to === to);
  assert.ok(transition('QUALIFIED_OPPORTUNITY', 'CONVERSION_ACTIVE').requires.some(x => /accepted by downstream receiver/.test(x)));
  assert.ok(transition('PAYMENT_PENDING', 'CLIENT_READY').requires.some(x => /payment condition verified/.test(x)));
  assert.ok(transition('CLIENT_READY', 'IN_DELIVERY').requires.some(x => /client_ready_v1 accepted/.test(x)));
  assert.ok(transition('DELIVERED', 'ACCEPTANCE_SUPPORT').requires.some(x => /Customer Success ownership accepted/.test(x)));
});
