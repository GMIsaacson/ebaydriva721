'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const registry = require('../live-sourcing/source-access-registry.json');
const { ingestAuthorizedDataset } = require('../runtime/product-intake.cjs');
const { prescreenCandidates } = require('../runtime/prescreen.cjs');

const intakeBase = {
  registry,
  ownerAttestation: true,
  uploadedBy: 'OWNER-ABERDEEN',
  observedAt: '2026-08-18T03:00:00Z',
  format: 'json',
};

function intake(rows) {
  return ingestAuthorizedDataset({ ...intakeBase, content: JSON.stringify(rows) }).records;
}

test('bounds a 600-record eligible batch to a 50-item verification queue', () => {
  const rows = Array.from({ length: 600 }, (_, index) => ({
    title: `Industrial Part ${index + 1}`,
    supplier: 'Scale Supplier',
    sku: `SKU-${String(index + 1).padStart(4, '0')}`,
    cost: (10 + (index % 40)).toFixed(2),
    stock: 100,
    weight_oz: 12,
    length: 6,
    width: 4,
    height: 2,
    source_url: `https://supplier.example/${index + 1}`,
  }));
  const result = prescreenCandidates(intake(rows), {
    maxVerificationQueue: 50,
    maxSourceCostCents: 6000,
    maxInitialOutlayCents: 12000,
  });
  assert.equal(result.inputCount, 600);
  assert.equal(result.verificationCount, 50);
  assert.equal(result.deferredCount, 550);
  assert.equal(result.rejectedCount, 0);
  assert.equal(result.reviewCount, 0);
  assert.equal(result.marketplaceFetches, 0);
  assert.equal(result.externalActions, 0);
});

test('hard rejects supplier/mill e-retailing prohibitions before marketplace verification', () => {
  const [record] = intake([{
    title: 'Restricted Mill Product', supplier: 'S&S Activewear', sku: 'R-1', gtin: '00880723038404', customerPrice: '3.72', qty: 100, noeRetailing: true,
  }]);
  const result = prescreenCandidates([record], { maxSourceCostCents: 5000, maxInitialOutlayCents: 25000 });
  assert.equal(result.rejectedCount, 1);
  assert.equal(result.verificationCount, 0);
  assert.match(result.rejected[0].reason, /prohibits e-retailing/);
});

test('rejects source cost above the owner cap', () => {
  const [record] = intake([{ title: 'High Cost', supplier: 'S', sku: 'HC', cost: '125.00' }]);
  const result = prescreenCandidates([record], { maxSourceCostCents: 10000, maxInitialOutlayCents: 20000 });
  assert.equal(result.rejectedCount, 1);
  assert.match(result.rejected[0].reason, /source cost exceeds/);
});

test('rejects MOQ outlay above the owner cap', () => {
  const [record] = intake([{ title: 'MOQ Risk', supplier: 'S', sku: 'MOQ', cost: '40.00', moq: 10 }]);
  const result = prescreenCandidates([record], { maxSourceCostCents: 5000, maxInitialOutlayCents: 25000 });
  assert.equal(result.rejectedCount, 1);
  assert.match(result.rejected[0].reason, /minimum-order outlay/);
});

test('rejects known insufficient stock', () => {
  const [record] = intake([{ title: 'Low Stock', supplier: 'S', sku: 'LS', cost: '8.00', moq: 10, stock: 4 }]);
  const result = prescreenCandidates([record], { maxSourceCostCents: 5000, maxInitialOutlayCents: 25000 });
  assert.equal(result.rejectedCount, 1);
  assert.match(result.rejected[0].reason, /below MOQ/);
});

test('owner excluded terms are deterministic hard rejects', () => {
  const [record] = intake([{ title: 'Lithium Battery Pack', supplier: 'S', sku: 'BAT-1', cost: '18.00' }]);
  const result = prescreenCandidates([record], {
    maxSourceCostCents: 5000,
    maxInitialOutlayCents: 25000,
    excludedTerms: ['lithium battery'],
  });
  assert.equal(result.rejectedCount, 1);
  assert.match(result.rejected[0].reason, /owner-excluded term/);
});

test('title-only identity routes to review before eBay verification', () => {
  const [record] = intake([{ title: 'Ambiguous Widget', supplier: 'S', cost: '8.00' }]);
  assert.equal(record.identityConfidence, 'LOW');
  const result = prescreenCandidates([record], { maxSourceCostCents: 5000, maxInitialOutlayCents: 25000 });
  assert.equal(result.reviewCount, 1);
  assert.equal(result.verificationCount, 0);
  assert.match(result.review[0].reason, /title-only/);
});

test('ranking is deterministic and does not invent marketplace demand', () => {
  const records = intake([
    { title: 'Part A', supplier: 'S', sku: 'A', cost: '20.00', stock: 50, weight_oz: 10, length: 5, width: 5, height: 5, source_url: 'https://example.com/a' },
    { title: 'Part B', supplier: 'S', sku: 'B', cost: '30.00', stock: 50, weight_oz: 10, length: 5, width: 5, height: 5, source_url: 'https://example.com/b' },
    { title: 'Part C', supplier: 'S', sku: 'C', cost: '10.00' },
  ]);
  const policy = { maxVerificationQueue: 2, maxSourceCostCents: 5000, maxInitialOutlayCents: 25000 };
  const first = prescreenCandidates(records, policy);
  const second = prescreenCandidates(records, policy);
  assert.deepEqual(first.verificationQueue.map((item) => item.candidateId), second.verificationQueue.map((item) => item.candidateId));
  assert.equal(first.verificationCount, 2);
  assert.ok(first.verificationQueue.every((item) => item.disposition === 'VERIFY'));
  assert.ok(first.verificationQueue.every((item) => /marketplace demand is not yet known/.test(item.reason)));
});

test('policy caps the human verification queue at 100', () => {
  const records = intake([{ title: 'Part', supplier: 'S', sku: 'P', cost: '1.00' }]);
  assert.throws(() => prescreenCandidates(records, { maxVerificationQueue: 101 }), (error) => error.code === 'PRESCREEN_POLICY_INVALID');
});
