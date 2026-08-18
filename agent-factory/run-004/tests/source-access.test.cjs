'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const registry = require('../live-sourcing/source-access-registry.json');
const { assertSourceAccess, evaluateSourceAccess, validateRegistry } = require('../runtime/source-access.cjs');

const ACTIVE_TIME = '2026-08-18T00:00:00Z';
const clone = (value) => JSON.parse(JSON.stringify(value));

test('registry is valid and defaults to DENY', () => {
  assert.equal(validateRegistry(registry), registry);
  assert.equal(registry.defaultDecision, 'DENY');
});

test('unknown sources fail closed', () => {
  const result = evaluateSourceAccess({ registry, sourceId: 'not-registered', accessMode: 'official_api', automated: true, at: ACTIVE_TIME });
  assert.equal(result.allowed, false);
  assert.equal(result.reason, 'source is not registered');
});

test('owner-authorized uploads are allowed only as uploads, not machine fetches', () => {
  const upload = evaluateSourceAccess({ registry, sourceId: 'owner-authorized-upload', accessMode: 'owner_upload', automated: false, at: ACTIVE_TIME });
  assert.equal(upload.allowed, true);
  const fetchAttempt = evaluateSourceAccess({ registry, sourceId: 'owner-authorized-upload', accessMode: 'official_api', automated: true, at: ACTIVE_TIME });
  assert.equal(fetchAttempt.allowed, false);
  assert.match(fetchAttempt.reason, /not authorized/);
});

test('YELLOW marketplace route permits manual verification but rejects automation', () => {
  const manual = evaluateSourceAccess({ registry, sourceId: 'ebay-manual-verification', accessMode: 'manual_verification', automated: false, at: ACTIVE_TIME });
  assert.equal(manual.allowed, true);
  const automated = evaluateSourceAccess({ registry, sourceId: 'ebay-manual-verification', accessMode: 'manual_verification', automated: true, at: ACTIVE_TIME });
  assert.equal(automated.allowed, false);
  assert.match(automated.reason, /automated retrieval requires GREEN/);
});

test('RED or killed sources are blocked', () => {
  const result = evaluateSourceAccess({ registry, sourceId: 'unverified-machine-source-template', accessMode: 'official_api', automated: true, at: ACTIVE_TIME });
  assert.equal(result.allowed, false);
  assert.equal(result.reason, 'source kill switch is active');
});

test('expired rights review blocks an otherwise permitted route', () => {
  const modified = clone(registry);
  const source = modified.sources.find((item) => item.sourceId === 'owner-authorized-upload');
  source.nextReviewAt = '2026-08-17T12:00:00Z';
  const result = evaluateSourceAccess({ registry: modified, sourceId: source.sourceId, accessMode: 'owner_upload', automated: false, at: ACTIVE_TIME });
  assert.equal(result.allowed, false);
  assert.equal(result.reason, 'source rights review is expired');
});

test('machine access requires GREEN classification, explicit machine mode and rights evidence', () => {
  const modified = clone(registry);
  modified.sources.push({
    sourceId: 'licensed-feed-demo', displayName: 'Licensed feed demo', classification: 'GREEN', killSwitch: false,
    machineFetchAllowed: true, allowedAccessModes: ['licensed_feed'],
    rightsEvidence: { type: 'license', ref: 'license-demo-001', reviewedBy: 'ABERDEEN-DATASCOUT' },
    lastReviewedAt: '2026-08-17T00:00:00Z', nextReviewAt: '2026-11-15T00:00:00Z', notes: 'Synthetic test source only.'
  });
  const result = evaluateSourceAccess({ registry: modified, sourceId: 'licensed-feed-demo', accessMode: 'licensed_feed', automated: true, at: ACTIVE_TIME });
  assert.equal(result.allowed, true);
  assert.equal(result.accessMode, 'licensed_feed');
});

test('machineFetchAllowed on non-GREEN source makes the registry invalid', () => {
  const modified = clone(registry);
  const source = modified.sources.find((item) => item.sourceId === 'ebay-manual-verification');
  source.machineFetchAllowed = true;
  source.allowedAccessModes.push('official_api');
  assert.throws(() => validateRegistry(modified), { code: 'SOURCE_ACCESS_REGISTRY_INVALID' });
});

test('missing or unreviewed rights evidence blocks access', () => {
  const modified = clone(registry);
  const source = modified.sources.find((item) => item.sourceId === 'owner-authorized-upload');
  source.rightsEvidence.ref = 'not-reviewed';
  const result = evaluateSourceAccess({ registry: modified, sourceId: source.sourceId, accessMode: 'owner_upload', automated: false, at: ACTIVE_TIME });
  assert.equal(result.allowed, false);
  assert.equal(result.reason, 'source rights evidence is not verified');
});

test('assertSourceAccess throws a typed denial instead of silently continuing', () => {
  assert.throws(() => assertSourceAccess({ registry, sourceId: 'unregistered', accessMode: 'public_download', automated: true, at: ACTIVE_TIME }), { code: 'SOURCE_ACCESS_DENIED' });
});
