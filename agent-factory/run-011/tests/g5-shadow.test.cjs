'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fixture = require('../fixtures/g5-shadow.json');
const { calculateScore, evaluateRoute } = require('../runtime/policy.cjs');
const { processPacket } = require('../runtime/runtime.cjs');

test('G5 real calibration set reproduces 10 of 10 supervised Router decisions', () => {
  const result = processPacket(fixture);
  assert.equal(result.status, 'Pass');
  assert.equal(result.summary.candidatesIn, 10);
  assert.equal(result.summary.escalated, 2);
  assert.equal(result.summary.watched, 7);
  assert.equal(result.summary.archived, 1);
  assert.equal(result.summary.blocked, 0);
  assert.equal(result.summary.duplicatesSuppressed, 3);
  const byId = new Map(result.results.map((item) => [item.candidateId, item]));
  for (const candidate of fixture.candidates) {
    const actual = byId.get(candidate.candidateId);
    assert.ok(actual, `missing result for ${candidate.candidateId}`);
    assert.equal(actual.status, 'Pass');
    assert.equal(actual.route, candidate.expectedRoute, `${candidate.candidateId} route mismatch`);
    assert.equal(actual.deterministicScore, candidate.claimedScore, `${candidate.candidateId} score mismatch`);
  }
});

test('G5 duplicate candidates are suppressed from escalation without forcing every duplicate to Archive', () => {
  const duplicateCandidates = fixture.candidates.filter((candidate) => candidate.duplicateDisposition === 'Duplicate');
  assert.equal(duplicateCandidates.length, 3);
  const result = processPacket(fixture);
  const byId = new Map(result.results.map((item) => [item.candidateId, item]));
  assert.equal(byId.get('OIT-003').route, 'Watch');
  assert.equal(byId.get('OIT-004').route, 'Watch');
  assert.equal(byId.get('OIT-006').route, 'Archive');
  assert.ok(duplicateCandidates.every((candidate) => byId.get(candidate.candidateId).route !== 'Escalate'));
});

test('G5 material variant remains Watch unless the Router confirms a material improvement', () => {
  const candidate = JSON.parse(JSON.stringify(fixture.candidates.find((item) => item.candidateId === 'OIT-005')));
  const score = calculateScore(candidate.ratings);
  assert.equal(score, 84);
  assert.equal(evaluateRoute(candidate, score).route, 'Watch');
  candidate.routerRecommendation = 'Escalate';
  let decision = evaluateRoute(candidate, score);
  assert.equal(decision.valid, false);
  assert.equal(decision.reason, 'material_improvement_not_confirmed');
  candidate.materialImprovementConfirmed = true;
  decision = evaluateRoute(candidate, score);
  assert.equal(decision.valid, true);
  assert.equal(decision.route, 'Escalate');
});

test('G5 maintains zero external, portfolio-write, model-call and paid-tool authority', () => {
  const result = processPacket(fixture);
  assert.equal(result.externalActions, 0);
  assert.equal(result.canonicalPortfolioWrites, 0);
  assert.equal(result.aiCalls, 0);
  assert.equal(result.incrementalCostUsd, 0);
  assert.equal(result.controls.scheduleEnabled, false);
  assert.equal(result.controls.webhookEnabled, false);
});
