const test = require('node:test');
const assert = require('node:assert/strict');
const { EVIDENCE_SCHEMA_VERSION, calculateReferralFeeCents, buildAmazonEconomicsInputs } = require('../runtime/amazon-economics-evidence.cjs');

const evidence = (state='OBSERVED', extra={}) => ({ state, sourceUrl:'https://example.com/evidence', observedAt:'2026-09-22T08:00:00Z', claim:'Evidence supports this exact input.', ...extra });
const policy = (version) => ({ state:'POLICY', sourceUrl:'', observedAt:'2026-09-22T08:00:00Z', claim:'Owner-approved bounded research policy.', policyVersion:version });
const base = {
  schemaVersion:EVIDENCE_SCHEMA_VERSION,
  marketplace:'amazon-us',
  asin:'B09PJ8L58G',
  sale:{amountCents:399,evidence:evidence()},
  sourceCost:{amountCents:28,evidence:evidence()},
  inboundFreight:{amountCents:50,evidence:evidence('QUOTED')},
  fulfillmentMode:'FBM',
  sellingPlan:'PROFESSIONAL',
  feeCategory:{name:'Tools and Home Improvement',evidence:evidence()},
  referralFeeBasis:{amountCents:399,evidence:evidence()},
  otherMarketplaceFees:{amountCents:0,evidence:policy('amazon-marketplace-other-fees/1')},
  packageFacts:{lengthIn:8,widthIn:3,heightIn:1,weightOz:4,evidence:evidence('MEASURED')},
  fbmOutboundShipping:{amountCents:150,evidence:evidence('QUOTED')},
  packaging:{amountCents:10,evidence:policy('packaging/1')},
  riskReserve:{rateBps:500,evidence:policy('risk-reserve/1')},
};

test('uses versioned first-party referral schedule',()=>{
  assert.equal(calculateReferralFeeCents(399,'Tools and Home Improvement'),60);
  assert.equal(calculateReferralFeeCents(100,'Business, Industrial, and Scientific Supplies'),30);
});

test('builds complete economics only when every evidence bucket is explicit',()=>{
  const result=buildAmazonEconomicsInputs(base);
  assert.equal(result.status,'Complete');
  assert.deepEqual(result.economicsInputs,{
    collectedRevenueCents:399,
    sourceCostCents:28,
    inboundFreightCents:50,
    marketplaceFeesCents:60,
    outboundShippingCents:150,
    packagingCents:10,
    riskReserveCents:20,
  });
  assert.equal(result.arithmetic.netProfitCents,81);
  assert.equal(result.fixedCostsExcluded.length,1);
});

test('individual plan adds per-item selling fee',()=>{
  const result=buildAmazonEconomicsInputs({...base,sellingPlan:'INDIVIDUAL'});
  assert.equal(result.status,'Complete');
  assert.equal(result.economicsInputs.marketplaceFeesCents,159);
});

test('fails closed when fulfillment and cost evidence are unresolved',()=>{
  const input={...base,fulfillmentMode:'UNRESOLVED'};
  delete input.inboundFreight;
  delete input.packaging;
  const result=buildAmazonEconomicsInputs(input);
  assert.equal(result.status,'Incomplete');
  assert.ok(result.missing.includes('fulfillmentMode'));
  assert.ok(result.missing.includes('inboundFreight'));
  assert.ok(result.missing.includes('packaging'));
  assert.equal(result.economicsInputs,null);
});

test('zero costs still require evidence rather than implicit defaults',()=>{
  const input={...base,inboundFreight:{amountCents:0,evidence:null}};
  const result=buildAmazonEconomicsInputs(input);
  assert.equal(result.status,'Incomplete');
  assert.ok(result.missing.includes('inboundFreight.evidence'));
});

test('FBA requires exact fulfillment-cost evidence and package facts',()=>{
  const input={...base,fulfillmentMode:'FBA'};
  delete input.fbmOutboundShipping;
  delete input.packageFacts;
  const result=buildAmazonEconomicsInputs(input);
  assert.equal(result.status,'Incomplete');
  assert.ok(result.missing.includes('fbaFulfillment'));
  assert.ok(result.missing.includes('packageFacts'));
});
