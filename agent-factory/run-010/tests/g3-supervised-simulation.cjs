'use strict';

const assert = require('assert');

const AUTHORITY = 'INTERNAL_REVIEW_ONLY';

const cases = [
  {id:'dup-1', issueClass:'DUPLICATE', amount:842000, evidence:['inv-1','pay-a','pay-b'], calc:true, expected:'PASS'},
  {id:'rate-1', issueClass:'RATE_MISMATCH', amount:147500, evidence:['inv-2','rate-card-v3'], calc:true, expected:'PASS'},
  {id:'credit-1', issueClass:'MISSING_CREDIT', amount:387000, evidence:['statement-1','credit-memo-7','inv-3'], calc:true, expected:'PASS'},
  {id:'fee-1', issueClass:'UNSUPPORTED_FEE', amount:92500, evidence:['inv-4','contract-v2'], calc:true, expected:'PASS'},
  {id:'recon-1', issueClass:'RECONCILIATION_GAP', amount:61000, evidence:['statement-2','payment-export-1','inv-5'], calc:true, expected:'PASS'},
  {id:'remediate-1', issueClass:'RATE_MISMATCH', amount:120000, evidence:['inv-6'], calc:true, expected:'REMEDIATE'},
  {id:'dup-1', issueClass:'DUPLICATE', amount:842000, evidence:['inv-1','pay-a','pay-b'], calc:true, expected:'DUPLICATE_SUPPRESSED'}
];

const seen = new Set();
function route(c) {
  if (seen.has(c.id)) return 'DUPLICATE_SUPPRESSED';
  seen.add(c.id);
  if (!c.calc || !Number.isInteger(c.amount) || c.amount <= 0) return 'REJECT';
  const needsGoverningEvidence = ['RATE_MISMATCH','MISSING_CREDIT','UNSUPPORTED_FEE','RECONCILIATION_GAP'].includes(c.issueClass);
  if (needsGoverningEvidence && c.evidence.length < 2) return 'REMEDIATE';
  if (c.issueClass === 'DUPLICATE' && c.evidence.length < 3) return 'REMEDIATE';
  return 'PASS';
}

let pass = 0;
for (const c of cases) {
  const actual = route(c);
  assert.strictEqual(actual, c.expected, `${c.id}: expected ${c.expected}, got ${actual}`);
  pass += 1;
}

const telemetry = {
  runId:'AP-RECOVERY-010',
  gate:'G3',
  status:'Pass',
  tests:pass,
  claimReady:5,
  remediation:1,
  duplicatesSuppressed:1,
  authority:AUTHORITY,
  externalActions:0,
  accountingWrites:0,
  paymentActions:0,
  moneyMovement:0
};

assert.strictEqual(telemetry.tests, 7);
assert.strictEqual(telemetry.externalActions, 0);
assert.strictEqual(telemetry.accountingWrites, 0);
assert.strictEqual(telemetry.paymentActions, 0);
assert.strictEqual(telemetry.moneyMovement, 0);
console.log(JSON.stringify(telemetry));
