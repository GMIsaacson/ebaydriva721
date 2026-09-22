'use strict';

const { createHash } = require('node:crypto');
const feeSchedule = require('./amazon-us-referral-fees-2026-09-22.json');
const { calculateEconomics } = require('./economics.cjs');

const EVIDENCE_SCHEMA_VERSION = 'amazon-economics-evidence/1.0.0';
const MARKETPLACE = 'amazon-us';
const FULFILLMENT_MODES = new Set(['FBA', 'FBM']);
const SELLING_PLANS = new Set(['INDIVIDUAL', 'PROFESSIONAL']);
const EVIDENCE_STATES = new Set(['OBSERVED', 'QUOTED', 'MEASURED', 'POLICY', 'CALCULATED']);

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((out, key) => { out[key] = canonicalize(value[key]); return out; }, {});
  }
  return value;
}

function hashPacket(value) {
  return createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex');
}

function isHttpsUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch { return false; }
}

function validObservedAt(value) {
  if (typeof value !== 'string' || !value.trim()) return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed);
}

function validateEvidenceRef(ref, path, missing, invalid, options = {}) {
  if (!ref || typeof ref !== 'object') { missing.push(path); return false; }
  if (!EVIDENCE_STATES.has(ref.state)) invalid.push(path + '.state');
  if (!isHttpsUrl(ref.sourceUrl) && !(options.allowPolicy && ref.state === 'POLICY')) invalid.push(path + '.sourceUrl');
  if (!validObservedAt(ref.observedAt)) invalid.push(path + '.observedAt');
  if (typeof ref.claim !== 'string' || ref.claim.trim().length < 3) invalid.push(path + '.claim');
  if (ref.state === 'POLICY' && (typeof ref.policyVersion !== 'string' || ref.policyVersion.trim().length < 3)) invalid.push(path + '.policyVersion');
  return true;
}

function validateMoneyEvidence(entry, path, missing, invalid, options = {}) {
  if (!entry || typeof entry !== 'object') { missing.push(path); return null; }
  validateEvidenceRef(entry.evidence, path + '.evidence', missing, invalid, options);
  if (!Number.isSafeInteger(entry.amountCents) || entry.amountCents < 0) {
    invalid.push(path + '.amountCents');
    return null;
  }
  return entry.amountCents;
}

function evaluatePreFeeFastKill(packet) {
  const missing = [];
  const invalid = [];
  if (!packet || typeof packet !== 'object') {
    return { status:'UNRESOLVED', reason:'REQUIRED_EVIDENCE_UNRESOLVED', saleCents:null, sourcePlusInboundCents:null, preFeeSpreadCents:null };
  }
  const saleCents = validateMoneyEvidence(packet.sale, 'sale', missing, invalid);
  const sourceCostCents = validateMoneyEvidence(packet.sourceCost, 'sourceCost', missing, invalid);
  const inboundFreightCents = validateMoneyEvidence(packet.inboundFreight, 'inboundFreight', missing, invalid);
  const sourcePlusInboundCents = sourceCostCents === null || inboundFreightCents === null
    ? null
    : sourceCostCents + inboundFreightCents;
  if (missing.length || invalid.length || saleCents === null || sourcePlusInboundCents === null) {
    return { status:'UNRESOLVED', reason:'REQUIRED_EVIDENCE_UNRESOLVED', saleCents, sourcePlusInboundCents, preFeeSpreadCents:null };
  }
  const preFeeSpreadCents = saleCents - sourcePlusInboundCents;
  if (sourcePlusInboundCents >= saleCents) {
    return { status:'KILL', reason:'SOURCE_PLUS_INBOUND_GTE_REVENUE', saleCents, sourcePlusInboundCents, preFeeSpreadCents };
  }
  return { status:'CONTINUE', reason:'POSITIVE_PRE_FEE_SPREAD', saleCents, sourcePlusInboundCents, preFeeSpreadCents };
}

function calculateReferralFeeCents(totalPriceCents, feeCategory) {
  const row = feeSchedule.categories[feeCategory];
  if (!row) return null;
  if (!Number.isSafeInteger(totalPriceCents) || totalPriceCents <= 0) return null;
  return Math.max(Math.ceil(totalPriceCents * row.rateBps / 10000), row.minimumCents);
}

function resolveRiskReserve(riskReserve, revenueCents, missing, invalid) {
  if (!riskReserve || typeof riskReserve !== 'object') { missing.push('riskReserve'); return null; }
  validateEvidenceRef(riskReserve.evidence, 'riskReserve.evidence', missing, invalid, { allowPolicy:true });
  if (Number.isSafeInteger(riskReserve.amountCents) && riskReserve.amountCents >= 0) return riskReserve.amountCents;
  if (Number.isSafeInteger(riskReserve.rateBps) && riskReserve.rateBps >= 0 && riskReserve.rateBps <= 10000 && Number.isSafeInteger(revenueCents) && revenueCents > 0) {
    return Math.ceil(revenueCents * riskReserve.rateBps / 10000);
  }
  invalid.push('riskReserve.amountCents|rateBps');
  return null;
}

function validatePackageFacts(packageFacts, missing, invalid) {
  if (!packageFacts || typeof packageFacts !== 'object') { missing.push('packageFacts'); return false; }
  validateEvidenceRef(packageFacts.evidence, 'packageFacts.evidence', missing, invalid, { allowPolicy:false });
  const numeric = ['lengthIn','widthIn','heightIn','weightOz'];
  for (const field of numeric) {
    if (!Number.isFinite(packageFacts[field]) || packageFacts[field] <= 0) invalid.push('packageFacts.' + field);
  }
  return numeric.every((field) => Number.isFinite(packageFacts[field]) && packageFacts[field] > 0);
}

