'use strict';

const { calculateEconomics } = require('./economics.cjs');

const DISCOVERY_VERSION = 'datascout-product-discovery/1.0.0';
const DEFAULT_TARGET_MARGIN_BPS = 2000;

const HARD_RISK_TAGS = new Set([
  'counterfeit',
  'regulated-medical',
  'dental-instrument',
  'mouth-contact-health',
  'baby-sleep-safety',
  'electrical-heating',
  'hazardous',
  'weapon',
]);

function asInt(value) {
  return Number.isSafeInteger(value) ? value : null;
}

function cleanText(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

function stage1Screen(candidate = {}) {
  const soldCount = asInt(candidate.soldCount);
  const itemPriceCents = asInt(candidate.itemPriceCents);
  const preliminarySupplierUnitCostCents = asInt(candidate.preliminarySupplierUnitCostCents);
  const riskTags = Array.isArray(candidate.riskTags) ? candidate.riskTags.map(cleanText).filter(Boolean) : [];
  const hardRisks = riskTags.filter((tag) => HARD_RISK_TAGS.has(tag));
  const reasons = [];

  if (!cleanText(candidate.title)) return { version: DISCOVERY_VERSION, status: 'FAIL', reasons: ['missing product title'] };
  if (soldCount === null || soldCount < 0) return { version: DISCOVERY_VERSION, status: 'HOLD', reasons: ['sold count missing or invalid'] };
  if (itemPriceCents === null || itemPriceCents <= 0) return { version: DISCOVERY_VERSION, status: 'HOLD', reasons: ['item price missing or invalid'] };
  if (hardRisks.length) return { version: DISCOVERY_VERSION, status: 'FAIL', reasons: [`hard risk: ${hardRisks.join(', ')}`] };
  if (candidate.brandState === 'BRANDED_ONLY') return { version: DISCOVERY_VERSION, status: 'FAIL', reasons: ['demand is branded-only and cannot be transferred to generic supply'] };

  if (soldCount >= 100) reasons.push(`strong demand: ${soldCount} sold`);
  else if (soldCount >= 25) reasons.push(`moderate demand: ${soldCount} sold`);
  else reasons.push(`weak demand: ${soldCount} sold`);

  if (itemPriceCents >= 1000 && itemPriceCents <= 4000) reasons.push('preferred ASP band');
  else if (itemPriceCents < 1000 && candidate.bundleEligible === true) reasons.push('low ASP; bundle/buyer-paid shipping test required');
  else reasons.push('outside preferred ASP band');

  let sourceRatioBps = null;
  if (preliminarySupplierUnitCostCents !== null && preliminarySupplierUnitCostCents >= 0) {
    sourceRatioBps = Math.round((preliminarySupplierUnitCostCents / itemPriceCents) * 10_000);
    reasons.push(`preliminary source ratio ${sourceRatioBps} bps`);
    if (sourceRatioBps <= 2000) reasons.push('preferred <=20% source ratio');
    else if (sourceRatioBps <= 3500) reasons.push('source ratio above preference; allow Stage 2 economics to decide');
  }

  if (candidate.sizeClass === 'BULKY' || candidate.weightClass === 'HEAVY') reasons.push('freight-sensitive physical profile');
  if (candidate.ipRisk === 'HIGH' || candidate.complianceRisk === 'HIGH') return { version: DISCOVERY_VERSION, status: 'FAIL', reasons: [...reasons, 'high IP/compliance risk'] };

  const sourceRatioWorkable = sourceRatioBps === null || sourceRatioBps <= 3500;
  const physicalOk = candidate.sizeClass !== 'BULKY' && candidate.weightClass !== 'HEAVY';
  const riskOk = candidate.ipRisk !== 'MEDIUM_HIGH' && candidate.complianceRisk !== 'MEDIUM_HIGH';

  if (soldCount >= 100 && sourceRatioWorkable && physicalOk && riskOk) return { version: DISCOVERY_VERSION, status: 'PASS', reasons };
  if (soldCount >= 25 && sourceRatioWorkable && riskOk) return { version: DISCOVERY_VERSION, status: 'PASS', reasons };
  return { version: DISCOVERY_VERSION, status: 'HOLD', reasons };
}

function matchSupplier(fingerprint = {}, supplier = {}) {
  const requiredAttributes = Array.isArray(fingerprint.requiredAttributes) ? fingerprint.requiredAttributes : [];
  const productAttributes = supplier.attributes && typeof supplier.attributes === 'object' ? supplier.attributes : {};
  const missing = [];
  const mismatched = [];

  for (const key of requiredAttributes) {
    const expected = fingerprint.attributes?.[key];
    const actual = productAttributes[key];
    if (actual === undefined || actual === null || actual === '') missing.push(key);
    else if (String(actual).toLowerCase() !== String(expected).toLowerCase()) mismatched.push(key);
  }

  if (mismatched.length) return { version: DISCOVERY_VERSION, equivalence: 'NOT_EQUIVALENT', missing, mismatched };
  if (missing.length) return { version: DISCOVERY_VERSION, equivalence: 'PARTIAL', missing, mismatched };
  if (requiredAttributes.length === 0) return { version: DISCOVERY_VERSION, equivalence: 'PARTIAL', missing: ['requiredAttributes'], mismatched: [] };
  if (supplier.exactIdentityEvidence === true) return { version: DISCOVERY_VERSION, equivalence: 'EXACT', missing: [], mismatched: [] };
  return { version: DISCOVERY_VERSION, equivalence: 'HIGH_CONFIDENCE', missing: [], mismatched: [] };
}

function feeFromBps(cents, bps) {
  if (!Number.isSafeInteger(cents) || !Number.isSafeInteger(bps) || cents < 0 || bps < 0) return null;
  return Math.ceil((cents * bps) / 10_000);
}

function buildEconomicsScenario(input = {}) {
  const itemPriceCents = asInt(input.itemPriceCents);
  const buyerPaidShippingCents = asInt(input.buyerPaidShippingCents ?? 0);
  const quantity = asInt(input.quantity ?? 1);
  const supplierUnitCostCents = asInt(input.supplierUnitCostCents);
  const inboundFreightCents = asInt(input.inboundFreightCents);
  const outboundShippingCents = asInt(input.outboundShippingCents);
  const packagingCents = asInt(input.packagingCents);
  const ebayFeeBps = asInt(input.ebayFeeBps);
  const orderFeeCents = asInt(input.orderFeeCents ?? 0);
  const promotionBps = asInt(input.promotionBps ?? 0);
  const returnsBps = asInt(input.returnsBps ?? 0);
  const defectsBps = asInt(input.defectsBps ?? 0);

  const baseFields = [itemPriceCents, buyerPaidShippingCents, quantity, supplierUnitCostCents, inboundFreightCents, outboundShippingCents, packagingCents, ebayFeeBps, orderFeeCents, promotionBps, returnsBps, defectsBps];
  if (baseFields.some((value) => value === null) || quantity < 1) {
    return { version: DISCOVERY_VERSION, status: 'Incomplete', missingOrInvalid: true };
  }

  const collectedRevenueCents = itemPriceCents + buyerPaidShippingCents;
  const ebayFeeCents = feeFromBps(collectedRevenueCents, ebayFeeBps);
  const promotionFeeCents = feeFromBps(collectedRevenueCents, promotionBps);
  const returnsReserveCents = feeFromBps(itemPriceCents, returnsBps);
  const defectReserveCents = feeFromBps(itemPriceCents, defectsBps);
  const marketplaceFeesCents = ebayFeeCents + promotionFeeCents + orderFeeCents;
  const sourceCostCents = supplierUnitCostCents * quantity;
  const riskReserveCents = returnsReserveCents + defectReserveCents;

  const economics = calculateEconomics({
    collectedRevenueCents,
    sourceCostCents,
    inboundFreightCents,
    marketplaceFeesCents,
    outboundShippingCents,
    packagingCents,
    riskReserveCents,
  });

  return {
    version: DISCOVERY_VERSION,
    shippingModel: cleanText(input.shippingModel || 'unspecified'),
    quantity,
    itemPriceCents,
    buyerPaidShippingCents,
    ebayFeeCents,
    promotionFeeCents,
    orderFeeCents,
    returnsReserveCents,
    defectReserveCents,
    ...economics,
  };
}

function classifyFinalDecision({ stage1, equivalence, base, conservative, sourcingComplete = true, riskState = 'PASS', ownerBuyReview = false, targetMarginBps = DEFAULT_TARGET_MARGIN_BPS } = {}) {
  if (!stage1 || stage1.status === 'FAIL') return { version: DISCOVERY_VERSION, status: 'KILL', reason: 'Stage 1 failed' };
  if (stage1.status !== 'PASS') return { version: DISCOVERY_VERSION, status: 'HOLD', reason: 'Stage 1 unresolved' };
  if (equivalence === 'NOT_EQUIVALENT') return { version: DISCOVERY_VERSION, status: 'KILL', reason: 'supplier/product mismatch' };
  if (!['EXACT', 'HIGH_CONFIDENCE'].includes(equivalence)) return { version: DISCOVERY_VERSION, status: 'HOLD', reason: 'exact product equivalence unresolved' };
  if (riskState !== 'PASS') return { version: DISCOVERY_VERSION, status: 'HOLD', reason: 'risk/evidence review unresolved' };
  if (!sourcingComplete) return { version: DISCOVERY_VERSION, status: 'RFQ', reason: 'material supplier/freight input missing' };
  if (!base || !conservative || base.status !== 'Complete' || conservative.status !== 'Complete') return { version: DISCOVERY_VERSION, status: 'RFQ', reason: 'economics incomplete' };
  if (base.netProfitCents <= 0 || conservative.netProfitCents <= 0) return { version: DISCOVERY_VERSION, status: 'KILL', reason: 'negative stress-case economics' };
  if (conservative.marginBps < targetMarginBps) return { version: DISCOVERY_VERSION, status: 'KILL', reason: `conservative margin below ${targetMarginBps} bps target` };
  if (ownerBuyReview === true) return { version: DISCOVERY_VERSION, status: 'BUY', reason: 'complete economics passed; owner review flag present' };
  return { version: DISCOVERY_VERSION, status: 'STRONG PASS', reason: 'base and conservative economics pass target' };
}

module.exports = {
  DISCOVERY_VERSION,
  DEFAULT_TARGET_MARGIN_BPS,
  HARD_RISK_TAGS,
  stage1Screen,
  matchSupplier,
  buildEconomicsScenario,
  classifyFinalDecision,
};
