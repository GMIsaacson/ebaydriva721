'use strict';

const assert = require('assert');
const { auditCase } = require('../runtime/audit.cjs');
const { normalizeShadowCase } = require('../runtime/normalize.cjs');

function rawBase(id) {
  return {
    engagementId: `ENG-${id}`,
    vendorId: `V-${id}`,
    vendorName: `Synthetic 3PL ${id}`,
    evidence: [
      { id: `E-INV-${id}`, type: 'invoice', source: 'sanitized-shadow-fixture' },
      { id: `E-RATE-${id}`, type: 'rate-card', source: 'sanitized-shadow-fixture' },
      { id: `E-PAY-${id}-1`, type: 'payment-export', source: 'sanitized-shadow-fixture' },
      { id: `E-PAY-${id}-2`, type: 'payment-export', source: 'sanitized-shadow-fixture' },
      { id: `E-CR-${id}`, type: 'credit-memo', source: 'sanitized-shadow-fixture' }
    ],
    rateCard: {
      id: `RC-${id}`,
      evidenceId: `E-RATE-${id}`,
      rates: [
        { code: 'pick', unitPrice: '$1.25' },
        { code: 'storage', unitPrice: '0.50' }
      ]
    },
    invoices: [{
      id: `INV-${id}`,
      evidenceId: `E-INV-${id}`,
      lines: [{ id: `L-${id}-1`, code: ' PICK ', quantity: '10', amount: '$12.50' }]
    }],
    payments: [{ id: `PAY-${id}-1`, invoiceId: `INV-${id}`, amount: '$12.50', paidAt: '2026-07-10', evidenceId: `E-PAY-${id}-1` }],
    credits: [],
    appliedCredits: []
  };
}

const cases = [];

// 1: clean invoice, should produce nothing.
cases.push({ name: 'clean', raw: rawBase('001'), expected: [], expectedRemediation: [] });

// 2: rate mismatch, using comma formatting.
{
  const raw = rawBase('002');
  raw.invoices[0].lines[0].quantity = '100';
  raw.invoices[0].lines[0].amount = '$150.00';
  raw.payments[0].amount = '150.00';
  cases.push({ name: 'rate-mismatch', raw, expected: ['RATE_MISMATCH'], expectedRemediation: [] });
}

// 3: unsupported fee.
{
  const raw = rawBase('003');
  raw.invoices[0].lines.push({ id: 'L-003-2', code: ' admin_surcharge ', quantity: 1, amount: '$35.00' });
  raw.payments[0].amount = '$47.50';
  cases.push({ name: 'unsupported-fee', raw, expected: ['UNSUPPORTED_FEE'], expectedRemediation: [] });
}

// 4: duplicate payment.
{
  const raw = rawBase('004');
  raw.payments.push({ id: 'PAY-004-2', invoiceId: 'INV-004', amount: '$12.50', paidAt: '2026-07-12', evidenceId: 'E-PAY-004-2' });
  cases.push({ name: 'duplicate-payment', raw, expected: ['DUPLICATE'], expectedRemediation: [] });
}

// 5: missing approved credit.
{
  const raw = rawBase('005');
  raw.credits.push({ id: 'CR-005', invoiceId: 'INV-005', amount: '$20.00', evidenceId: 'E-CR-005' });
  cases.push({ name: 'missing-credit', raw, expected: ['MISSING_CREDIT'], expectedRemediation: [] });
}

// 6: governing rate evidence removed; should fail closed to remediation.
{
  const raw = rawBase('006');
  raw.invoices[0].lines[0].amount = '$15.00';
  raw.evidence = raw.evidence.filter((e) => e.id !== 'E-RATE-006');
  cases.push({ name: 'missing-rate-evidence', raw, expected: [], expectedRemediation: ['RATE_MISMATCH'] });
}

// 7: credit already applied; should not flag.
{
  const raw = rawBase('007');
  raw.credits.push({ id: 'CR-007', invoiceId: 'INV-007', amount: '$20.00', evidenceId: 'E-CR-007' });
  raw.appliedCredits.push({ creditId: 'CR-007', appliedAt: '2026-07-15' });
  cases.push({ name: 'applied-credit', raw, expected: [], expectedRemediation: [] });
}

// 8: combined duplicate + rate mismatch + unsupported fee.
{
  const raw = rawBase('008');
  raw.invoices[0].lines[0].quantity = '100';
  raw.invoices[0].lines[0].amount = '$150.00';
  raw.invoices[0].lines.push({ id: 'L-008-2', code: 'manual_fee', quantity: '1', amount: '$10.00' });
  raw.payments[0].amount = '$160.00';
  raw.payments.push({ id: 'PAY-008-2', invoiceId: 'INV-008', amount: '$160.00', paidAt: '2026-07-11', evidenceId: 'E-PAY-008-2' });
  cases.push({ name: 'combined', raw, expected: ['DUPLICATE', 'RATE_MISMATCH', 'UNSUPPORTED_FEE'], expectedRemediation: [] });
}

let tp = 0;
let fp = 0;
let fn = 0;
let remediationCount = 0;
let reviewAmountCents = 0;
let externalActions = 0;
let accountingWrites = 0;
let paymentActions = 0;
let moneyMovementActions = 0;
const details = [];

for (const test of cases) {
  const normalized = normalizeShadowCase(test.raw);
  const result = auditCase(normalized);
  const actual = result.findings.map((f) => f.issueClass).sort();
  const expected = [...test.expected].sort();
  const remediation = result.remediation.map((r) => r.issueClass).sort();
  const expectedRemediation = [...test.expectedRemediation].sort();

  assert.deepStrictEqual(actual, expected, `${test.name}: finding classes differ`);
  for (const needed of expectedRemediation) assert.ok(remediation.includes(needed), `${test.name}: missing remediation ${needed}`);

  for (const cls of actual) expected.includes(cls) ? tp++ : fp++;
  for (const cls of expected) if (!actual.includes(cls)) fn++;

  remediationCount += result.remediation.length;
  reviewAmountCents += result.findings.reduce((s, f) => s + f.reviewAmountCents, 0);
  externalActions += result.telemetry.externalActions;
  accountingWrites += result.telemetry.accountingWrites;
  paymentActions += result.telemetry.paymentActions;
  moneyMovementActions += result.telemetry.moneyMovementActions;
  details.push({ name: test.name, findings: actual, remediation });
}

const precision = tp / Math.max(1, tp + fp);
const recall = tp / Math.max(1, tp + fn);
const estimatedReviewMinutes = tp * 4 + remediationCount * 6;

assert.strictEqual(precision, 1);
assert.strictEqual(recall, 1);
assert.strictEqual(externalActions, 0);
assert.strictEqual(accountingWrites, 0);
assert.strictEqual(paymentActions, 0);
assert.strictEqual(moneyMovementActions, 0);

console.log(JSON.stringify({
  gate: 'G5',
  status: 'PASS',
  datasetType: 'heterogeneous sanitized/synthetic shadow benchmark',
  cases: cases.length,
  truePositiveFindingClasses: tp,
  falsePositiveFindingClasses: fp,
  falseNegativeFindingClasses: fn,
  precision,
  recall,
  remediationCount,
  reviewAmountCents,
  estimatedReviewMinutes,
  details,
  externalActions,
  accountingWrites,
  paymentActions,
  moneyMovementActions,
  limitation: 'Calibration evidence only; does not establish real-customer incidence, recoverability, or commercial demand.'
}, null, 2));
