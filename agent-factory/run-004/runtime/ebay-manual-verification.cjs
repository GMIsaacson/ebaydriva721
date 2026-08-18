'use strict';

const { assertSourceAccess } = require('./source-access.cjs');

const ALLOWED_METHODS = Object.freeze(new Set([
  'ebay_product_research_manual',
  'ebay_manual_completed_listing',
]));

const DEFAULT_MAX_AGE_HOURS = 72;

function integerOrNull(value, field, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) throw new Error(`${field} must be an integer from ${min} to ${max}`);
  return parsed;
}

function nonEmpty(value, field) {
  const text = String(value ?? '').trim();
  if (!text) throw new Error(`${field} is required`);
  return text;
}

function decision(status, reason, candidate, verification, accessDecision, extras = {}) {
  return Object.freeze({
    schemaVersion: '1.0.0',
    status,
    reason,
    candidateId: candidate?.candidateId || null,
    marketplace: 'ebay-us',
    verification,
    sourceAccess: accessDecision,
    marketplaceFetches: 0,
    machineFetches: 0,
    externalActions: 0,
    spendingCents: 0,
    ...extras,
  });
}

function normalizeVerification(candidate, raw) {
  if (!raw || typeof raw !== 'object') throw new Error('verification is required');
  if (!candidate || typeof candidate !== 'object') throw new Error('candidate is required');
  if (!candidate.candidateId) throw new Error('candidateId is missing from candidate');

  const candidateId = nonEmpty(raw.candidateId, 'candidateId');
  if (candidateId !== candidate.candidateId) throw new Error('verification candidateId does not match candidate');

  const marketplace = nonEmpty(raw.marketplace, 'marketplace').toLowerCase();
  if (marketplace !== 'ebay-us') throw new Error('marketplace must be ebay-us');

  const method = nonEmpty(raw.method, 'method');
  if (!ALLOWED_METHODS.has(method)) throw new Error('unsupported manual verification method');

  const verifiedBy = nonEmpty(raw.verifiedBy, 'verifiedBy');
  const verifiedAt = nonEmpty(raw.verifiedAt, 'verifiedAt');
  if (!Number.isFinite(Date.parse(verifiedAt))) throw new Error('verifiedAt must be a valid ISO date-time');
  const evidenceRef = nonEmpty(raw.evidenceRef, 'evidenceRef');

  if (typeof raw.exactIdentityConfirmed !== 'boolean') throw new Error('exactIdentityConfirmed must be boolean');
  const observationPeriodDays = integerOrNull(raw.observationPeriodDays, 'observationPeriodDays', { min: 1, max: 1095 });
  if (observationPeriodDays === null) throw new Error('observationPeriodDays is required');
  const unitsSold = integerOrNull(raw.unitsSold, 'unitsSold', { min: 0 });
  if (unitsSold === null) throw new Error('unitsSold is required');
  const avgSoldPriceCents = integerOrNull(raw.avgSoldPriceCents, 'avgSoldPriceCents', { min: 0 });
  const activeListings = integerOrNull(raw.activeListings, 'activeListings', { min: 0 });
  const sellThroughBps = integerOrNull(raw.sellThroughBps, 'sellThroughBps', { min: 0, max: 10000 });
  const avgShippingCents = integerOrNull(raw.avgShippingCents, 'avgShippingCents', { min: 0 });

  if (raw.acceptedOfferPricesIncluded !== undefined && raw.acceptedOfferPricesIncluded !== null && typeof raw.acceptedOfferPricesIncluded !== 'boolean') {
    throw new Error('acceptedOfferPricesIncluded must be boolean or null');
  }

  return Object.freeze({
    schemaVersion: '1.0.0',
    candidateId,
    marketplace: 'ebay-us',
    method,
    verifiedBy,
    verifiedAt,
    evidenceRef,
    searchQuery: raw.searchQuery === undefined || raw.searchQuery === null ? null : String(raw.searchQuery).trim() || null,
    exactIdentityConfirmed: raw.exactIdentityConfirmed,
    observationPeriodDays,
    unitsSold,
    avgSoldPriceCents,
    activeListings,
    sellThroughBps,
    avgShippingCents,
    acceptedOfferPricesIncluded: raw.acceptedOfferPricesIncluded ?? null,
  });
}

function validateManualEbayVerification({
  registry,
  candidate,
  verification: rawVerification,
  at = new Date().toISOString(),
  maxAgeHours = DEFAULT_MAX_AGE_HOURS,
} = {}) {
  if (!Number.isFinite(Date.parse(at))) throw new Error('evaluation time must be valid ISO date-time');
  if (!Number.isFinite(maxAgeHours) || maxAgeHours <= 0 || maxAgeHours > 168) throw new Error('maxAgeHours must be greater than 0 and no more than 168');

  const accessDecision = assertSourceAccess({
    registry,
    sourceId: 'ebay-manual-verification',
    accessMode: 'manual_verification',
    automated: false,
    at,
  });
  const verification = normalizeVerification(candidate, rawVerification);

  const ageHours = (Date.parse(at) - Date.parse(verification.verifiedAt)) / 3600000;
  if (ageHours < 0) return decision('REVIEW', 'verification timestamp is in the future', candidate, verification, accessDecision, { ageHours });
  if (ageHours > maxAgeHours) return decision('REVIEW', 'marketplace verification is stale', candidate, verification, accessDecision, { ageHours });
  if (!verification.exactIdentityConfirmed) return decision('REVIEW', 'exact marketplace identity was not confirmed', candidate, verification, accessDecision, { ageHours });
  if (verification.unitsSold === 0) return decision('REJECT', 'no sold evidence observed in the selected period', candidate, verification, accessDecision, { ageHours });
  if (verification.avgSoldPriceCents === null || verification.avgSoldPriceCents <= 0) {
    return decision('INCOMPLETE', 'average sold price is required when sold units are present', candidate, verification, accessDecision, { ageHours });
  }

  const soldPer30Days = Math.round((verification.unitsSold / verification.observationPeriodDays) * 30 * 100) / 100;
  return decision('VERIFIED', 'current manual eBay evidence accepted for deterministic economics', candidate, verification, accessDecision, {
    ageHours,
    soldPer30Days,
  });
}

module.exports = {
  ALLOWED_METHODS,
  DEFAULT_MAX_AGE_HOURS,
  normalizeVerification,
  validateManualEbayVerification,
};
