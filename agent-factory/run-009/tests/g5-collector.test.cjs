const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  assertReadOnlySource,
  detectProjectSignals,
  collectRegistry,
  collectorRecordsToPipelineCandidates,
  feedCollectedSignals,
} = require('../runtime/g5-collector.cjs');

const registry = JSON.parse(fs.readFileSync(path.join(__dirname, '../collectors/source-registry.v0.1.json'), 'utf8'));

function fakeFetch(url, opts) {
  assert.equal(opts.method, 'GET');
  const html = `<html><body><h1>Planning Commission</h1><p>Proposed new six-story mixed-use building with 120 units and retail space.</p><p>Conditional use permit for development plan.</p></body></html>`;
  return Promise.resolve({ ok: true, url, text: async () => html });
}

test('registry is manual read-only with no schedule authority', () => {
  assert.equal(registry.mode, 'READ_ONLY_MANUAL');
  assert.equal(registry.scheduleAuthorized, false);
  assert.equal(registry.sources.length, 4);
  for (const source of registry.sources) assert.equal(assertReadOnlySource(source), true);
});

test('collector rejects unapproved hosts', () => {
  assert.throws(() => assertReadOnlySource({ enabled: true, baseUrl: 'https://example.com/x' }), /host_not_allowlisted/);
});

test('signal detector finds construction-development language', () => {
  const signals = detectProjectSignals('A proposed new mixed-use building includes 120 units. Conditional use permit for development plan.');
  assert.ok(signals.length >= 1);
});

test('registry collection is bounded and read-only', async () => {
  const result = await collectRegistry(registry, fakeFetch);
  assert.equal(result.sourcesAttempted, 4);
  assert.equal(result.sourcesSucceeded, 4);
  assert.equal(result.externalActions, 0);
  assert.equal(result.scheduleAuthorized, false);
  assert.ok(result.results.every(r => r.authority === 'READ_ONLY'));
});

test('collector output cannot self-promote to ACTIONABLE', async () => {
  const result = await collectRegistry(registry, fakeFetch);
  const candidates = collectorRecordsToPipelineCandidates(result.results);
  assert.ok(candidates.length > 0);
  assert.ok(candidates.every(c => c.status === 'WATCH' && c.confidence === 0.5));
  const pipeline = feedCollectedSignals(result.results);
  assert.equal(pipeline.summary.externalActions, 0);
  assert.equal(pipeline.summary.actionableCount, 0);
  assert.ok(pipeline.summary.watchCount > 0);
});
