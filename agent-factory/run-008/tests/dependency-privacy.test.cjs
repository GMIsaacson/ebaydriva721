const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { retentionDecision, normalizeDependency, dependencyHealth } = require('../runtime/dependency-privacy.cjs');

const policy = JSON.parse(fs.readFileSync(path.join(process.cwd(),'agent-factory','run-008','contracts','privacy-retention.v0.1.json'),'utf8'));

test('secrets are not retained as raw durable data', () => {
  assert.equal(policy.classes.SECRET.retentionDays, 0);
  assert.equal(policy.classes.SECRET.rawRetentionAllowed, false);
  assert.equal(policy.rules.sourceControlMayContainSecrets, false);
});

test('sensitive data expires by default', () => {
  const r = retentionDecision({ dataClass:'SENSITIVE', observedAt:'2026-05-01T00:00:00.000Z', asOf:'2026-08-16T00:00:00.000Z' });
  assert.equal(r.valid, true);
  assert.equal(r.retentionDays, 90);
  assert.equal(r.expired, true);
  assert.equal(r.rawRetentionAllowed, false);
});

test('dependency normalization rejects incomplete records', () => {
  assert.equal(normalizeDependency({subjectId:'x'}).valid, false);
});

test('blocked, stale and overdue dependencies surface', () => {
  const deps = [{dependencyId:'D1',subjectId:'run008',dependsOnId:'server-resize',state:'BLOCKED',updatedAt:'2026-08-10T00:00:00.000Z',expectedBy:'2026-08-15T00:00:00.000Z'}];
  const h = dependencyHealth(deps,{now:'2026-08-16T12:00:00.000Z',staleHours:72});
  assert.equal(h.blocked.length,1);
  assert.equal(h.stale.length,1);
  assert.equal(h.overdue.length,1);
  assert.equal(h.items[0].severity,'URGENT');
});
