'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const registry = require('../live-sourcing/source-access-registry.json');
const { ingestAuthorizedDataset } = require('../runtime/product-intake.cjs');
const { prescreenCandidatesV2 } = require('../runtime/prescreen-v2.cjs');
const { buildProvisionalWebPool, finalizeWebGatedQueue } = require('../runtime/web-gated-queue.cjs');

function makePrescreen() {
  const records = ingestAuthorizedDataset({
    registry,
    ownerAttestation: true,
    uploadedBy: 'OWNER-ABERDEEN',
    observedAt: '2026-08-18T09:20:00Z',
    format: 'json',
    content: JSON.stringify([
      { title: 'Candidate A', supplier: 'Supplier', sku: 'A', upc: '001234567801', cost: '20.00', stock: 100, weight_oz: 8 },
      { title: 'Candidate B', supplier: 'Supplier', sku: 'B', upc: '001234567802', cost: '21.00', stock: 100, weight_oz: 8 },
      { title: 'Candidate C', supplier: 'Supplier', sku: 'C', upc: '001234567803', cost: '22.00', stock: 100, weight_oz: 8 },
      { title: 'Candidate D', supplier: 'Supplier', sku: 'D', upc: '001234567804', cost: '23.00', stock: 100, weight_oz: 8 },
      { title: 'SKU Only', supplier: 'Supplier', sku: 'E', cost: '10.00', stock: 100, weight_oz: 8 },
    ]),
  }).records.map((record, index) => ({
    ...record,
    moqEvidence: 'SUPPLIER_SUPPORTED',
    supplierSignals: { retailPriceCents: 6000 - (index * 200), returnable: true },
  }));
  return prescreenCandidatesV2(records, {
    maxVerificationQueue: 2,
    maxSourceCostCents: 10000,
    maxInitialOutlayCents: 50000,
  });
}

function assessment(candidateId, status, overrides = {}) {
  return {
    candidateId,
    status,
    action: status === 'GROSS_PROFIT_IMPOSSIBLE' ? 'DEFER_WEB_PRICE' : 'KEEP_FOR_EBAY_VERIFY',
    reason: `test ${status}`,
    grossSpreadCeilingCents: status === 'PLAUSIBLE' ? 4500 : status === 'PRICE_RISK' ? 1800 : status === 'NO_EVIDENCE' ? null : 900,
    ...overrides,
  };
}

test('provisional pool expands beyond the old final queue and requires exact public-web identity', () => {
  const prescreen = makePrescreen();
  assert.equal(prescreen.verificationCount, 2);
  const pool = buildProvisionalWebPool(prescreen, { poolSize: 4 });
  assert.equal(pool.provisionalPool.length, 4);
  assert.equal(pool.identityReview.length, 1);
  assert.match(pool.identityReview[0].reason, /GTIN\/UPC or MPN/);
});

test('missing public-web assessment never enters final eBay queue', () => {
  const prescreen = makePrescreen();
  const pool = buildProvisionalWebPool(prescreen, { poolSize: 4 });
  const firstId = pool.provisionalPool[0].candidateId;
  const result = finalizeWebGatedQueue({
    prescreen,
    poolSize: 4,
    maxVerificationQueue: 2,
    assessments: { [firstId]: assessment(firstId, 'PLAUSIBLE') },
  });
  assert.equal(result.verificationCount, 1);
  assert.equal(result.pendingWebCount, 3);
  assert.equal(result.complete, false);
});

test('public-web impossible-margin candidates are removed before final queue creation', () => {
  const prescreen = makePrescreen();
  const pool = buildProvisionalWebPool(prescreen, { poolSize: 4 });
  const [a, b, c, d] = pool.provisionalPool.map((item) => item.candidateId);
  const result = finalizeWebGatedQueue({
    prescreen,
    poolSize: 4,
    maxVerificationQueue: 3,
    assessments: {
      [a]: assessment(a, 'GROSS_PROFIT_IMPOSSIBLE'),
      [b]: assessment(b, 'PLAUSIBLE'),
      [c]: assessment(c, 'PRICE_RISK'),
      [d]: assessment(d, 'NO_EVIDENCE'),
    },
  });
  assert.equal(result.webDeferredCount, 1);
  assert.equal(result.verificationCount, 3);
  assert.ok(!result.verificationQueue.some((item) => item.candidateId === a));
  assert.equal(result.complete, true);
});

test('PLAUSIBLE outranks NO_EVIDENCE, which outranks PRICE_RISK after web gate', () => {
  const prescreen = makePrescreen();
  const pool = buildProvisionalWebPool(prescreen, { poolSize: 3 });
  const [a, b, c] = pool.provisionalPool.map((item) => item.candidateId);
  const result = finalizeWebGatedQueue({
    prescreen,
    poolSize: 3,
    maxVerificationQueue: 3,
    assessments: {
      [a]: assessment(a, 'PRICE_RISK'),
      [b]: assessment(b, 'NO_EVIDENCE'),
      [c]: assessment(c, 'PLAUSIBLE'),
    },
  });
  assert.deepEqual(result.verificationQueue.map((item) => item.webAssessment.status), ['PLAUSIBLE', 'NO_EVIDENCE', 'PRICE_RISK']);
  assert.deepEqual(result.verificationQueue.map((item) => item.verificationRank), [1, 2, 3]);
});

test('unsupported or mismatched web evidence fails closed to review', () => {
  const prescreen = makePrescreen();
  const pool = buildProvisionalWebPool(prescreen, { poolSize: 2 });
  const [a, b] = pool.provisionalPool.map((item) => item.candidateId);
  const result = finalizeWebGatedQueue({
    prescreen,
    poolSize: 2,
    assessments: {
      [a]: assessment('wrong-candidate', 'PLAUSIBLE'),
      [b]: assessment(b, 'BUY'),
    },
  });
  assert.equal(result.verificationCount, 0);
  assert.equal(result.webReviewCount, 3); // two invalid assessments + SKU-only identity review
  assert.equal(result.pendingWebCount, 0);
});
