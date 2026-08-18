'use strict';

const DEFAULT_PRESCREEN_POLICY = Object.freeze({
  policyVersion: 'datascout-prescreen/1.0.0',
  marketplace: 'ebay-us',
  currency: 'USD',
  maxVerificationQueue: 50,
  maxSourceCostCents: 10000,
  maxInitialOutlayCents: 50000,
  excludedTerms: [],
});

function validatePolicy(policy) {
  const merged = { ...DEFAULT_PRESCREEN_POLICY, ...(policy || {}) };
  const errors = [];
  if (merged.marketplace !== 'ebay-us') errors.push('marketplace must remain ebay-us for MVP');
  if (merged.currency !== 'USD') errors.push('currency must remain USD for MVP');
  if (!Number.isSafeInteger(merged.maxVerificationQueue) || merged.maxVerificationQueue < 1 || merged.maxVerificationQueue > 100) {
    errors.push('maxVerificationQueue must be an integer from 1 to 100');
  }
  if (!Number.isSafeInteger(merged.maxSourceCostCents) || merged.maxSourceCostCents < 1) {
    errors.push('maxSourceCostCents must be a positive integer');
  }
  if (!Number.isSafeInteger(merged.maxInitialOutlayCents) || merged.maxInitialOutlayCents < 1) {
    errors.push('maxInitialOutlayCents must be a positive integer');
  }
  if (!Array.isArray(merged.excludedTerms) || merged.excludedTerms.some((term) => typeof term !== 'string')) {
    errors.push('excludedTerms must be an array of strings');
  }
  if (errors.length) {
    const error = new Error(`Invalid prescreen policy: ${errors.join('; ')}`);
    error.code = 'PRESCREEN_POLICY_INVALID';
    error.details = errors;
    throw error;
  }
  return Object.freeze({
    ...merged,
    excludedTerms: Object.freeze(merged.excludedTerms.map((term) => term.trim().toLowerCase()).filter(Boolean)),
  });
}

function containsExcludedTerm(record, excludedTerms) {
  if (!excludedTerms.length) return null;
  const haystack = [record.title, record.category, record.condition, record.brand]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return excludedTerms.find((term) => haystack.includes(term)) || null;
}

function scoreCandidate(record, policy) {
  let score = 0;
  const warnings = [];

  if (record.identityConfidence === 'HIGH') score += 35;
  else if (record.identityConfidence === 'MEDIUM') score += 25;
  else warnings.push('low identity confidence');

  if (record.weightOz) score += 10;
  else warnings.push('weight missing');

  const dimensionCount = [record.lengthIn, record.widthIn, record.heightIn].filter((value) => value !== null && value !== undefined).length;
  if (dimensionCount === 3) score += 15;
  else if (dimensionCount > 0) {
    score += 5;
    warnings.push('dimensions incomplete');
  } else warnings.push('dimensions missing');

  if (record.availableQuantity === null || record.availableQuantity === undefined) score += 5;
  else if (record.availableQuantity >= record.moq * 3) score += 15;
  else score += 10;

  const sourceCostHeadroom = Math.max(0, 1 - (record.unitCostCents / policy.maxSourceCostCents));
  score += Math.round(sourceCostHeadroom * 20);

  const initialOutlay = record.unitCostCents * record.moq;
  const outlayHeadroom = Math.max(0, 1 - (initialOutlay / policy.maxInitialOutlayCents));
  score += Math.round(outlayHeadroom * 10);

  if (record.sourceUrl) score += 5;
  else warnings.push('source URL missing');

  return { score: Math.min(100, score), warnings, initialOutlayCents: initialOutlay };
}

