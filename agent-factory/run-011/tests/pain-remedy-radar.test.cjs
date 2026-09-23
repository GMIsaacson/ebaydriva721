'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { scoreOpportunity } = require('../runtime/opportunity-score.cjs');
const { scopeGate } = require('../runtime/scope-gate.cjs');
const { runRegistry } = require('../runtime/regression-runner.cjs');

const privacyCandidate = {
  dimensions: {
    severityOfPain: 85,
    frequencyRepetition: 90,
    evidencePeoplePay: 90,
    remedyEffectiveness: 75,
    factoryAutomationPotential: 85,
    grossMarginPotential: 85,
    acquisitionFeasibility: 70,
    defensibilityDataAdvantage: 55,
    regulatoryViability: 80,
  },
  evidenceLinks: ['a', 'b', 'c'],
  killCriteria: ['stop if removal rate fails'],
};

test('privacy calibration scores in serious-investigation range', () => {
  const result = scoreOpportunity(privacyCandidate);
  assert.equal(result.score, 81.5);
  assert.equal(result.decision, 'SERIOUS_INVESTIGATION');
});

test('high score without evidence is capped at WATCH', () => {
  const result = scoreOpportunity({ ...privacyCandidate, evidenceLinks: [] });
  assert.equal(result.decision, 'WATCH');
});

test('high score without kill criteria is capped at WATCH', () => {
  const result = scoreOpportunity({ ...privacyCandidate, killCriteria: [] });
  assert.equal(result.decision, 'WATCH');
});

test('privacy-remediation scope passes', () => {
  const result = scopeGate({ purpose: 'consented privacy exposure scan and removal monitoring' });
  assert.equal(result.pass, true);
  assert.equal(result.allowedPrivacyPattern, true);
});

test('employment eligibility use fails closed', () => {
  const result = scopeGate({ purpose: 'use people-search records for employment eligibility' });
  assert.equal(result.pass, false);
  assert.ok(result.violations.includes('ELIGIBILITY_DECISIONING'));
});

test('privacy-remediation is not rejected merely because evidence mentions brokers selling personal data', () => {
  const result = scopeGate({
    signal: 'data brokers sell personal data and publish people-search profiles',
    purpose: 'help consumers remove and suppress privacy exposure',
  });
  assert.equal(result.pass, true);
});

test('raw personal-profile resale fails closed', () => {
  const result = scopeGate({ purpose: 'sell personal data and person profiles to customers' });
  assert.equal(result.pass, false);
  assert.ok(result.violations.includes('RAW_PERSON_PROFILE_RESALE'));
});

test('MISS-001 regression passes', () => {
  const registry = path.join(__dirname, '..', 'registry', 'missed-opportunity-regressions.json');
  const result = runRegistry(registry);
  assert.equal(result.results.length, 1);
  assert.equal(result.results[0].id, 'MISS-001');
  assert.equal(result.results[0].pass, true);
});
