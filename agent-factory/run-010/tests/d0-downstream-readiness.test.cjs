'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  AUTHORITY,
  RECIPIENT,
  DESTINATION,
  OWNER,
  buildHandoff,
  validateReceiver,
  receiverIdempotencyKey
} = require('../runtime/d0-downstream-readiness.cjs');

const schema = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'contracts', 'd0-recovery-review-handoff.schema.json'), 'utf8'));
assert.equal(schema.$id, 'AP-RECOVERY-010-D0-HANDOFF-v1.0');
assert(schema.required.includes('findingIdempotencyKey'));
assert.equal(schema.properties.authority.const, AUTHORITY);
assert.equal(schema.properties.externalActionAuthorized.const, false);
assert.equal(schema.properties.accountingWriteAuthorized.const, false);
assert.equal(schema.properties.paymentActionAuthorized.const, false);
assert.equal(schema.properties.moneyMovementAuthorized.const, false);

const finding = {
  findingId: 'F-test-001',
  engagementId: 'ENG-010-DEMO',
  vendorId: 'V-3PL-DEMO',
  issueClass: 'RATE_MISMATCH',
  affectedRecordIds: ['INV-100', 'LINE-1'],
  reviewAmountCents: 2500,
  calculation: '10 × 500 = 5000 cents expected; billed 7500; difference 2500 cents',
  governingEvidenceIds: ['E-INVOICE-100', 'E-RATECARD-1'],
  confidence: 0.98,
  unresolvedQuestions: [],
  idempotencyKey: 'stable-finding-key-001',
  qaVerdict: 'PASS',
  recommendedNextAction: 'Human review of recovery-ready claim packet',
  authority: AUTHORITY
};

const h1 = buildHandoff(finding);
const h2 = buildHandoff({...finding});
assert.equal(h1.version, '1.0');
assert.equal(h1.status, 'OWNER_REVIEW_READY');
assert.equal(h1.recipientRole, RECIPIENT);
assert.equal(h1.recordDestination, DESTINATION);
assert.equal(h1.owner, OWNER);
assert.equal(h1.authority, AUTHORITY);
assert.equal(h1.externalActionAuthorized, false);
assert.equal(h1.accountingWriteAuthorized, false);
assert.equal(h1.paymentActionAuthorized, false);
assert.equal(h1.moneyMovementAuthorized, false);
assert.equal(validateReceiver(h1).accepted, true);
assert.equal(validateReceiver(h1).disposition, 'ACCEPTED_INTERNAL_ONLY');
assert.equal(h1.handoffId, h2.handoffId);
assert.equal(receiverIdempotencyKey(h1), receiverIdempotencyKey(h2));

const remediation = buildHandoff({...finding, qaVerdict:'REMEDIATE', unresolvedQuestions:['Confirm effective rate-card date']});
assert.equal(remediation.status, 'REMEDIATION_REQUIRED');
assert.equal(validateReceiver(remediation).accepted, false);
assert(remediation.remediationReasons.includes('qaVerdict:REMEDIATE'));

const weakEvidence = buildHandoff({...finding, governingEvidenceIds:[]});
assert.equal(weakEvidence.status, 'REMEDIATION_REQUIRED');
assert(weakEvidence.remediationReasons.includes('governingEvidenceIds'));
assert.equal(validateReceiver(weakEvidence).accepted, false);

const authorityViolation = {...h1, externalActionAuthorized:true};
const rejected = validateReceiver(authorityViolation);
assert.equal(rejected.accepted, false);
assert(rejected.missing.includes('authority_violation'));

const batch = [finding, {...finding, findingId:'F-test-002', idempotencyKey:'stable-finding-key-002', qaVerdict:'REMEDIATE'}, {...finding, findingId:'F-test-003', idempotencyKey:'stable-finding-key-003'}];
const handoffs = batch.map(buildHandoff);
assert.equal(handoffs.length, batch.length);
assert.equal(handoffs.filter(h => h.status === 'OWNER_REVIEW_READY').length, 2);
assert.equal(handoffs.filter(h => h.status === 'REMEDIATION_REQUIRED').length, 1);
assert.equal(new Set(handoffs.map(receiverIdempotencyKey)).size, 3);

console.log(JSON.stringify({
  unitId:'AP-RECOVERY-010-D0',
  status:'Pass',
  receiver:RECIPIENT,
  durableDestination:DESTINATION,
  owner:OWNER,
  authority:AUTHORITY,
  acceptedReady:2,
  remediation:1,
  orphanFindings:0,
  duplicateReceiverWrites:0,
  externalActions:0,
  accountingWrites:0,
  paymentActions:0,
  moneyMovementActions:0,
  idempotency:'PASS',
  remediationPath:'PASS'
}));
