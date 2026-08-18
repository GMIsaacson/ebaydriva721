'use strict';

const PRECHECK_VERSION = 'datascout-public-web-precheck/1.0.0';

function normalizeText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function unique(values) {
  return [...new Set(values.filter(Boolean).map(normalizeText).filter(Boolean))];
}

function buildPublicWebQueries(candidate) {
  if (!candidate || typeof candidate !== 'object') throw new Error('candidate is required');
  const queries = [];
  if (candidate.upc) queries.push(`"${candidate.upc}"`);
  if (candidate.brand && candidate.mpn) queries.push(`"${candidate.brand}" "${candidate.mpn}"`);
  else if (candidate.mpn) queries.push(`"${candidate.mpn}"`);
  if (candidate.title) queries.push(`"${candidate.title}"`);
  return unique(queries).slice(0, 3);
}

function domainFromUrl(url) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
}

function validateEvidenceItem(item, candidateId) {
  if (!item || typeof item !== 'object') return null;
  if (item.candidateId && item.candidateId !== candidateId) return null;
  if (item.exactIdentityConfirmed !== true) return null;
  if (item.packQuantityConfirmed !== true) return null;
  if (!Number.isSafeInteger(item.observedPriceCents) || item.observedPriceCents <= 0) return null;
  if (!item.url || !domainFromUrl(item.url)) return null;
  if (!item.observedAt || !Number.isFinite(Date.parse(item.observedAt))) return null;
  return Object.freeze({
    candidateId,
    observedPriceCents: item.observedPriceCents,
    url: item.url,
    domain: domainFromUrl(item.url),
    title: normalizeText(item.title),
    evidenceText: normalizeText(item.evidenceText),
    exactIdentityConfirmed: true,
    packQuantityConfirmed: true,
    observedAt: item.observedAt,
  });
}

function corroboratedEvidence(items) {
  const byDomain = new Map();
  for (const item of items) {
    const previous = byDomain.get(item.domain);
    if (!previous || item.observedPriceCents < previous.observedPriceCents) byDomain.set(item.domain, item);
  }
  return [...byDomain.values()].sort((a, b) => a.observedPriceCents - b.observedPriceCents || a.domain.localeCompare(b.domain));
}

function priceAgreement(items, toleranceBps = 2500) {
  if (items.length < 2) return false;
  const prices = items.map((item) => item.observedPriceCents).sort((a, b) => a - b);
  const low = prices[0];
  const high = prices[prices.length - 1];
  if (low <= 0) return false;
  return Math.round(((high - low) * 10000) / low) <= toleranceBps;
}

function assessPublicWebCompetitivePrice({
  candidate,
  evidence = [],
  minProfitCents = 1500,
  corroborationCount = 2,
  agreementToleranceBps = 2500,
} = {}) {
  if (!candidate || typeof candidate !== 'object') throw new Error('candidate is required');
  if (!candidate.candidateId) throw new Error('candidateId is required');
  if (!Number.isSafeInteger(candidate.unitCostCents) || candidate.unitCostCents < 0) throw new Error('candidate unitCostCents is invalid');
  if (!Number.isSafeInteger(minProfitCents) || minProfitCents < 0) throw new Error('minProfitCents must be a non-negative integer');
  if (!Number.isSafeInteger(corroborationCount) || corroborationCount < 2) throw new Error('corroborationCount must be at least 2');

  const valid = corroboratedEvidence(
    evidence.map((item) => validateEvidenceItem(item, candidate.candidateId)).filter(Boolean),
  );

  if (!valid.length) {
    return Object.freeze({
      schemaVersion: '1.0.0',
      precheckVersion: PRECHECK_VERSION,
      candidateId: candidate.candidateId,
      status: 'NO_EVIDENCE',
      action: 'KEEP_FOR_EBAY_VERIFY',
      reason: 'no corroborated exact-match public-web price evidence',
      evidenceCount: 0,
      independentDomains: 0,
      competitivePriceCents: null,
      grossSpreadCeilingCents: null,
      externalActions: 0,
      purchases: 0,
      listings: 0,
    });
  }

  const competitivePriceCents = valid[0].observedPriceCents;
  const grossSpreadCeilingCents = competitivePriceCents - candidate.unitCostCents;
  const enoughCorroboration = valid.length >= corroborationCount;
  const pricesAgree = priceAgreement(valid.slice(0, Math.max(corroborationCount, 2)), agreementToleranceBps);
  const mathematicallyImpossible = grossSpreadCeilingCents < minProfitCents;

  if (enoughCorroboration && pricesAgree && mathematicallyImpossible) {
    return Object.freeze({
      schemaVersion: '1.0.0',
      precheckVersion: PRECHECK_VERSION,
      candidateId: candidate.candidateId,
      status: 'GROSS_PROFIT_IMPOSSIBLE',
      action: 'DEFER_WEB_PRICE',
      reason: 'corroborated public-web price leaves less than the owner minimum profit even before marketplace fees, shipping, packaging, and risk reserve',
      evidenceCount: valid.length,
      independentDomains: valid.length,
      competitivePriceCents,
      grossSpreadCeilingCents,
      minProfitCents,
      evidence: valid,
      externalActions: 0,
      purchases: 0,
      listings: 0,
    });
  }

  const riskThresholdCents = minProfitCents + 1500;
  const status = grossSpreadCeilingCents < riskThresholdCents ? 'PRICE_RISK' : 'PLAUSIBLE';
  return Object.freeze({
    schemaVersion: '1.0.0',
    precheckVersion: PRECHECK_VERSION,
    candidateId: candidate.candidateId,
    status,
    action: 'KEEP_FOR_EBAY_VERIFY',
    reason: status === 'PRICE_RISK'
      ? 'public-web competitive price leaves a thin gross spread; keep for manual eBay verification but lower research priority'
      : 'public-web competitive price does not eliminate the candidate; marketplace demand and landed economics remain unverified',
    evidenceCount: valid.length,
    independentDomains: valid.length,
    competitivePriceCents,
    grossSpreadCeilingCents,
    minProfitCents,
    evidence: valid,
    externalActions: 0,
    purchases: 0,
    listings: 0,
  });
}

module.exports = {
  PRECHECK_VERSION,
  assessPublicWebCompetitivePrice,
  buildPublicWebQueries,
  domainFromUrl,
  priceAgreement,
};
