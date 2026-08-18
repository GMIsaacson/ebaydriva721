const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { runShadowPipeline } = require('../runtime/g4-pipeline.cjs');

const fixturePath = path.join(__dirname, '..', 'shadow', 'g3-shadow-results.json');
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

test('G4 pipeline reproduces the supervised G3 set deterministically', () => {
  const result = runShadowPipeline(fixture);
  assert.equal(result.summary.inputCount, 25);
  assert.equal(result.summary.uniqueCount, 25);
  assert.equal(result.summary.duplicateSuppressed, 0);
  assert.equal(result.summary.actionableCount, 17);
  assert.equal(result.summary.watchCount, 3);
  assert.equal(result.summary.rejectedCount, 5);
  assert.equal(result.summary.externalActions, 0);
  assert.equal(result.internalFeed.length, 20);
});

test('duplicate project records are suppressed and evidence is merged', () => {
  const dup = structuredClone(fixture.candidates[0]);
  dup.id = 'DUP-001';
  dup.source = 'https://example.test/second-source';
  dup.confidence = 0.94;
  const result = runShadowPipeline({ candidates: [fixture.candidates[0], dup] });
  assert.equal(result.summary.uniqueCount, 1);
  assert.equal(result.summary.duplicateSuppressed, 1);
  assert.equal(result.reviewed[0].evidenceSources.length, 2);
});

test('low-confidence actionable record is demoted instead of confidence-inflated', () => {
  const weak = structuredClone(fixture.candidates[0]);
  weak.id = 'WEAK-001';
  weak.project = 'Weak Test Project';
  weak.confidence = 0.60;
  const result = runShadowPipeline({ candidates: [weak] });
  assert.equal(result.reviewed[0].status, 'WATCH');
  assert.equal(result.reviewed[0].qaReason, 'confidence_below_actionable_floor');
});

test('missing electrical thesis rejects an actionable record', () => {
  const bad = structuredClone(fixture.candidates[0]);
  bad.id = 'BAD-001';
  bad.project = 'No Thesis Test Project';
  bad.electricalThesis = '';
  const result = runShadowPipeline({ candidates: [bad] });
  assert.equal(result.reviewed[0].status, 'REJECTED');
  assert.equal(result.reviewed[0].qaReason, 'missing_electrical_thesis');
});

test('outside geography fails closed', () => {
  const outside = structuredClone(fixture.candidates[0]);
  outside.municipality = 'Duluth';
  assert.throws(() => runShadowPipeline({ candidates: [outside] }), /outside_pilot_geography/);
});

test('feed is ranked and contains no rejected projects', () => {
  const result = runShadowPipeline(fixture);
  assert.ok(result.internalFeed.every(x => x.status !== 'REJECTED'));
  for (let i = 1; i < result.internalFeed.length; i++) {
    assert.ok(result.internalFeed[i - 1].priorityScore >= result.internalFeed[i].priorityScore);
  }
});
