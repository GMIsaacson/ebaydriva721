'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const registry = require('../live-sourcing/source-access-registry.json');
const { ingestAuthorizedDataset } = require('../runtime/product-intake.cjs');
const { validateManualEbayVerification } = require('../runtime/ebay-manual-verification.cjs');

const [candidate] = ingestAuthorizedDataset({
  registry,
  ownerAttestation: true,
  uploadedBy: 'OWNER-ABERDEEN',
  observedAt: '2026-08-18T03:00:00Z',
  format: 'json',
  content: JSON.stringify([{
    title: 'Demo Industrial Part', supplier: 'Demo Supplier', sku: 'D-100', mpn: 'D100', brand: 'Demo', cost: '20.00',
    stock: 50, weight_oz: 12, length: 6, width: 4, height: 3,
  }]),
}).records;

function verification(overrides = {}) {
  return {
    candidateId: candidate.candidateId,
    marketplace: 'ebay-us',
    method: 'ebay_product_research_manual',
    verifiedBy: 'OWNER-ABERDEEN',
    verifiedAt: '2026-08-18T03:15:00Z',
    evidenceRef: 'manual-evidence://demo-part/2026-08-18',
    searchQuery: 'Demo D100',
    exactIdentityConfirmed: true,
    observationPeriodDays: 90,
    unitsSold: 30,
    avgSoldPriceCents: 5995,
    activeListings: 12,
    sellThroughBps: 7143,
    avgShippingCents: 895,
    acceptedOfferPricesIncluded: true,
    ...overrides,
  };
}

const base = {
  registry,
  candidate,
  at: '2026-08-18T03:30:00Z',
};

test('accepts fresh exact manual Product Research evidence without fetching eBay', () => {
  const result = validateManualEbayVerification({ ...base, verification: verification() });
  assert.equal(result.status, 'VERIFIED');
  assert.equal(result.soldPer30Days, 10);
  assert.equal(result.marketplaceFetches, 0);
  assert.equal(result.machineFetches, 0);
  assert.equal(result.externalActions, 0);
  assert.equal(result.sourceAccess.classification, 'YELLOW');
});

test('candidate identity must match the queued DataScout record', () => {
  assert.throws(() => validateManualEbayVerification({
    ...base,
    verification: verification({ candidateId: 'DSC-aaaaaaaaaaaaaaaaaaaa' }),
  }), /does not match candidate/);
});

test('unconfirmed marketplace identity routes to review', () => {
  const result = validateManualEbayVerification({ ...base, verification: verification({ exactIdentityConfirmed: false }) });
  assert.equal(result.status, 'REVIEW');
  assert.match(result.reason, /identity/);
});

test('zero observed sold units rejects the candidate rather than inventing demand', () => {
  const result = validateManualEbayVerification({ ...base, verification: verification({ unitsSold: 0, avgSoldPriceCents: null }) });
  assert.equal(result.status, 'REJECT');
  assert.match(result.reason, /no sold evidence/);
});

test('sold evidence without an average sold price is incomplete', () => {
  const result = validateManualEbayVerification({ ...base, verification: verification({ unitsSold: 4, avgSoldPriceCents: null }) });
  assert.equal(result.status, 'INCOMPLETE');
  assert.match(result.reason, /average sold price/);
});

test('stale manual marketplace evidence cannot advance', () => {
  const result = validateManualEbayVerification({
    ...base,
    at: '2026-08-22T03:30:00Z',
    verification: verification(),
    maxAgeHours: 72,
  });
  assert.equal(result.status, 'REVIEW');
  assert.match(result.reason, /stale/);
});

test('future-dated evidence cannot advance', () => {
  const result = validateManualEbayVerification({
    ...base,
    verification: verification({ verifiedAt: '2026-08-18T04:30:00Z' }),
  });
  assert.equal(result.status, 'REVIEW');
  assert.match(result.reason, /future/);
});

test('sell-through basis points are bounded to 0..10000', () => {
  assert.throws(() => validateManualEbayVerification({
    ...base,
    verification: verification({ sellThroughBps: 10001 }),
  }), /sellThroughBps/);
});