function evaluateCandidate(record, policy) {
  if (!record || typeof record !== 'object') return { disposition: 'REJECT', reason: 'record is invalid' };
  if (record.schemaVersion !== '1.0.0') return { disposition: 'REJECT', reason: 'unsupported intake schema' };
  if (record.currency !== policy.currency) return { disposition: 'REJECT', reason: `currency ${record.currency || 'unknown'} is outside the USD MVP` };
  if (!Number.isSafeInteger(record.unitCostCents) || record.unitCostCents < 0) return { disposition: 'REJECT', reason: 'source cost is invalid' };
  if (!Number.isSafeInteger(record.moq) || record.moq < 1) return { disposition: 'REJECT', reason: 'MOQ is invalid' };
  if (record.unitCostCents > policy.maxSourceCostCents) return { disposition: 'REJECT', reason: 'source cost exceeds owner cap' };

  const initialOutlayCents = record.unitCostCents * record.moq;
  if (!Number.isSafeInteger(initialOutlayCents) || initialOutlayCents > policy.maxInitialOutlayCents) {
    return { disposition: 'REJECT', reason: 'minimum-order outlay exceeds owner cap', initialOutlayCents };
  }
  if (record.availableQuantity !== null && record.availableQuantity !== undefined && record.availableQuantity < record.moq) {
    return { disposition: 'REJECT', reason: 'known available quantity is below MOQ', initialOutlayCents };
  }

  const excludedTerm = containsExcludedTerm(record, policy.excludedTerms);
  if (excludedTerm) return { disposition: 'REJECT', reason: `owner-excluded term matched: ${excludedTerm}`, initialOutlayCents };

  if (record.identityConfidence === 'LOW') {
    return { disposition: 'REVIEW', reason: 'identity is title-only; add UPC, MPN, or supplier SKU before marketplace verification', initialOutlayCents };
  }

  const scored = scoreCandidate(record, policy);
  return { disposition: 'ELIGIBLE', reason: 'source-side constraints passed', ...scored };
}

function prescreenCandidates(records, policyInput = {}) {
  if (!Array.isArray(records)) throw new Error('records must be an array');
  const policy = validatePolicy(policyInput);
  const rejected = [];
  const review = [];
  const eligible = [];

  for (const record of records) {
    const evaluation = evaluateCandidate(record, policy);
    const entry = Object.freeze({
      candidateId: record?.candidateId || null,
      title: record?.title || null,
      supplier: record?.supplier || null,
      productIdentityKey: record?.productIdentityKey || null,
      unitCostCents: record?.unitCostCents ?? null,
      moq: record?.moq ?? null,
      ...evaluation,
      record,
    });
    if (evaluation.disposition === 'REJECT') rejected.push(entry);
    else if (evaluation.disposition === 'REVIEW') review.push(entry);
    else eligible.push(entry);
  }

  eligible.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.initialOutlayCents !== b.initialOutlayCents) return a.initialOutlayCents - b.initialOutlayCents;
    return String(a.candidateId).localeCompare(String(b.candidateId));
  });

  const verificationQueue = eligible.slice(0, policy.maxVerificationQueue).map((entry, index) => Object.freeze({
    ...entry,
    disposition: 'VERIFY',
    verificationRank: index + 1,
    reason: 'selected for human eBay verification; marketplace demand is not yet known',
  }));
  const deferred = eligible.slice(policy.maxVerificationQueue).map((entry) => Object.freeze({
    ...entry,
    disposition: 'DEFER',
    reason: 'eligible but outside the bounded marketplace-verification queue',
  }));

  return Object.freeze({
    schemaVersion: '1.0.0',
    policy,
    inputCount: records.length,
    verificationCount: verificationQueue.length,
    deferredCount: deferred.length,
    reviewCount: review.length,
    rejectedCount: rejected.length,
    verificationQueue,
    deferred,
    review,
    rejected,
    externalActions: 0,
    marketplaceFetches: 0,
    machineFetches: 0,
    spendingCents: 0,
  });
}

module.exports = {
  DEFAULT_PRESCREEN_POLICY,
  evaluateCandidate,
  prescreenCandidates,
  scoreCandidate,
  validatePolicy,
};
