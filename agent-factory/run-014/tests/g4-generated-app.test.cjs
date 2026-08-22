'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const sourceDir = process.env.G4_SOURCE_DIR;
if (!sourceDir) throw new Error('G4_SOURCE_DIR is required');
const core = require(path.join(sourceDir, 'readiness-core.js'));

function fixture(overrides = {}) {
  return {
    runId: 'SW-PROD-014', gate: 'G4', releaseDecision: 'PASS',
    tests: { status: 'PASS' }, security: { status: 'PASS' },
    opsHandoff: { status: 'READY', target: 'Run 008' },
    artifactHashes: ['sha256:abc'], blockers: [],
    authority: { externalActions: 0, deployments: 0, spendCents: 0 },
    ...overrides
  };
}

test('ready evidence returns READY', () => {
  assert.deepEqual(core.evaluateEvidence(fixture()), { ready: true, decision: 'READY', blockers: [] });
});

test('failed tests fail closed', () => {
  const r = core.evaluateEvidence(fixture({ tests: { status: 'FAIL' } }));
  assert.equal(r.decision, 'BLOCKED'); assert.ok(r.blockers.includes('TESTS_NOT_PASS'));
});

test('failed security fails closed', () => {
  const r = core.evaluateEvidence(fixture({ security: { status: 'FAIL' } }));
  assert.equal(r.decision, 'BLOCKED'); assert.ok(r.blockers.includes('SECURITY_NOT_PASS'));
});

test('explicit blocker is surfaced', () => {
  const r = core.evaluateEvidence(fixture({ blockers: ['OWNER_APPROVAL_REQUIRED'] }));
  assert.equal(r.decision, 'BLOCKED'); assert.ok(r.blockers.includes('EVIDENCE_BLOCKER:OWNER_APPROVAL_REQUIRED'));
});

test('authority use blocks readiness', () => {
  const r = core.evaluateEvidence(fixture({ authority: { externalActions: 1, deployments: 0, spendCents: 0 } }));
  assert.equal(r.decision, 'BLOCKED'); assert.ok(r.blockers.includes('EXTERNAL_ACTIONS_NONZERO'));
});

test('artifact hashes are mandatory', () => {
  const r = core.evaluateEvidence(fixture({ artifactHashes: [] }));
  assert.equal(r.decision, 'BLOCKED'); assert.ok(r.blockers.includes('ARTIFACT_HASHES_MISSING'));
});

test('generated UI is semantic and contains no external URL', () => {
  const html = fs.readFileSync(path.join(sourceDir, 'index.html'), 'utf8');
  const app = fs.readFileSync(path.join(sourceDir, 'app.js'), 'utf8');
  const css = fs.readFileSync(path.join(sourceDir, 'styles.css'), 'utf8');
  assert.match(html, /<main>/); assert.match(html, /Evidence Readiness Console/);
  assert.match(html, /readiness-core\.js/); assert.match(html, /app\.js/);
  assert.doesNotMatch(html + app + css, /https?:\/\//i);
});
