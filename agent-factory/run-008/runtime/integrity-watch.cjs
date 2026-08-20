const { stableStringify, sha256 } = require('./runtime.cjs');
const { normalizeDecision } = require('./decision-notification.cjs');

const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

function readPath(object, path) {
  return String(path).split('.').reduce((value, key) => {
    if (value === null || value === undefined || typeof value !== 'object') return undefined;
    return value[key];
  }, object);
}

function reconcileState({
  subjectId,
  canonical,
  observed,
  compareFields,
  observedAt,
  asOf = new Date().toISOString(),
  maxObservationAgeSeconds = 3600
} = {}) {
  const errors = [];
  if (!subjectId || typeof subjectId !== 'string') errors.push('MISSING_SUBJECT_ID');
  if (!canonical || typeof canonical !== 'object' || Array.isArray(canonical)) errors.push('INVALID_CANONICAL_STATE');
  if (!observed || typeof observed !== 'object' || Array.isArray(observed)) errors.push('INVALID_OBSERVED_STATE');
  if (!Array.isArray(compareFields) || compareFields.length === 0 || compareFields.some((field) => typeof field !== 'string' || !field)) errors.push('INVALID_COMPARE_FIELDS');
  if (!ISO_DATE_TIME.test(observedAt || '') || Number.isNaN(Date.parse(observedAt))) errors.push('INVALID_OBSERVED_AT');
  if (!ISO_DATE_TIME.test(asOf || '') || Number.isNaN(Date.parse(asOf))) errors.push('INVALID_AS_OF');
  if (!Number.isFinite(maxObservationAgeSeconds) || maxObservationAgeSeconds <= 0) errors.push('INVALID_MAX_OBSERVATION_AGE');

  if (errors.length) {
    return {
      status: 'UNKNOWN',
      failClosed: true,
      reasons: errors,
      differences: [],
      evidenceHash: null
    };
  }

  const ageSeconds = Math.max(0, (Date.parse(asOf) - Date.parse(observedAt)) / 1000);
  const evidenceHash = `sha256:${sha256(stableStringify({ subjectId, canonical, observed, compareFields, observedAt }))}`;
  if (ageSeconds > maxObservationAgeSeconds) {
    return {
      status: 'UNKNOWN',
      failClosed: true,
      reasons: ['OBSERVATION_STALE'],
      differences: [],
      ageSeconds,
      evidenceHash
    };
  }

  const differences = [];
  for (const field of compareFields) {
    const expected = readPath(canonical, field);
    const actual = readPath(observed, field);
    if (expected === undefined) {
      return {
        status: 'UNKNOWN',
        failClosed: true,
        reasons: [`CANONICAL_FIELD_MISSING:${field}`],
        differences: [],
        ageSeconds,
        evidenceHash
      };
    }
    if (actual === undefined) {
      return {
        status: 'UNKNOWN',
        failClosed: true,
        reasons: [`OBSERVED_FIELD_MISSING:${field}`],
        differences: [],
        ageSeconds,
        evidenceHash
      };
    }
    if (stableStringify(expected) !== stableStringify(actual)) {
      differences.push({ field, expected, observed: actual });
    }
  }

  return {
    status: differences.length ? 'DRIFT' : 'IN_SYNC',
    failClosed: differences.length > 0,
    reasons: differences.length ? ['CANONICAL_LIVE_STATE_MISMATCH'] : [],
    differences,
    ageSeconds,
    evidenceHash
  };
}

function reconciliationToDecision({ subjectId, result, producerId = 'OPS-CORE-008', naturalKey = '' } = {}) {
  if (!result || result.status === 'IN_SYNC') return null;
  const unknown = result.status === 'UNKNOWN';
  const detail = unknown
    ? result.reasons.join(', ')
    : result.differences.map((d) => `${d.field}: expected=${JSON.stringify(d.expected)} observed=${JSON.stringify(d.observed)}`).join('; ');

  return normalizeDecision({
    producerId,
    subjectId,
    decisionType: unknown ? 'LIVE_STATE_UNKNOWN' : 'LIVE_STATE_DRIFT',
    naturalKey: naturalKey || result.evidenceHash || detail,
    subject: unknown ? `${subjectId} live state could not be verified` : `${subjectId} canonical state differs from live state`,
    reason: unknown ? `Fail-closed reconciliation: ${detail}` : `Detected canonical/live-state drift: ${detail}`,
    recommendation: 'Review the evidence and reconcile the canonical record or live system. Do not auto-repair unknown state.',
    authorityRequired: 'OWNER_APPROVAL',
    severity: unknown ? 'URGENT' : 'ATTENTION',
    status: 'OPEN',
    estimatedCostCents: 0,
    evidenceRefs: result.evidenceHash ? [result.evidenceHash] : []
  });
}

module.exports = { reconcileState, reconciliationToDecision };
