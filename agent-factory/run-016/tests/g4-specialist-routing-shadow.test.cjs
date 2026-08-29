'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { routeSpecialists, validateExecutionEvidence, evaluateShadowBatch } = require('../runtime/domain-specialist-router.cjs');

function executedFor(event) {
  const route = routeSpecialists(event);
  return {
    specialistPoolsExecuted: route.specialistPools,
    reviewPoolsExecuted: route.independentReviewPools,
    independentReview: true,
    externalActionsPerformed: 0,
    spendCents: 0,
  };
}

const cases = [
  { caseId: 'ai', event: { eventId: 'ai', domain: 'ai-software' } },
  { caseId: 'robotics', event: { eventId: 'robotics', domain: 'robotics-autonomy' } },
  { caseId: 'clinical', event: { eventId: 'clinical', domain: 'medicine-healthcare' } },
  { caseId: 'biotech', event: { eventId: 'biotech', domain: 'biotech-synthetic-biology' } },
  { caseId: 'defense', event: { eventId: 'defense', domains: ['defense-dual-use','drones-aerospace'] } },
  { caseId: 'price', event: { eventId: 'price', domain: 'computing-semiconductors', priceMentioned: true } },
  { caseId: 'cross', event: { eventId: 'cross', domains: ['ai-software','robotics-autonomy','computing-semiconductors'] } },
  { caseId: 'energy', event: { eventId: 'energy', domains: ['energy-storage','climate-environment'] } },
  { caseId: 'cyber-quantum', event: { eventId: 'cyber-quantum', domains: ['cybersecurity-privacy','quantum-photonics'] } },
  { caseId: 'emerging', event: { eventId: 'emerging', domain: 'not-yet-classified' } },
].map((entry) => ({ ...entry, executionEvidence: executedFor(entry.event) }));

test('mixed 10-case routing shadow passes when every routed specialist and reviewer executed', () => {
  const result = evaluateShadowBatch(cases);
  assert.equal(result.status, 'PASS');
  assert.equal(result.caseCount, 10);
  assert.equal(result.blockedCaseCount, 0);
  assert.equal(result.externalActionsPerformed, 0);
  assert.equal(result.spendCents, 0);
});

test('clinical case requires clinical evidence review', () => {
  const route = routeSpecialists({ eventId: 'clinical', domain: 'medicine-healthcare' });
  assert.ok(route.specialistPools.includes('wti-clinical-medicine-specialist'));
  assert.ok(route.independentReviewPools.includes('wti-clinical-evidence-reviewer'));
});

test('defense and drone case requires both domain specialists and defense review', () => {
  const route = routeSpecialists({ eventId: 'defense', domains: ['defense-dual-use','drones-aerospace'] });
  assert.ok(route.specialistPools.includes('wti-defense-dual-use-specialist'));
  assert.ok(route.specialistPools.includes('wti-aerospace-space-specialist'));
  assert.ok(route.independentReviewPools.includes('wti-defense-evidence-reviewer'));
});

test('price claims require price and availability review', () => {
  const route = routeSpecialists({ eventId: 'price', domain: 'computing-semiconductors', priceMentioned: true });
  assert.ok(route.independentReviewPools.includes('wti-price-availability-reviewer'));
});

test('cross-domain story invokes every material specialist pool', () => {
  const route = routeSpecialists({ eventId: 'cross', domains: ['ai-software','robotics-autonomy','computing-semiconductors'] });
  assert.deepEqual(new Set(route.specialistPools), new Set(['wti-ai-software-specialist','wti-robotics-autonomy-specialist','wti-compute-semiconductor-specialist']));
});

test('general analyst cannot substitute for specialist execution', () => {
  const route = routeSpecialists({ eventId: 'bad', domain: 'ai-software' });
  const result = validateExecutionEvidence(route, {
    specialistPoolsExecuted: [],
    reviewPoolsExecuted: route.independentReviewPools,
    generalAnalystOnly: true,
    independentReview: true,
    externalActionsPerformed: 0,
    spendCents: 0,
  });
  assert.equal(result.status, 'BLOCKED');
  assert.ok(result.blockers.includes('SPECIALIST_NOT_EXECUTED:wti-ai-software-specialist'));
  assert.ok(result.blockers.includes('GENERAL_ANALYST_ONLY_EXECUTION'));
});

test('missing independent reviewer fails closed', () => {
  const route = routeSpecialists({ eventId: 'clinical2', domain: 'medicine-healthcare' });
  const result = validateExecutionEvidence(route, {
    specialistPoolsExecuted: route.specialistPools,
    reviewPoolsExecuted: ['wti-technical-evidence-reviewer'],
    independentReview: true,
    externalActionsPerformed: 0,
    spendCents: 0,
  });
  assert.equal(result.status, 'BLOCKED');
  assert.ok(result.blockers.includes('REVIEW_NOT_EXECUTED:wti-clinical-evidence-reviewer'));
});

test('emerging domain cannot self-certify deep expertise', () => {
  const route = routeSpecialists({ eventId: 'emerging2', domain: 'unknown-field', deepDomainInterpretationClaimed: true });
  assert.equal(route.status, 'BLOCKED');
  assert.ok(route.blockers.includes('EMERGING_DOMAIN_CANNOT_SELF_CERTIFY_EXPERTISE'));
});
