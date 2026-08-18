const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  verifyClientReadiness,
  buildProductionPacket,
  runSyntheticProductionAdapter,
  independentQaReview,
  authorizeDelivery,
  recordSimulatedDelivery
} = require('./runtime.cjs');

const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/accepted-engagement.json'), 'utf8'));

function ready(overrides = {}) {
  return verifyClientReadiness(
    fixture.commercialAcceptance,
    {...fixture.readinessEvidence, ...overrides},
    {now:'2026-08-18T10:15:00Z'}
  );
}

function production() {
  const cr = ready();
  const packet = buildProductionPacket(cr, {
    scopeInstructions:'Produce one bounded synthetic deliverable matching accepted scope.',
    requiredOutputs:['synthetic-deliverable.txt'],
    exclusions:['No external send','No money movement'],
    evidenceRefs:['EVID-SCOPE-SIM-001']
  }, {now:'2026-08-18T10:20:00Z'});
  return runSyntheticProductionAdapter(packet, {now:'2026-08-18T10:25:00Z'});
}

function qaPass() {
  return independentQaReview(production(), {
    qaReviewerId:'EVIDENCE-QUALITY-AGENT',
    deliveryId:'DEL-SIM-001',
    findings:[]
  }, {now:'2026-08-18T10:30:00Z'});
}

test('commercial acceptance alone is insufficient when payment condition is unverified', () => {
  const result = ready({paymentStatus:'PENDING'});
  assert.equal(result.status, 'REJECTED');
  assert.ok(result.reasons.includes('PAYMENT_CONDITION_NOT_VERIFIED'));
  assert.equal(result.externalActionsPerformed, 0);
});

test('provisional identity blocks client readiness', () => {
  const result = ready({identityStatus:'PROVISIONAL'});
  assert.equal(result.status, 'REJECTED');
  assert.ok(result.reasons.includes('IDENTITY_NOT_VERIFIED'));
});

test('accepted scope must match exact commercial acceptance', () => {
  const result = ready({acceptedScope:{...fixture.readinessEvidence.acceptedScope, hash:'wrong'}});
  assert.equal(result.status, 'REJECTED');
  assert.ok(result.reasons.includes('SCOPE_ACCEPTANCE_MISMATCH'));
});

test('valid readiness produces client_ready_v1 without money or external action', () => {
  const result = ready();
  assert.equal(result.type, 'client_ready_v1');
  assert.equal(result.clientReady.state, 'CLIENT_READY');
  assert.equal(result.engagementProjectRecord.status, 'CLIENT_READY');
  assert.equal(result.externalActionsPerformed, 0);
  assert.equal(result.moneyMovementPerformed, 0);
});

test('production cannot begin without accepted client_ready_v1', () => {
  assert.throws(() => buildProductionPacket({type:'fulfillment_rejection_v1'}, {
    scopeInstructions:'x', requiredOutputs:['x']
  }), /client_ready_v1/);
});

test('synthetic production creates exact version/hash and no external action', () => {
  const output = production();
  assert.equal(output.type, 'qa_eligible_delivery_v1');
  assert.match(output.artifactHash, /^[a-f0-9]{64}$/);
  assert.equal(output.state, 'QA_REVIEW');
  assert.equal(output.externalActionsPerformed, 0);
});

test('producer cannot independently QA its own artifact', () => {
  const output = production();
  assert.throws(() => independentQaReview(output, {
    qaReviewerId:output.producedBy,
    findings:[]
  }), /independent/);
});

test('open Major finding blocks QA PASS and returns to delivery work', () => {
  const result = independentQaReview(production(), {
    qaReviewerId:'EVIDENCE-QUALITY-AGENT',
    findings:[{severity:'Major', status:'OPEN', issue:'Missing required section'}]
  });
  assert.equal(result.verdict, 'FAIL');
  assert.equal(result.nextState, 'IN_DELIVERY');
  assert.equal(result.deliveryAuthorized, false);
});

test('QA PASS means delivery approval pending only', () => {
  const result = qaPass();
  assert.equal(result.verdict, 'PASS');
  assert.equal(result.nextState, 'DELIVERY_APPROVAL_PENDING');
  assert.equal(result.deliveryAuthorized, false);
});

test('mismatched delivery permit is blocked', () => {
  const qa = qaPass();
  const result = authorizeDelivery(qa, {
    permitId:'PERMIT-DEL-001', status:'APPROVED', deliveryId:qa.deliveryId,
    artifactVersion:qa.artifactVersion, artifactHash:'wrong', recipient:'SIMULATED_CUSTOMER',
    route:'SIMULATION_SINK', approvedBy:'OWNER', approvedAt:'2026-08-18T10:31:00Z',
    expiresAt:'2026-08-19T10:31:00Z'
  }, {recipient:'SIMULATED_CUSTOMER', route:'SIMULATION_SINK'}, {now:'2026-08-18T10:32:00Z'});
  assert.equal(result.authorized, false);
  assert.equal(result.externalActionsPerformed, 0);
});

test('exact delivery permit allows separate execution eligibility but performs no external action', () => {
  const qa = qaPass();
  const permit = {
    permitId:'PERMIT-DEL-002', status:'APPROVED', deliveryId:qa.deliveryId,
    artifactVersion:qa.artifactVersion, artifactHash:qa.artifactHash, recipient:'SIMULATED_CUSTOMER',
    route:'SIMULATION_SINK', approvedBy:'OWNER', approvedAt:'2026-08-18T10:31:00Z',
    expiresAt:'2026-08-19T10:31:00Z'
  };
  const result = authorizeDelivery(qa, permit, {recipient:'SIMULATED_CUSTOMER', route:'SIMULATION_SINK'}, {now:'2026-08-18T10:32:00Z'});
  assert.equal(result.authorized, true);
  assert.equal(result.mode, 'PERMITTED_FOR_SEPARATE_DELIVERY_EXECUTION');
  assert.equal(result.externalActionsPerformed, 0);
});

test('P3 simulated delivery emits delivered_engagement_v1 and hands ownership to Customer Success', () => {
  const qa = qaPass();
  const permit = {
    permitId:'PERMIT-DEL-003', status:'APPROVED', deliveryId:qa.deliveryId,
    artifactVersion:qa.artifactVersion, artifactHash:qa.artifactHash, recipient:'SIMULATED_CUSTOMER',
    route:'SIMULATION_SINK', approvedBy:'OWNER', approvedAt:'2026-08-18T10:31:00Z',
    expiresAt:'2026-08-19T10:31:00Z'
  };
  const approved = authorizeDelivery(qa, permit, {recipient:'SIMULATED_CUSTOMER', route:'SIMULATION_SINK'}, {now:'2026-08-18T10:32:00Z'});
  const delivered = recordSimulatedDelivery(approved, {receiptId:'SIM-RECEIPT-001', deliveredAt:'2026-08-18T10:33:00Z'});
  assert.equal(delivered.type, 'delivered_engagement_v1');
  assert.equal(delivered.state, 'DELIVERED');
  assert.equal(delivered.nextOwner, 'Customer Success');
  assert.equal(delivered.nextState, 'ACCEPTANCE_SUPPORT');
  assert.equal(delivered.externalActionsPerformed, 0);
  assert.equal(delivered.moneyMovementPerformed, 0);
});
