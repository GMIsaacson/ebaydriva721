const test = require('node:test');
const assert = require('node:assert/strict');
const { FORMULA_VERSION, calculateEconomics } = require('../runtime/economics.cjs');

const complete = {
  collectedRevenueCents: 4000,
  sourceCostCents: 1000,
  inboundFreightCents: 500,
  marketplaceFeesCents: 600,
  outboundShippingCents: 700,
  packagingCents: 100,
  riskReserveCents: 200,
};

test('calculates deterministic landed economics in integer cents', () => {
  assert.deepEqual(calculateEconomics(complete), {
    status: 'Complete',
    formulaVersion: FORMULA_VERSION,
    inputHash: calculateEconomics(complete).inputHash,
    collectedRevenueCents: 4000,
    totalCostCents: 3100,
    netProfitCents: 900,
    marginBps: 2250,
    roiBps: 2903,
    breakEvenCollectedRevenueCents: 3100,
  });
});

test('returns the same hash for keys in a different order', () => {
  const reversed = Object.fromEntries(Object.entries(complete).reverse());
  assert.equal(calculateEconomics(complete).inputHash, calculateEconomics(reversed).inputHash);
});

test('returns Incomplete rather than guessing a missing cost', () => {
  const input = { ...complete };
  delete input.inboundFreightCents;
  const result = calculateEconomics(input);
  assert.equal(result.status, 'Incomplete');
  assert.deepEqual(result.missing, ['inboundFreightCents']);
});

test('rejects fractional cents and negative values', () => {
  const result = calculateEconomics({ ...complete, sourceCostCents: -1, packagingCents: 1.5 });
  assert.equal(result.status, 'Incomplete');
  assert.deepEqual(result.invalid.sort(), ['packagingCents', 'sourceCostCents']);
});

test('permits negative profit without relabeling it as a profitable deal', () => {
  const result = calculateEconomics({ ...complete, collectedRevenueCents: 1000 });
  assert.equal(result.netProfitCents, -2100);
  assert.ok(result.marginBps < 0);
});
