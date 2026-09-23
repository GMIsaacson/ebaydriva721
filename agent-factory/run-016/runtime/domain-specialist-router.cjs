'use strict';

const routing = require('../config/domain-specialist-routing.json');
const taxonomy = require('../config/technology-taxonomy.json');

const KNOWN_DOMAINS = new Set(taxonomy.domains.map((d) => d.id));
const SPECIALIST_BY_DOMAIN = new Map();
for (const pool of routing.specialistPools) {
  for (const domain of pool.domains || []) SPECIALIST_BY_DOMAIN.set(domain, pool.id);
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function normalizeDomains(input) {
  const raw = Array.isArray(input) ? input : [input];
  const normalized = unique(raw.map((value) => String(value || '').trim()).filter(Boolean));
  if (normalized.length === 0) return ['emerging-unclassified'];
  return normalized.map((domain) => KNOWN_DOMAINS.has(domain) ? domain : 'emerging-unclassified');
}

function requiredReviewers(domains, options = {}) {
  const reviewers = ['wti-technical-evidence-reviewer'];
  if (domains.some((d) => d === 'medicine-healthcare' || d === 'biotech-synthetic-biology')) reviewers.push('wti-clinical-evidence-reviewer');
  if (domains.some((d) => d === 'defense-dual-use' || d === 'drones-aerospace')) reviewers.push('wti-defense-evidence-reviewer');
  if (options.priceMentioned === true) reviewers.push('wti-price-availability-reviewer');
  return unique(reviewers);
}

function routeSpecialists(event) {
  if (!event || typeof event !== 'object' || Array.isArray(event)) throw new Error('EVENT_REQUIRED');
  const domains = normalizeDomains(event.domains || event.domain);
  const specialistPools = unique(domains.map((domain) => SPECIALIST_BY_DOMAIN.get(domain)));
  const unresolvedDomains = domains.filter((domain) => !SPECIALIST_BY_DOMAIN.has(domain));
  const reviewers = requiredReviewers(domains, event);
  const emerging = domains.includes('emerging-unclassified');

  const blockers = [];
  if (specialistPools.length === 0) blockers.push('NO_SPECIALIST_ROUTED');
  if (unresolvedDomains.length) blockers.push(`UNRESOLVED_DOMAIN:${unresolvedDomains.join('|')}`);
  if (emerging && event.deepDomainInterpretationClaimed === true) blockers.push('EMERGING_DOMAIN_CANNOT_SELF_CERTIFY_EXPERTISE');
  if (event.generalAnalystUsedAsSpecialist === true) blockers.push('GENERAL_ANALYST_CANNOT_COUNT_AS_SPECIALIST');

  return {
    schemaVersion: '1.0',
    eventId: event.eventId || null,
    domains,
    specialistPools,
    independentReviewPools: reviewers,
    crossDomain: domains.length > 1,
    status: blockers.length === 0 ? 'ROUTED' : 'BLOCKED',
    blockers,
    externalActionsPerformed: 0,
    spendCents: 0,
  };
}

function validateExecutionEvidence(route, executionEvidence) {
  const blockers = [];
  if (!route || route.status !== 'ROUTED') blockers.push('ROUTE_NOT_READY');
  if (!executionEvidence || typeof executionEvidence !== 'object') return { status: 'BLOCKED', blockers: [...blockers, 'EXECUTION_EVIDENCE_MISSING'] };

  const specialists = new Set(executionEvidence.specialistPoolsExecuted || []);
  const reviewers = new Set(executionEvidence.reviewPoolsExecuted || []);

  for (const id of route.specialistPools || []) if (!specialists.has(id)) blockers.push(`SPECIALIST_NOT_EXECUTED:${id}`);
  for (const id of route.independentReviewPools || []) if (!reviewers.has(id)) blockers.push(`REVIEW_NOT_EXECUTED:${id}`);

  if (executionEvidence.generalAnalystOnly === true) blockers.push('GENERAL_ANALYST_ONLY_EXECUTION');
  if (executionEvidence.independentReview === false) blockers.push('INDEPENDENT_REVIEW_NOT_PROVEN');
  if (Number(executionEvidence.externalActionsPerformed || 0) !== 0) blockers.push('EXTERNAL_ACTION_OCCURRED');
  if (Number(executionEvidence.spendCents || 0) !== 0) blockers.push('SPEND_OCCURRED');

  return { status: blockers.length === 0 ? 'PASS' : 'BLOCKED', blockers };
}

function evaluateShadowCase(shadowCase) {
  const route = routeSpecialists(shadowCase.event);
  const execution = validateExecutionEvidence(route, shadowCase.executionEvidence);
  return {
    caseId: shadowCase.caseId || shadowCase.event?.eventId || null,
    route,
    execution,
    status: route.status === 'ROUTED' && execution.status === 'PASS' ? 'PASS' : 'BLOCKED',
  };
}

function evaluateShadowBatch(cases) {
  if (!Array.isArray(cases) || cases.length === 0) throw new Error('SHADOW_CASES_REQUIRED');
  const results = cases.map(evaluateShadowCase);
  const blocked = results.filter((r) => r.status !== 'PASS');
  return {
    schemaVersion: '1.0',
    gate: 'G4_SPECIALIST_ROUTING_SHADOW',
    status: blocked.length === 0 ? 'PASS' : 'BLOCKED',
    caseCount: results.length,
    passedCaseCount: results.length - blocked.length,
    blockedCaseCount: blocked.length,
    results,
    externalActionsPerformed: 0,
    spendCents: 0,
  };
}

module.exports = { normalizeDomains, requiredReviewers, routeSpecialists, validateExecutionEvidence, evaluateShadowCase, evaluateShadowBatch };
