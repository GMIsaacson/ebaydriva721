'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const registry = require('../live-sourcing/source-access-registry.json');
const { ingestAuthorizedDataset } = require('../runtime/product-intake.cjs');
const { prescreenCandidatesV2, scoreCandidateV2 } = require('../runtime/prescreen-v2.cjs');

const intakeBase = {
  registry,
  ownerAttestation: true,
  uploadedBy: 'OWNER-ABERDEEN',
  observedAt: '2026-08-18T08:30:00Z',
  format: 'json',
};

function intake(rows) {
  return ingestAuthorizedDataset({ ...intakeBase, content: JSON.stringify(rows) }).records;
}

function enrich(record, { retailPriceCents, returnable = true, moqEvidence = 'SUPPLIER_SUPPORTED' } = {}) {
  return {
    ...record,
    moqEvidence,
    moqEvidenceBasis: 'test supplier evidence',
    supplierSignals: { retailPriceCents, returnable },
  };
}

const policy = {
  maxVerificationQueue: 50,
  maxSourceCostCents: 10000,
  maxInitialOutlayCents: 50000,
};

test('cheap source cost no longer outranks a much stronger supplier retail spread', () => {
  const [cheapThin, stronger] = intake([
    { title: 'Cheap Thin Spread', supplier: 'S&S Activewear', sku: 'CHEAP', upc: '001234567890', cost: '0.19', stock: 500, weight_oz: 0.25 },
    { title: 'Moderate Strong Spread', supplier: 'S&S Activewear', sku: 'STRONG', upc: '001234567891', cost: '12.00', stock: 500, weight_oz: 12 },
  ]);
  const result = prescreenCandidatesV2([
    enrich(cheapThin, { retailPriceCents: 38 }),
    enrich(stronger, { retailPriceCents: 4500 }),
  ], { ...policy, maxVerificationQueue: 2 });

  assert.equal(result.verificationQueue[0].candidateId, stronger.candidateId);
  assert.ok(result.verificationQueue[0].opportunityScore > result.verificationQueue[1].opportunityScore);
  assert.match(result.verificationQueue[1].warnings.join(' '), /thin supplier retail spread/);
});

test('opportunity and evidence confidence are separate scores', () => {
  const [complete, incomplete] = intake([
    { title: 'Complete Product', supplier: 'Supplier', sku: 'COMP', upc: '001234567892', cost: '10.00', stock: 100, weight_oz: 10, length: 6, width: 4, height: 2, source_url: 'https://supplier.example/comp' },
    { title: 'Incomplete Product', supplier: 'Supplier', sku: 'INC', upc: '001234567893', cost: '10.00', stock: 100, weight_oz: 10 },
  ]);
  const completeScore = scoreCandidateV2(enrich(complete, { retailPriceCents: 4000, moqEvidence: 'SUPPLIER_CONFIRMED' }), policy);
  const incompleteScore = scoreCandidateV2(enrich(incomplete, { retailPriceCents: 4000, moqEvidence: 'SUPPLIER_CONFIRMED' }), policy);

  assert.ok(completeScore.evidenceConfidence > incompleteScore.evidenceConfidence);
  assert.ok(Number.isSafeInteger(completeScore.opportunityScore));
  assert.ok(Number.isSafeInteger(completeScore.evidenceConfidence));
});

test('unknown MOQ evidence is held for review rather than silently assuming one', () => {
  const [record] = intake([{ title: 'Unknown MOQ Product', supplier: 'Supplier', sku: 'MOQ-U', upc: '001234567894', cost: '5.00', stock: 100, weight_oz: 8 }]);
  const result = prescreenCandidatesV2([enrich(record, { retailPriceCents: 2500, moqEvidence: 'UNKNOWN' })], policy);
  assert.equal(result.reviewCount, 1);
  assert.equal(result.verificationCount, 0);
  assert.match(result.review[0].reason, /MOQ evidence is unknown/);
});

test('supplier-SKU-only identity is not treated as exact marketplace identity', () => {
  const [record] = intake([{ title: 'Supplier SKU Product', supplier: 'Supplier', sku: 'SKU-ONLY', cost: '8.00', stock: 100, weight_oz: 8 }]);
  const result = prescreenCandidatesV2([enrich(record, { retailPriceCents: 3000 })], policy);
  assert.equal(result.verificationCount, 1);
  assert.equal(result.verificationQueue[0].identityBasis, 'supplier SKU only');
  assert.ok(result.verificationQueue[0].evidenceConfidence < 90);
});

test('ranking remains deterministic with supplier-side proxy fields', () => {
  const records = intake([
    { title: 'Part A', supplier: 'Supplier', sku: 'A', upc: '001234567895', cost: '11.00', stock: 80, weight_oz: 8 },
    { title: 'Part B', supplier: 'Supplier', sku: 'B', upc: '001234567896', cost: '13.00', stock: 90, weight_oz: 9 },
    { title: 'Part C', supplier: 'Supplier', sku: 'C', upc: '001234567897', cost: '15.00', stock: 100, weight_oz: 10 },
  ]).map((record, index) => enrich(record, { retailPriceCents: 3500 + (index * 500) }));
  const first = prescreenCandidatesV2(records, { ...policy, maxVerificationQueue: 3 });
  const second = prescreenCandidatesV2(records, { ...policy, maxVerificationQueue: 3 });
  assert.deepEqual(first.verificationQueue.map((item) => item.candidateId), second.verificationQueue.map((item) => item.candidateId));
  assert.equal(first.marketplaceFetches, 0);
  assert.equal(first.externalActions, 0);
});