function buildAmazonEconomicsInputs(packet) {
  const missing = [];
  const invalid = [];
  if (!packet || typeof packet !== 'object') return { status:'Incomplete', schemaVersion:EVIDENCE_SCHEMA_VERSION, evidenceHash:hashPacket(packet), missing:['packet'], invalid:[], economicsInputs:null };
  if (packet.schemaVersion !== EVIDENCE_SCHEMA_VERSION) invalid.push('schemaVersion');
  if (packet.marketplace !== MARKETPLACE) invalid.push('marketplace');
  if (!/^[A-Z0-9]{10}$/.test(String(packet.asin || ''))) invalid.push('asin');

  const revenue = validateMoneyEvidence(packet.sale, 'sale', missing, invalid);
  const sourceCost = validateMoneyEvidence(packet.sourceCost, 'sourceCost', missing, invalid);
  const inbound = validateMoneyEvidence(packet.inboundFreight, 'inboundFreight', missing, invalid);
  const packaging = validateMoneyEvidence(packet.packaging, 'packaging', missing, invalid, { allowPolicy:true });
  const riskReserve = resolveRiskReserve(packet.riskReserve, revenue, missing, invalid);
  validatePackageFacts(packet.packageFacts, missing, invalid);

  if (!FULFILLMENT_MODES.has(packet.fulfillmentMode)) missing.push('fulfillmentMode');
  if (!SELLING_PLANS.has(packet.sellingPlan)) missing.push('sellingPlan');

  let marketplaceFees = null;
  let referralFeeCents = null;
  let sellingPlanPerItemCents = null;
  let otherMarketplaceFeesCents = null;
  const category = packet.feeCategory && packet.feeCategory.name;
  if (!category) missing.push('feeCategory.name');
  else if (!feeSchedule.categories[category]) invalid.push('feeCategory.name');
  if (packet.feeCategory) validateEvidenceRef(packet.feeCategory.evidence, 'feeCategory.evidence', missing, invalid);

  const referralBasis = packet.referralFeeBasis && packet.referralFeeBasis.amountCents;
  if (!Number.isSafeInteger(referralBasis) || referralBasis <= 0) missing.push('referralFeeBasis.amountCents');
  if (packet.referralFeeBasis) validateEvidenceRef(packet.referralFeeBasis.evidence, 'referralFeeBasis.evidence', missing, invalid);
  if (category && Number.isSafeInteger(referralBasis) && referralBasis > 0) referralFeeCents = calculateReferralFeeCents(referralBasis, category);

  if (SELLING_PLANS.has(packet.sellingPlan)) sellingPlanPerItemCents = packet.sellingPlan === 'INDIVIDUAL' ? 99 : 0;
  otherMarketplaceFeesCents = validateMoneyEvidence(packet.otherMarketplaceFees, 'otherMarketplaceFees', missing, invalid, { allowPolicy:true });
  if (referralFeeCents !== null && sellingPlanPerItemCents !== null && otherMarketplaceFeesCents !== null) {
    marketplaceFees = referralFeeCents + sellingPlanPerItemCents + otherMarketplaceFeesCents;
  }

  let outboundShipping = null;
  if (packet.fulfillmentMode === 'FBA') outboundShipping = validateMoneyEvidence(packet.fbaFulfillment, 'fbaFulfillment', missing, invalid);
  else if (packet.fulfillmentMode === 'FBM') outboundShipping = validateMoneyEvidence(packet.fbmOutboundShipping, 'fbmOutboundShipping', missing, invalid);

  const economicsInputs = {
    collectedRevenueCents: revenue,
    sourceCostCents: sourceCost,
    inboundFreightCents: inbound,
    marketplaceFeesCents: marketplaceFees,
    outboundShippingCents: outboundShipping,
    packagingCents: packaging,
    riskReserveCents: riskReserve,
  };
  const arithmetic = calculateEconomics(economicsInputs);
  const complete = missing.length === 0 && invalid.length === 0 && arithmetic.status === 'Complete';

  return {
    status: complete ? 'Complete' : 'Incomplete',
    schemaVersion: EVIDENCE_SCHEMA_VERSION,
    feeScheduleVersion: feeSchedule.scheduleVersion,
    feeScheduleSourceUrl: feeSchedule.sourceUrl,
    evidenceHash: hashPacket(packet),
    missing: [...new Set(missing)].sort(),
    invalid: [...new Set(invalid)].sort(),
    economicsInputs: complete ? economicsInputs : null,
    resolved: {
      referralFeeCents,
      sellingPlanPerItemCents,
      otherMarketplaceFeesCents,
      marketplaceFeesCents: marketplaceFees,
      outboundShippingCents: outboundShipping,
      riskReserveCents: riskReserve,
    },
    fixedCostsExcluded: packet.sellingPlan === 'PROFESSIONAL' ? ['Professional selling plan monthly subscription is not allocated per unit by this layer.'] : [],
    arithmetic,
  };
}

module.exports = {
  EVIDENCE_SCHEMA_VERSION,
  MARKETPLACE,
  feeSchedule,
  calculateReferralFeeCents,
  evaluatePreFeeFastKill,
  buildAmazonEconomicsInputs,
  hashPacket,
};
