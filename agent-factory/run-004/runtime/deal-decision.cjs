'use strict';

const { calculateEconomics } = require('./economics.cjs');

const DEFAULT_SHIPPING_MAX_AGE_HOURS = 72;

function requireSafeInteger(value, field, min = 0) {
  if (!Number.isSafeInteger(value) || value < min) throw new Error(`${field} must be a safe integer >= ${min}`);
  return value;
}

function requirePositiveNumber(value, field) {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${field} must be greater than 0`);
  return value;
}

function validateDecisionPolicy(policy) {
  if (!policy || typeof policy !== 'object') throw new Error('decisionPolicy is required');
  const normalized = {
    minBuyProfitCents: requireSafeInteger(policy.minBuyProfitCents, 'minBuyProfitCents', 1),
    minBuyRoiBps: requireSafeInteger(policy.minBuyRoiBps, 'minBuyRoiBps', 1),
    minBuyMarginBps: requireSafeInteger(policy.minBuyMarginBps, 'minBuyMarginBps', 1),
    minBuySoldPer30Days: requirePositiveNumber(policy.minBuySoldPer30Days, 'minBuySoldPer30Days'),
  };
  return Object.freeze(normalized);
}

function conservativeShippingQuote(shippingQuote, at, maxAgeHours = DEFAULT_SHIPPING_MAX_AGE_HOURS) {
  if (!shippingQuote || typeof shippingQuote !== 'object') {
    return { status: 'INCOMPLETE', reason: 'shipping quote is required' };
  }
  if (!Number.isFinite(Date.parse(at))) throw new Error('evaluation time must be valid ISO date-time');
  if (!Number.isFinite(maxAgeHours) || maxAgeHours <= 0 || maxAgeHours > 168) throw new Error('shipping maxAgeHours must be > 0 and <= 168');
  if (!Number.isFinite(Date.parse(shippingQuote.capturedAt))) return { status: 'INCOMPLETE', reason: 'shipping capturedAt is required and must be valid' };
  const evidenceRef = String(shippingQuote.evidenceRef || '').trim();
  if (!evidenceRef) return { status: 'INCOMPLETE', reason: 'shipping evidenceRef is required' };
  if (!Array.isArray(shippingQuote.quotesCents) || shippingQuote.quotesCents.length < 1) {
    return { status: 'INCOMPLETE', reason: 'at least one shipping quote is required' };
  }
  const quotes = shippingQuote.quotesCents.map((value, index) => requireSafeInteger(value, `shipping quote ${index + 1}`, 0));
  const ageHours = (Date.parse(at) - Date.parse(shippingQuote.capturedAt)) / 3600000;
  if (ageHours < 0) return { status: 'REVIEW', reason: 'shipping quote timestamp is in the future', ageHours };
  if (ageHours > maxAgeHours) return { status: 'REVIEW', reason: 'shipping quote is stale', ageHours };

  return Object.freeze({
    status: 'READY',
    strategy: 'CONSERVATIVE_MAX',
    outboundShippingCents: Math.max(...quotes),
    quotesCents: Object.freeze([...quotes]),
    evidenceRef,
    capturedAt: shippingQuote.capturedAt,
    ageHours,
  });
}

function buildDealDecision({
  candidate,
  marketplaceVerification,
  saleUnitQuantity,
  inboundFreightPerSaleCents,
  packagingCents,
  marketplaceFeeBps,
  marketplaceFixedFeeCents,
  feeEvidenceRef,
  riskReserveBps,
  shippingQuote,
  decisionPolicy,
  at = new Date().toISOString(),
  shippingMaxAgeHours = DEFAULT_SHIPPING_MAX_AGE_HOURS,
} = {}) {
  if (!candidate || typeof candidate !== 'object') throw new Error('candidate is required');
  if (!marketplaceVerification || marketplaceVerification.status !== 'VERIFIED') {
    return Object.freeze({
      status: 'BLOCKED',
      decision: null,
      reason: 'fresh verified marketplace evidence is required',
      candidateId: candidate.candidateId || null,
      externalActions: 0,
      spendingCents: 0,
    });
  }
  if (marketplaceVerification.candidateId !== candidate.candidateId) throw new Error('marketplace verification candidate does not match candidate');

  const policy = validateDecisionPolicy(decisionPolicy);
  const qty = requireSafeInteger(saleUnitQuantity, 'saleUnitQuantity', 1);
  const sourcePackQty = requireSafeInteger(candidate.packQuantity, 'candidate.packQuantity', 1);
  requireSafeInteger(candidate.unitCostCents, 'candidate.unitCostCents', 0);
  const allocatedSourceCostCents = Math.ceil((candidate.unitCostCents / sourcePackQty) * qty);

  const inbound = requireSafeInteger(inboundFreightPerSaleCents, 'inboundFreightPerSaleCents', 0);
  const packaging = requireSafeInteger(packagingCents, 'packagingCents', 0);
  const feeBps = requireSafeInteger(marketplaceFeeBps, 'marketplaceFeeBps', 0);
  if (feeBps > 10000) throw new Error('marketplaceFeeBps must be <= 10000');
  const fixedFee = requireSafeInteger(marketplaceFixedFeeCents, 'marketplaceFixedFeeCents', 0);
  const feeEvidence = String(feeEvidenceRef || '').trim();
  if (!feeEvidence) return Object.freeze({ status: 'INCOMPLETE', decision: null, reason: 'marketplace fee evidence is required', candidateId: candidate.candidateId, externalActions: 0, spendingCents: 0 });
  const reserveBps = requireSafeInteger(riskReserveBps, 'riskReserveBps', 0);
  if (reserveBps > 10000) throw new Error('riskReserveBps must be <= 10000');

  const shipping = conservativeShippingQuote(shippingQuote, at, shippingMaxAgeHours);
  if (shipping.status !== 'READY') {
    return Object.freeze({
      status: shipping.status,
      decision: null,
      reason: shipping.reason,
      candidateId: candidate.candidateId,
      shipping,
      externalActions: 0,
      spendingCents: 0,
    });
  }

  const verification = marketplaceVerification.verification;
  const itemSalePriceCents = requireSafeInteger(verification.avgSoldPriceCents, 'avgSoldPriceCents', 1);
  const buyerShippingCollectedCents = verification.avgShippingCents === null || verification.avgShippingCents === undefined
    ? 0
    : requireSafeInteger(verification.avgShippingCents, 'avgShippingCents', 0);
  const collectedRevenueCents = itemSalePriceCents + buyerShippingCollectedCents;
  const marketplaceFeesCents = Math.ceil((collectedRevenueCents * feeBps) / 10000) + fixedFee;
  const riskReserveCents = Math.ceil((collectedRevenueCents * reserveBps) / 10000);

  const economics = calculateEconomics({
    collectedRevenueCents,
    sourceCostCents: allocatedSourceCostCents,
    inboundFreightCents: inbound,
    marketplaceFeesCents,
    outboundShippingCents: shipping.outboundShippingCents,
    packagingCents: packaging,
    riskReserveCents,
  });
  if (economics.status !== 'Complete') {
    return Object.freeze({ status: 'INCOMPLETE', decision: null, reason: 'landed economics are incomplete', candidateId: candidate.candidateId, economics, externalActions: 0, spendingCents: 0 });
  }

  let decision;
  const reasons = [];
  if (economics.netProfitCents <= 0 || economics.roiBps === null || economics.roiBps <= 0) {
    decision = 'REJECT';
    reasons.push('non-positive landed profit/ROI');
  } else {
    const misses = [];
    if (economics.netProfitCents < policy.minBuyProfitCents) misses.push('profit below BUY target');
    if (economics.roiBps < policy.minBuyRoiBps) misses.push('ROI below BUY target');
    if (economics.marginBps < policy.minBuyMarginBps) misses.push('margin below BUY target');
    if (marketplaceVerification.soldPer30Days < policy.minBuySoldPer30Days) misses.push('30-day sold rate below BUY target');
    if (misses.length) {
      decision = 'WATCH';
      reasons.push(...misses);
    } else {
      decision = 'BUY';
      reasons.push('all owner BUY thresholds passed');
    }
  }

  return Object.freeze({
    schemaVersion: '1.0.0',
    status: 'COMPLETE',
    decision,
    reasons: Object.freeze(reasons),
    candidateId: candidate.candidateId,
    saleUnitQuantity: qty,
    sourcePackQuantity: sourcePackQty,
    allocatedSourceCostCents,
    itemSalePriceCents,
    buyerShippingCollectedCents,
    marketplaceFeeBps: feeBps,
    marketplaceFixedFeeCents: fixedFee,
    marketplaceFeeEvidenceRef: feeEvidence,
    riskReserveBps: reserveBps,
    shipping,
    economics,
    soldPer30Days: marketplaceVerification.soldPer30Days,
    decisionPolicy: policy,
    externalActions: 0,
    machineFetches: 0,
    marketplaceFetches: 0,
    spendingCents: 0,
  });
}

module.exports = {
  DEFAULT_SHIPPING_MAX_AGE_HOURS,
  buildDealDecision,
  conservativeShippingQuote,
  validateDecisionPolicy,
};
