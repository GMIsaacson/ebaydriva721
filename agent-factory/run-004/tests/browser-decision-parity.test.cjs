'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const registry = require('../live-sourcing/source-access-registry.json');
const { ingestAuthorizedDataset } = require('../runtime/product-intake.cjs');
const { validateManualEbayVerification } = require('../runtime/ebay-manual-verification.cjs');
const { buildDealDecision } = require('../runtime/deal-decision.cjs');

async function browserDecision() {
  return import('../../../src/liveSourcing/browser-decision.mjs');
}

const [candidate] = ingestAuthorizedDataset({
  registry,
  ownerAttestation: true,
  uploadedBy: 'OWNER-ABERDEEN',
  observedAt: '2026-08-18T03:00:00Z',
  format: 'json',
  content: JSON.stringify([{
    title: 'Parity Pack', supplier: 'Demo Supplier', sku: 'P-10', brand: 'Demo', mpn: 'P10',
    cost: '20.00', pack_qty: 10, stock: 100, weight_oz: 16, length: 8, width: 6, height: 4,
  }]),
}).records;

const rawVerification = {
  candidateId: candidate.candidateId,
  marketplace: 'ebay-us',
  method: 'ebay_product_research_manual',
  verifiedBy: 'OWNER-ABERDEEN',
  verifiedAt: '2026-08-18T03:15:00Z',
  evidenceRef: 'manual-evidence://parity/2026-08-18',
  searchQuery: 'Demo P10',
  exactIdentityConfirmed: true,
  observationPeriodDays: 90,
  unitsSold: 30,
  avgSoldPriceCents: 5995,
  activeListings: 12,
  sellThroughBps: 7143,
  avgShippingCents: 895,
  acceptedOfferPricesIncluded: true,
};

const decisionArgs = {
  candidate,
  saleUnitQuantity: 2,
  inboundFreightPerSaleCents: 100,
  packagingCents: 100,
  marketplaceFeeBps: 1350,
  marketplaceFixedFeeCents: 40,
  feeEvidenceRef: 'fee-policy://parity',
  riskReserveBps: 500,
  shippingQuote: {
    capturedAt: '2026-08-18T03:20:00Z',
    evidenceRef: 'shipping-quote://parity',
    quotesCents: [700, 850, 1000],
  },
  decisionPolicy: {
    minBuyProfitCents: 1500,
    minBuyRoiBps: 3000,
    minBuyMarginBps: 2000,
    minBuySoldPer30Days: 5,
  },
  at: '2026-08-18T03:30:00Z',
};

test('browser manual eBay verification matches authoritative CJS decision fields', async () => {
  const browser = await browserDecision();
  const authoritative = validateManualEbayVerification({ registry, candidate, verification: rawVerification, at: decisionArgs.at });
  const client = browser.validateBrowserManualEbayVerification({ candidate, verification: rawVerification, at: decisionArgs.at });
  assert.deepEqual(
    { status: client.status, reason: client.reason, soldPer30Days: client.soldPer30Days, candidateId: client.candidateId, ageHours: client.ageHours },
    { status: authoritative.status, reason: authoritative.reason, soldPer30Days: authoritative.soldPer30Days, candidateId: authoritative.candidateId, ageHours: authoritative.ageHours },
  );
  assert.deepEqual(client.verification, authoritative.verification);
  assert.equal(client.marketplaceFetches, 0);
});

test('browser BUY/WATCH/REJECT economics match authoritative CJS outputs', async () => {
  const browser = await browserDecision();
  const authoritativeVerification = validateManualEbayVerification({ registry, candidate, verification: rawVerification, at: decisionArgs.at });
  const clientVerification = browser.validateBrowserManualEbayVerification({ candidate, verification: rawVerification, at: decisionArgs.at });
  const authoritative = buildDealDecision({ ...decisionArgs, marketplaceVerification: authoritativeVerification });
  const client = await browser.buildBrowserDealDecision({ ...decisionArgs, marketplaceVerification: clientVerification });

  assert.equal(client.status, authoritative.status);
  assert.equal(client.decision, authoritative.decision);
  assert.deepEqual(client.reasons, authoritative.reasons);
  assert.equal(client.allocatedSourceCostCents, authoritative.allocatedSourceCostCents);
  assert.equal(client.marketplaceFeeBps, authoritative.marketplaceFeeBps);
  assert.equal(client.riskReserveBps, authoritative.riskReserveBps);
  assert.deepEqual(client.shipping, authoritative.shipping);
  assert.deepEqual(client.economics, authoritative.economics);
  assert.equal(client.soldPer30Days, authoritative.soldPer30Days);
  assert.equal(client.marketplaceFetches, 0);
  assert.equal(client.externalActions, 0);
});

test('browser stale-evidence behavior matches authoritative CJS', async () => {
  const browser = await browserDecision();
  const authoritativeVerification = validateManualEbayVerification({ registry, candidate, verification: rawVerification, at: decisionArgs.at });
  const clientVerification = browser.validateBrowserManualEbayVerification({ candidate, verification: rawVerification, at: decisionArgs.at });
  const staleArgs = {
    ...decisionArgs,
    at: '2026-08-22T03:30:00Z',
    shippingQuote: { capturedAt: '2026-08-22T03:20:00Z', evidenceRef: 'shipping://fresh', quotesCents: [1000] },
  };
  const authoritative = buildDealDecision({ ...staleArgs, marketplaceVerification: authoritativeVerification });
  const client = await browser.buildBrowserDealDecision({ ...staleArgs, marketplaceVerification: clientVerification });
  assert.equal(client.status, authoritative.status);
  assert.equal(client.reason, authoritative.reason);
  assert.equal(client.decision, null);
});
