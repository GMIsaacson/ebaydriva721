'use strict';

const assert = require('assert');
const { auditCase, AUTHORITY } = require('../runtime/audit.cjs');

function base() {
  return {
    engagement: { id: 'ENG-010-SYNTH-001' },
    vendor: { id: 'V-3PL-001', name: 'Synthetic Fulfillment Co' },
    evidenceArtifacts: [
      { id: 'E-INV-1', type: 'invoice', source: 'synthetic-fixture' },
      { id: 'E-PAY-1', type: 'payment-export', source: 'synthetic-fixture' },
      { id: 'E-PAY-2', type: 'payment-export', source: 'synthetic-fixture' },
      { id: 'E-RATE', type: 'rate-card', source: 'synthetic-fixture' },
      { id: 'E-CREDIT', type: 'credit-memo', source: 'synthetic-fixture' }
    ],
    rateCard: {
      id: 'RC-001',
      evidenceId: 'E-RATE',
      rates: [
        { code: 'PICK', unitPriceCents: 125 },
        { code: 'STORAGE', unitPriceCents: 50 }
      ]
    },
    invoices: [
      {
        id: 'INV-1001', evidenceId: 'E-INV-1', lines: [
          { id: 'L-1', code: 'PICK', quantity: 100, amountCents: 15000 },
          { id: 'L-2', code: 'STORAGE', quantity: 200, amountCents: 10000 },
          { id: 'L-3', code: 'ADMIN_SURCHARGE', quantity: 1, amountCents: 3500 }
        ]
      }
    ],
    payments: [
      { id: 'PAY-1', invoiceId: 'INV-1001', amountCents: 28500, paidAt: '2026-07-10', evidenceId: 'E-PAY-1' },
      { id: 'PAY-2', invoiceId: 'INV-1001', amountCents: 28500, paidAt: '2026-07-12', evidenceId: 'E-PAY-2' }
    ],
    credits: [
      { id: 'CR-1', invoiceId: 'INV-1001', amountCents: 2000, evidenceId: 'E-CREDIT' }
    ],
    appliedCredits: []
  };
}

const result = auditCase(base());
assert.strictEqual(result.telemetry.authority, AUTHORITY);
assert.strictEqual(result.telemetry.externalActions, 0);
assert.strictEqual(result.telemetry.accountingWrites, 0);
assert.strictEqual(result.telemetry.paymentActions, 0);
assert.strictEqual(result.telemetry.moneyMovementActions, 0);
assert.strictEqual(result.remediation.length, 0);

const byClass = Object.fromEntries(result.findings.map((f) => [f.issueClass, f]));
assert.deepStrictEqual(Object.keys(byClass).sort(), ['DUPLICATE', 'MISSING_CREDIT', 'RATE_MISMATCH', 'UNSUPPORTED_FEE']);
assert.strictEqual(byClass.DUPLICATE.reviewAmountCents, 28500);
assert.strictEqual(byClass.RATE_MISMATCH.reviewAmountCents, 2500); // 100×125 expected 12,500 vs 15,000 billed
assert.strictEqual(byClass.UNSUPPORTED_FEE.reviewAmountCents, 3500);
assert.strictEqual(byClass.MISSING_CREDIT.reviewAmountCents, 2000);
for (const finding of result.findings) {
  assert.strictEqual(finding.qaVerdict, 'PASS');
  assert.strictEqual(finding.authority, AUTHORITY);
  assert.ok(finding.governingEvidenceIds.length > 0);
  assert.ok(finding.idempotencyKey.length >= 20);
}

// Determinism/idempotency: identical inputs produce identical finding keys and amounts.
const rerun = auditCase(base());
assert.deepStrictEqual(
  rerun.findings.map((f) => [f.idempotencyKey, f.reviewAmountCents]),
  result.findings.map((f) => [f.idempotencyKey, f.reviewAmountCents])
);

// Fail closed when governing evidence is absent.
const incomplete = base();
incomplete.evidenceArtifacts = incomplete.evidenceArtifacts.filter((e) => e.id !== 'E-RATE');
const incompleteResult = auditCase(incomplete);
assert.ok(incompleteResult.remediation.some((r) => r.issueClass === 'RATE_MISMATCH'));
assert.ok(incompleteResult.remediation.some((r) => r.issueClass === 'UNSUPPORTED_FEE'));
assert.ok(!incompleteResult.findings.some((f) => ['RATE_MISMATCH', 'UNSUPPORTED_FEE'].includes(f.issueClass)));

// Applied credit must not become a missing-credit finding.
const applied = base();
applied.appliedCredits = [{ creditId: 'CR-1', appliedAt: '2026-07-15' }];
const appliedResult = auditCase(applied);
assert.ok(!appliedResult.findings.some((f) => f.issueClass === 'MISSING_CREDIT'));

console.log(JSON.stringify({
  gate: 'G4',
  status: 'PASS',
  synthetic: true,
  findings: result.findings.map((f) => ({ issueClass: f.issueClass, reviewAmountCents: f.reviewAmountCents })),
  totalReviewAmountCents: result.findings.reduce((s, f) => s + f.reviewAmountCents, 0),
  remediationFailClosedVerified: true,
  deterministicRerunVerified: true,
  externalActions: 0,
  accountingWrites: 0,
  paymentActions: 0,
  moneyMovementActions: 0
}, null, 2));
