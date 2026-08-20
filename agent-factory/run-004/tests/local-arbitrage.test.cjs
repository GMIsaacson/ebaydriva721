'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

async function loadCore() {
  return import('../../../src/liveSourcing/local-arbitrage-core.mjs');
}

const base = {
  id: 'T-1', title: 'Tool bundle', source: 'Manual', location: 'Twin Cities, MN',
  askPriceCents: 5000, expectedSaleCents: 15000, sellingFeesCents: 1800,
  pickupCents: 800, packagingCents: 200, refurbishmentCents: 300, riskReserveCents: 900,
  exactIdentity: true, soldCompCount: 3,
  evidenceObservedAt: '2026-08-20T16:00:00Z', now: '2026-08-20T17:00:00Z',
};

test('qualified verified listing becomes owner-review buy candidate', async () => {
  const { scoreLocalListing } = await loadCore();
  const result = scoreLocalListing(base);
  assert.equal(result.decision, 'BUY_CANDIDATE');
  assert.equal(result.purchaseAuthorized, false);
  assert.equal(result.externalActions, 0);
});

test('profit below threshold rejects even with strong identity', async () => {
  const { scoreLocalListing } = await loadCore();
  const result = scoreLocalListing({ ...base, expectedSaleCents: 10000 });
  assert.equal(result.decision, 'REJECT');
  assert.match(result.reasons.join(' '), /net profit below/);
});

test('ROI below threshold rejects', async () => {
  const { scoreLocalListing } = await loadCore();
  const result = scoreLocalListing({ ...base, askPriceCents: 10000, expectedSaleCents: 17000 });
  assert.equal(result.decision, 'REJECT');
  assert.match(result.reasons.join(' '), /ROI below/);
});

test('unknown identity remains watch despite attractive economics', async () => {
  const { scoreLocalListing } = await loadCore();
  const result = scoreLocalListing({ ...base, exactIdentity: false });
  assert.equal(result.decision, 'WATCH');
});

test('ambiguous bundle condition remains watch', async () => {
  const { scoreLocalListing } = await loadCore();
  const result = scoreLocalListing({ ...base, ambiguousCondition: true, unresolvedItems: 2 });
  assert.equal(result.decision, 'WATCH');
});

test('stale evidence cannot create a buy candidate', async () => {
  const { scoreLocalListing } = await loadCore();
  const result = scoreLocalListing({ ...base, evidenceObservedAt: '2026-08-01T00:00:00Z' });
  assert.equal(result.decision, 'WATCH');
  assert.match(result.reasons.join(' '), /stale/);
});

test('duplicates do not inflate verified density', async () => {
  const { buildLocalArbitrageQueue } = await loadCore();
  const result = buildLocalArbitrageQueue([base, { ...base, id: 'T-2', duplicate: true }]);
  assert.equal(result.screenedCount, 1);
  assert.equal(result.actionableCount, 1);
  assert.equal(result.densityPct, 100);
});

test('density kill criterion activates after 20 verified screens below 3 percent', async () => {
  const { buildLocalArbitrageQueue } = await loadCore();
  const weak = Array.from({ length: 20 }, (_, i) => ({ ...base, id: `W-${i}`, expectedSaleCents: 8000 }));
  const result = buildLocalArbitrageQueue(weak);
  assert.equal(result.actionableCount, 0);
  assert.equal(result.laneVerdict, 'KILL_OR_REDESIGN');
});
