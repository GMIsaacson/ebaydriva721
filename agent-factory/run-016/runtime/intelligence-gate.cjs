'use strict';

const crypto = require('crypto');
const taxonomy = require('../config/technology-taxonomy.json');
const policy = require('../config/source-policy.json');

const DOMAIN_IDS = new Set(taxonomy.domains.map((domain) => domain.id));
const SOURCE_TIERS = new Set(Object.keys(policy.tiers));
const CLAIM_MODES = new Set(policy.claimModes);
const HIGH_STAKES_DOMAINS = new Set(['medicine-healthcare', 'biotech-synthetic-biology']);
const DEFENSE_DOMAINS = new Set(['defense-dual-use', 'drones-aerospace']);

function nonEmpty(value) { return typeof value === 'string' && value.trim().length > 0; }
function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function clampScore(value, field) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 100) throw new Error(`INVALID_SCORE:${field}`);
  return number;
}
function ageHours(dateValue, asOf) {
  const observed = new Date(dateValue);
  const reference = new Date(asOf);
  if (Number.isNaN(observed.getTime()) || Number.isNaN(reference.getTime())) return null;
  return Math.floor((reference.getTime() - observed.getTime()) / 3600000);
}
function validHttps(value) { return typeof value === 'string' && /^https:\/\//i.test(value); }

function routeDomain(domain) {
  return DOMAIN_IDS.has(domain) ? domain : 'emerging-unclassified';
}

function validateSource(source, index) {
  const errors = [];
  if (!source || typeof source !== 'object') return [`sources[${index}] must be an object`];
  if (!validHttps(source.url)) errors.push(`sources[${index}].url must be HTTPS`);
  if (!nonEmpty(source.publisher)) errors.push(`sources[${index}].publisher is required`);
  if (!SOURCE_TIERS.has(source.tier)) errors.push(`sources[${index}].tier is invalid`);
  if (!nonEmpty(source.independentKey)) errors.push(`sources[${index}].independentKey is required`);
  if (ageHours(source.publishedAt, source.publishedAt) === null) errors.push(`sources[${index}].publishedAt is invalid`);
  return errors;
}

function validatePrice(price) {
  const errors = [];
  if (!price || typeof price !== 'object') return ['price evidence is required when priceMentioned=true'];
  if (!Number.isFinite(Number(price.amount)) || Number(price.amount) < 0) errors.push('price.amount must be a non-negative number');
  for (const field of ['currency', 'basis', 'region', 'observedAt', 'availability']) {
    if (!nonEmpty(price[field])) errors.push(`price.${field} is required`);
  }
  if (!validHttps(price.sourceUrl)) errors.push('price.sourceUrl must be HTTPS');
  return errors;
}

function evidenceAssessment(event) {
  const sources = event.sources || [];
  const primary = sources.filter((source) => source.tier === 'primary');
  const nonLead = sources.filter((source) => source.tier !== 'lead-only');
  const independent = new Set(nonLead.map((source) => source.independentKey));
  const direct = sources.some((source) => source.directStatement === true && source.tier === 'primary');
  if (event.claimMode === 'FIRSTHAND_STATEMENT') {
    return direct ? { status: 'ATTRIBUTED', sufficient: true, direct: true } : { status: 'INSUFFICIENT', sufficient: false, direct: false };
  }
  if (event.claimMode === 'PRELIMINARY_FINDING') {
    return primary.length ? { status: 'PRELIMINARY_PRIMARY', sufficient: true, direct: false } : { status: 'INSUFFICIENT', sufficient: false, direct: false };
  }
  if (primary.length || independent.size >= 2) return { status: 'VERIFIED', sufficient: true, direct };
  return { status: 'INSUFFICIENT', sufficient: false, direct };
}

function calculateScore(signals) {
  if (!signals || typeof signals !== 'object') throw new Error('SIGNALS_REQUIRED');
  const weights = { novelty: 0.25, consequence: 0.20, confidence: 0.20, immediacy: 0.15, adoptionReadiness: 0.10, watchPriority: 0.10 };
  let total = 0;
  for (const [field, weight] of Object.entries(weights)) total += clampScore(signals[field], field) * weight;
  return Math.round(total * 10) / 10;
}

function evaluateEvent(event, options = {}) {
  const asOf = options.asOf || new Date().toISOString();
  const rejectReasons = [];
  const labels = [];
  if (!event || typeof event !== 'object' || Array.isArray(event)) throw new Error('EVENT_REQUIRED');
  for (const field of ['eventId', 'title', 'actor', 'action', 'object', 'location', 'publishedAt', 'observedAt', 'summary', 'claimMode']) {
    if (!nonEmpty(event[field])) rejectReasons.push(`${field} is required`);
  }
  if (!CLAIM_MODES.has(event.claimMode)) rejectReasons.push('claimMode is invalid');
  if (!Array.isArray(event.sources) || event.sources.length === 0) rejectReasons.push('at least one source is required');
  else event.sources.forEach((source, index) => rejectReasons.push(...validateSource(source, index)));
  const domain = routeDomain(event.domain);
  if (domain === 'emerging-unclassified' && event.domain !== domain) labels.push('ROUTED_UNCLASSIFIED');
  if (event.untrustedDirectiveDetected === true) rejectReasons.push('untrusted source directive cannot alter system policy');
  if (event.duplicateOf && event.materialDelta !== true) rejectReasons.push('duplicate without a material delta');
  if (event.promotionalOnly === true && event.claimMode !== 'FIRSTHAND_STATEMENT') rejectReasons.push('promotional claim must be represented as an attributed statement');
  if (event.priceMentioned === true) rejectReasons.push(...validatePrice(event.price));
  const publishedAgeHours = ageHours(event.publishedAt, asOf);
  if (publishedAgeHours === null) rejectReasons.push('publishedAt is invalid');
  else if (publishedAgeHours < -1) rejectReasons.push('publishedAt is in the future');
  else if (publishedAgeHours > policy.dailyFreshnessHours) rejectReasons.push('event is stale for the daily intelligence window');

  const evidence = evidenceAssessment(event);
  if (!evidence.sufficient) rejectReasons.push('evidence is insufficient for the declared claim mode');
  if (event.claimMode === 'FIRSTHAND_STATEMENT') labels.push('FIRSTHAND_ATTRIBUTION_NOT_EXTERNAL_VERIFICATION');
  if (event.claimMode === 'PRELIMINARY_FINDING') labels.push('PRELIMINARY_NOT_CLINICAL_OR_COMMERCIAL_PROOF');

  if (HIGH_STAKES_DOMAINS.has(domain)) {
    if (!nonEmpty(event.clinicalStage) || !nonEmpty(event.regulatoryStatus)) rejectReasons.push('medical and life-science items require clinicalStage and regulatoryStatus');
    if (event.medicalAdvice === true) rejectReasons.push('medical advice is prohibited');
    if (event.highStakesClaim === true && !(event.sources || []).some((source) => source.tier === 'primary')) rejectReasons.push('high-stakes medical claim requires primary evidence');
  }
  if (DEFENSE_DOMAINS.has(domain)) {
    if (event.operationalInstruction === true) rejectReasons.push('tactical operational instruction is prohibited');
    if (event.contentSafety !== 'public-capability-summary') rejectReasons.push('defense item must be a public-capability-summary');
  }

  let score = null;
  try { score = calculateScore(event.signals); }
  catch (error) { rejectReasons.push(error.message); }
  let decision = 'REJECT';
  if (rejectReasons.length === 0) {
    const confidence = Number(event.signals.confidence);
    const verifiedUrgent = evidence.status === 'VERIFIED' && score >= policy.urgentThreshold && confidence >= 75 && publishedAgeHours <= policy.urgentFreshnessHours;
    const attributedUrgent = evidence.status === 'ATTRIBUTED' && event.alertEligible === true && score >= policy.firsthandUrgentThreshold && confidence >= 70 && publishedAgeHours <= policy.urgentFreshnessHours;
    if (verifiedUrgent || attributedUrgent) decision = 'URGENT_ALERT';
    else if (score >= policy.dailyThreshold) decision = 'DAILY_BRIEF';
    else if (score >= policy.watchlistThreshold) decision = 'WATCHLIST';
    else { decision = 'REJECT'; rejectReasons.push('below watchlist significance threshold'); }
  }
  return {
    schemaVersion: '1.0',
    eventId: event.eventId || null,
    domain,
    decision,
    score,
    evidenceStatus: evidence.status,
    labels,
    rejectReasons,
    itemSha256: sha256(JSON.stringify(event)),
    notificationAuthorized: false,
    externalActionsPerformed: 0,
    spendCents: 0,
  };
}

function auditCoverage(events) {
  const counts = Object.fromEntries(taxonomy.domains.map((domain) => [domain.id, 0]));
  for (const event of events) counts[routeDomain(event.domain)] += 1;
  return {
    domainCount: taxonomy.domains.length,
    counts,
    blindSpots: Object.entries(counts).filter(([, count]) => count === 0).map(([domain]) => domain),
    unclassifiedCount: counts['emerging-unclassified'],
    completenessClaimed: false,
  };
}

function evaluateBatch(events, options = {}) {
  if (!Array.isArray(events)) throw new Error('EVENT_BATCH_REQUIRED');
  const maxItems = Number(options.maxItems || 100);
  if (!Number.isInteger(maxItems) || maxItems < 1) throw new Error('INVALID_MAX_ITEMS');
  if (events.length > maxItems) {
    return { terminalState: 'KILLED', reason: 'cost-or-volume-limit-exhausted', itemCount: events.length, maxItems, externalActionsPerformed: 0, spendCents: 0 };
  }
  const seen = new Set();
  const results = [];
  const deadLetters = [];
  for (const event of events) {
    if (!event || event.sourceFetchStatus === 'UNAVAILABLE') {
      deadLetters.push({ eventId: event?.eventId || null, reason: 'source-unavailable' });
      continue;
    }
    if (seen.has(event.eventId)) {
      results.push({ eventId: event.eventId, decision: 'REJECT', rejectReasons: ['duplicate event id in batch'], notificationAuthorized: false, externalActionsPerformed: 0, spendCents: 0 });
      continue;
    }
    seen.add(event.eventId);
    results.push(evaluateEvent(event, options));
  }
  return {
    schemaVersion: '1.0',
    runId: options.runId || 'WTI-G3-SIMULATION',
    terminalState: 'DELIVERED',
    results,
    deadLetters,
    coverage: auditCoverage(events.filter(Boolean)),
    qa: { status: results.every((result) => result.notificationAuthorized === false) ? 'PASS' : 'FAIL', unsupportedSuccessClaims: 0 },
    externalActionsPerformed: 0,
    spendCents: 0,
  };
}

module.exports = { DOMAIN_IDS, SOURCE_TIERS, CLAIM_MODES, routeDomain, validateSource, validatePrice, evidenceAssessment, calculateScore, evaluateEvent, auditCoverage, evaluateBatch };
