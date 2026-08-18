'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const registry = require('../live-sourcing/source-access-registry.json');
const { ingestAuthorizedDataset } = require('../runtime/product-intake.cjs');
const { validateManualEbayVerification } = require('../runtime/ebay-manual-verification.cjs');
const { buildDealDecision, conservativeShippingQuote } = require('../runtime/deal-decision.cjs');

const [candidate] = ingestAuthorizedDataset({
  registry,
  ownerAttestation: true,
  uploadedBy: 'OWNER-ABERDEEN',
  observedAt: '2026-08-18T03:00:00Z',
  format: 'json',
  content: JSON.stringify([{
    title: 'Demo 10 Pack', supplier: 'Demo Supplier', sku: 'D-10', brand: 'Demo', mpn: 'D10',
    cost: '20.00', pack_qty: 10, stock: 100, weight_oz: 16, length: 8, width: 6, height: 4,
  }]),
}).records;

const marketplaceVerification = validateManualEbayVerification({
  registry,
  candidate,
  at: '2026-08-18T03:30:00Z',
  verification: {
    candidateId: candidate.candidateId,
    marketplace: 'ebay-us',
    method: 'ebay_product_research_manual',
    verifiedBy: 'OWNER-ABERDEEN',
    verifiedAt: '2026-08-18T03:15:00Z',
    evidenceRef: 'manual-evidence://demo/2026-08-18',
    exactIdentityConfirmed: true,
    observationPeriodDays: 90,
    unitsSold: 30,
    avgSoldPriceCents: 5995,
    avgShippingCents: 895,
  },
});

const policy = {
  minBuyProfitCents: 1500,
  minBuyRoiBps: 3000,
  minBuyMarginBps: 2000,
  minBuySoldPer30Days: 5,
};

function decision(overrides = {}) {
  return buildDealDecision({
    candidate,
    marketplaceVerification,
    saleUnitQuantity: 2,
    inboundFreightPerSaleCents: 100,
    packagingCents: 100,
    marketplaceFeeBps: 1350,
    marketplaceFixedFeeCents: 40,
    feeEvidenceRef: 'fee-policy://ebay-us/category-demo/2026-08-18',
    riskReserveBps: 500,
    shippingQuote: {
      capturedAt: '2026-08-18T03:20:00Z',
      evidenceRef: 'shipping-quote://demo/2026-08-18',
      quotesCents: [700, 850, 1000],
    },
    decisionPolicy: policy,
    at: '2026-08-18T03:30:00Z',
    ...overrides,
  });
}

test('allocates source pack cost to the exact eBay sale quantity', () => {
  const result = decision();
  assert.equal(candidate.packQuantity, 10);
  assert.equal(result.saleUnitQuantity, 2);
  assert.equal(result.allocatedSourceCostCents, 400);
});

test('uses the conservative maximum supplied shipping quote', () => {
  const shipping = conservativeShippingQuote({
    capturedAt: '2026-08-18T03:20:00Z',
    evidenceRef: 'shipping-quote://demo',
    quotesCents: [650, 900, 1200],
  }, '2026-08-18T03:30:00Z');
  assert.equal(shipping.status, 'READY');
  assert.equal(shipping.strategy, 'CONSERVATIVE_MAX');
  assert.equal(shipping.outboundShippingCents, 1200);
});

test('returns BUY only when all owner thresholds pass', () => {
  const result = decision();
  assert.equal(result.status, 'COMPLETE');
  assert.equal(result.decision, 'BUY');
  assert.equal(result.economics.netProfitCents, 3974);
  assert.equal(result.soldPer30Days, 10);
  assert.equal(result.marketplaceFetches, 0);
  assert.equal(result.machineFetches, 0);
  assert.equal(result.externalActions, 0);
});

test('returns WATCH for positive economics below owner BUY thresholds', () => {
  const result = decision({
    decisionPolicy: {
      minBuyProfitCents: 4500,
      minBuyRoiBps: 15000,
      minBuyMarginBps: 6000,
      minBuySoldPer30Days: 12,
    },
  });
  assert.equal(result.decision, 'WATCH');
  assert.ok(result.reasons.length >= 1);
});

test('returns REJECT for non-positive landed economics', () => {
  const result = decision({
    shippingQuote: {
      capturedAt: '2026-08-18T03:20:00Z',
      evidenceRef: 'shipping-quote://expensive',
      quotesCents: [6500],
    },
  });
  assert.equal(result.decision, 'REJECT');
  assert.ok(result.economics.netProfitCents < 0);
});

test('requires fee provenance instead of hard-coding eBay fees', () => {
  const result = decision({ feeEvidenceRef: '' });
  assert.equal(result.status, 'INCOMPLETE');
  assert.match(result.reason, /fee evidence/);
});

test('missing shipping evidence is incomplete', () => {
  const result = decision({ shippingQuote: null });
  assert.equal(result.status, 'INCOMPLETE');
  assert.match(result.reason, /shipping quote/);
});

test('stale shipping evidence routes to review', () => {
  const result = decision({
    at: '2026-08-22T03:30:00Z',
    shippingQuote: {
      capturedAt: '2026-08-18T03:20:00Z',
      evidenceRef: 'shipping-quote://stale',
      quotesCents: [1000],
    },
  });
  assert.equal(result.status, 'REVIEW');
  assert.match(result.reason, /stale/);
});

test('unverified marketplace evidence blocks the deal decision', () => {
  const result = decision({ marketplaceVerification: { status: 'REVIEW', candidateId: candidate.candidateId } });
  assert.equal(result.status, 'BLOCKED');
  assert.equal(result.decision, null);
});

test('BUY thresholds are explicit owner inputs and cannot be omitted', () => {
  assert.throws(() => decision({ decisionPolicy: null }), /decisionPolicy is required/);
});
