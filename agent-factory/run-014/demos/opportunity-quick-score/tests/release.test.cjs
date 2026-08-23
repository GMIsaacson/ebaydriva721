'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '..');
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex');

const brief = readJson('product-brief.json');
const evidence = readJson('test-evidence.json');
const release = readJson('release-candidate.json');
const security = fs.readFileSync(path.join(root, 'security-review.md'), 'utf8');

test('release candidate traces all acceptance criteria', () => {
  assert.equal(brief.acceptanceCriteria.length, 8);
  assert.equal(release.acceptanceCriteria.total, 8);
  assert.equal(release.acceptanceCriteria.passed, 8);
  assert.equal(release.acceptanceCriteria.failed, 0);
});

test('release artifact hashes match actual runtime files', () => {
  for (const artifact of release.runtimeArtifacts) {
    assert.equal(sha256(artifact.path), artifact.sha256, artifact.path);
    assert.equal(evidence.artifactHashes[artifact.path], artifact.sha256, artifact.path);
  }
});

test('test and security gates are passing', () => {
  assert.equal(evidence.decision, 'PASS');
  assert.equal(evidence.testsPassed, 12);
  assert.equal(evidence.testsFailed, 0);
  assert.match(security, /Security gate\n\n\*\*PASS/);
});

test('release remains non-production and non-deployed', () => {
  assert.equal(release.environment, 'non-production');
  assert.equal(release.externalDeploymentAuthorized, false);
  assert.equal(release.authorityAccounting.deployments, 0);
  assert.equal(release.authorityAccounting.spendCents, 0);
  assert.equal(release.authorityAccounting.productionMutations, 0);
  assert.equal(release.authorityAccounting.customerContacts, 0);
});
