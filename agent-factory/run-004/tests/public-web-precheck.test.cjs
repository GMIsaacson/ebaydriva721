'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  assessPublicWebCompetitivePrice,
  buildPublicWebQueries,
} = require('../runtime/public-web-precheck.cjs');

const candidate = {
  candidateId: 'DSC-TEST-1',
  title: 'Independent Trading Co. EXP200PFZ Black S',
  brand: 'Independent Trading Co.',
  mpn: 'EXP200PFZ',
  upc: '00880723038404',
  packQuantity: 1,
  unitCostCents: 3636,
};

function evidence(domain, priceCents, overrides = {}) {
  return {
    candidateId: candidate.candidateId,
    exactIdentityConfirmed: true,
    packQuantityConfirmed: true,
    observedPriceCents: priceCents,
    url: `https://${domain}/product`,
    title: candidate.title,
    evidenceText: `Observed exact-match price $${(priceCents / 100).toFixed(2)}`,
    observedAt: '2026-08-18T08:50:00Z',
    ...overrides,
  };
}

test('builds strongest public-web queries with UPC first', () => {
  const queries = buildPublicWebQueries(candidate);
  assert.deepEqual(queries, [
    '"00880723038404"',
    '"Independent Trading Co." "EXP200PFZ"',
    '"Independent Trading Co. EXP200PFZ Black S"',
  ]);
});

test('does not auto-defer from one price source', () => {
  const result = assessPublicWebCompetitivePrice({
    candidate,
    minProfitCents: 1500,
    evidence: [evidence('seller-a.example', 4700)],
  });
  assert.equal(result.action, 'KEEP_FOR_EBAY_VERIFY');
  assert.equal(result.status, 'PRICE_RISK');
  assert.equal(result.independentDomains, 1);
});

test('auto-defers only when corroborated exact-match gross profit is mathematically impossible', () => {
  const result = assessPublicWebCompetitivePrice({
    candidate,
    minProfitCents: 1500,
    evidence: [
      evidence('seller-a.example', 4700),
      evidence('seller-b.example', 4750),
    ],
  });
  assert.equal(result.status, 'GROSS_PROFIT_IMPOSSIBLE');
  assert.equal(result.action, 'DEFER_WEB_PRICE');
  assert.equal(result.competitivePriceCents, 4700);
  assert.equal(result.grossSpreadCeilingCents, 1064);
});

test('does not use weak identity or unconfirmed pack evidence', () => {
  const result = assessPublicWebCompetitivePrice({
    candidate,
    minProfitCents: 1500,
    evidence: [
      evidence('seller-a.example', 4700, { exactIdentityConfirmed: false }),
      evidence('seller-b.example', 4750, { packQuantityConfirmed: false }),
    ],
  });
  assert.equal(result.status, 'NO_EVIDENCE');
  assert.equal(result.action, 'KEEP_FOR_EBAY_VERIFY');
});

test('same-domain duplicate evidence does not satisfy corroboration', () => {
  const result = assessPublicWebCompetitivePrice({
    candidate,
    minProfitCents: 1500,
    evidence: [
      evidence('seller-a.example', 4700),
      evidence('seller-a.example', 4650, { url: 'https://seller-a.example/other' }),
    ],
  });
  assert.equal(result.independentDomains, 1);
  assert.equal(result.action, 'KEEP_FOR_EBAY_VERIFY');
});

test('healthy competitive price remains queued for actual marketplace demand verification', () => {
  const result = assessPublicWebCompetitivePrice({
    candidate,
    minProfitCents: 1500,
    evidence: [
      evidence('seller-a.example', 7460),
      evidence('seller-b.example', 7600),
    ],
  });
  assert.equal(result.status, 'PLAUSIBLE');
  assert.equal(result.action, 'KEEP_FOR_EBAY_VERIFY');
  assert.equal(result.grossSpreadCeilingCents, 3824);
});

test('wildly disagreeing prices cannot hard-defer a candidate', () => {
  const result = assessPublicWebCompetitivePrice({
    candidate,
    minProfitCents: 1500,
    evidence: [
      evidence('seller-a.example', 4700),
      evidence('seller-b.example', 8000),
    ],
  });
  assert.equal(result.action, 'KEEP_FOR_EBAY_VERIFY');
});
