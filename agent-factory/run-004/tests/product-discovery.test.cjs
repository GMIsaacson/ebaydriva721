'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  stage1Screen,
  matchSupplier,
  buildEconomicsScenario,
  classifyFinalDecision,
} = require('../runtime/product-discovery.cjs');

const calibration = [
  ['drill brush set', 640, 1979, 500],
  ['car seat gap fillers', 230, 1395, 90],
  ['magnetic pickup tool set', 585, 1099, 325],
  ['reusable pet hair roller', 125, 1099, 75],
  ['2-pack air fryer liners', 747, 1153, 65],
];

test('five calibration products survive Stage 1 without becoming automatic BUYs', () => {
  for (const [title, soldCount, itemPriceCents, preliminarySupplierUnitCostCents] of calibration) {
    const result = stage1Screen({
      title,
      soldCount,
      itemPriceCents,
      preliminarySupplierUnitCostCents,
      brandState: 'GENERIC',
      sizeClass: 'SMALL',
      weightClass: 'LIGHT',
      ipRisk: 'LOW',
      complianceRisk: 'LOW',
      riskTags: [],
      bundleEligible: true,
    });
    assert.equal(result.status, 'PASS', `${title} should pass Stage 1`);
  }
});

test('branded-only demand and hard-risk products fail closed', () => {
  assert.equal(stage1Screen({ title: 'branded widget', soldCount: 500, itemPriceCents: 2999, brandState: 'BRANDED_ONLY' }).status, 'FAIL');
  assert.equal(stage1Screen({ title: 'mouth device', soldCount: 500, itemPriceCents: 1999, brandState: 'GENERIC', riskTags: ['mouth-contact-health'] }).status, 'FAIL');
});

test('low ASP with high demand is not auto-killed when bundle testing is viable', () => {
  const result = stage1Screen({
    title: 'sink strainers 2-pack',
    soldCount: 729,
    itemPriceCents: 549,
    preliminarySupplierUnitCostCents: 81,
    brandState: 'GENERIC',
    bundleEligible: true,
    sizeClass: 'SMALL',
    weightClass: 'LIGHT',
    ipRisk: 'LOW',
    complianceRisk: 'LOW',
  });
  assert.equal(result.status, 'PASS');
  assert.match(result.reasons.join(' '), /bundle\/buyer-paid shipping/);
});

test('supplier equivalence requires required BOM attributes and rejects mismatches', () => {
  const fingerprint = {
    requiredAttributes: ['material', 'packQuantity', 'length'],
    attributes: { material: 'silicone', packQuantity: 2, length: '22in' },
  };
  const exact = matchSupplier(fingerprint, {
    exactIdentityEvidence: true,
    attributes: { material: 'silicone', packQuantity: 2, length: '22in' },
  });
  assert.equal(exact.equivalence, 'EXACT');

  const mismatch = matchSupplier(fingerprint, {
    exactIdentityEvidence: true,
    attributes: { material: 'silicone', packQuantity: 1, length: '22in' },
  });
  assert.equal(mismatch.equivalence, 'NOT_EQUIVALENT');
  assert.deepEqual(mismatch.mismatched, ['packQuantity']);
});

test('economics supports free-shipping and buyer-paid models deterministically', () => {
  const common = {
    itemPriceCents: 1099,
    quantity: 1,
    supplierUnitCostCents: 75,
    inboundFreightCents: 50,
    packagingCents: 25,
    ebayFeeBps: 1360,
    orderFeeCents: 40,
    promotionBps: 500,
    returnsBps: 300,
    defectsBps: 100,
  };
  const free = buildEconomicsScenario({ ...common, shippingModel: 'FREE', buyerPaidShippingCents: 0, outboundShippingCents: 450 });
  const buyerPaid = buildEconomicsScenario({ ...common, shippingModel: 'BUYER_PAID', buyerPaidShippingCents: 499, outboundShippingCents: 450 });

  assert.equal(free.status, 'Complete');
  assert.equal(buyerPaid.status, 'Complete');
  assert.ok(buyerPaid.netProfitCents > free.netProfitCents);
  assert.equal(free.shippingModel, 'FREE');
  assert.equal(buyerPaid.shippingModel, 'BUYER_PAID');
});

test('missing economics fail closed to RFQ and strong economics require conservative 20% margin', () => {
  const stage1 = { status: 'PASS' };
  const incomplete = classifyFinalDecision({ stage1, equivalence: 'EXACT', sourcingComplete: false, riskState: 'PASS' });
  assert.equal(incomplete.status, 'RFQ');

  const base = buildEconomicsScenario({
    itemPriceCents: 1999,
    buyerPaidShippingCents: 0,
    quantity: 1,
    supplierUnitCostCents: 200,
    inboundFreightCents: 100,
    outboundShippingCents: 450,
    packagingCents: 50,
    ebayFeeBps: 1360,
    orderFeeCents: 40,
    promotionBps: 500,
    returnsBps: 300,
    defectsBps: 100,
  });
  const conservative = buildEconomicsScenario({
    itemPriceCents: 1799,
    buyerPaidShippingCents: 0,
    quantity: 1,
    supplierUnitCostCents: 250,
    inboundFreightCents: 125,
    outboundShippingCents: 400,
    packagingCents: 60,
    ebayFeeBps: 1360,
    orderFeeCents: 40,
    promotionBps: 750,
    returnsBps: 400,
    defectsBps: 150,
  });
  assert.ok(conservative.marginBps >= 2000, `expected conservative margin >= 2000 bps, got ${conservative.marginBps}`);
  const result = classifyFinalDecision({ stage1, equivalence: 'EXACT', base, conservative, sourcingComplete: true, riskState: 'PASS' });
  assert.equal(result.status, 'STRONG PASS');

  const ownerResult = classifyFinalDecision({ stage1, equivalence: 'EXACT', base, conservative, sourcingComplete: true, riskState: 'PASS', ownerBuyReview: true });
  assert.equal(ownerResult.status, 'BUY');
});

test('conservative margin failure produces KILL despite attractive base case', () => {
  const stage1 = { status: 'PASS' };
  const base = { status: 'Complete', netProfitCents: 700, marginBps: 3500 };
  const conservative = { status: 'Complete', netProfitCents: 100, marginBps: 700 };
  const result = classifyFinalDecision({ stage1, equivalence: 'EXACT', base, conservative, sourcingComplete: true, riskState: 'PASS' });
  assert.equal(result.status, 'KILL');
});
