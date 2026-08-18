const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const data = JSON.parse(fs.readFileSync(path.join(process.cwd(),'agent-factory','run-009','shadow','g3-shadow-results.json'),'utf8'));
const rows = data.candidates;

test('shadow run has exactly 25 unique candidates', () => {
  assert.equal(rows.length, 25);
  assert.equal(new Set(rows.map(r => r.id)).size, 25);
  assert.equal(new Set(rows.map(r => `${r.municipality}|${r.project}`)).size, 25);
});

test('all candidates are evidence-backed and read-only', () => {
  assert.equal(data.authority, 'READ_ONLY_INTERNAL_ANALYSIS');
  assert.equal(data.summary.externalActions, 0);
  assert.equal(data.summary.paidDataSources, 0);
  for (const row of rows) {
    assert.match(row.source, /^https:\/\//);
    assert.ok(row.confidence >= 0 && row.confidence <= 1);
  }
});

test('G3 produces at least 10 actionable opportunities', () => {
  const actionable = rows.filter(r => r.status === 'ACTIONABLE');
  assert.ok(actionable.length >= 10);
  assert.ok(actionable.every(r => r.confidence >= 0.75));
  assert.ok(actionable.every(r => typeof r.electricalThesis === 'string' && r.electricalThesis.length > 30));
});

test('weak planning-only signals are rejected rather than inflated', () => {
  const rejected = rows.filter(r => r.status === 'REJECTED');
  assert.ok(rejected.length >= 4);
  assert.ok(rejected.every(r => r.rejectReason && r.rejectReason.length > 20));
  const forbidden = ['MPLS-008','MPLS-010','MPLS-011','BLOOM-007'];
  for (const id of forbidden) assert.equal(rows.find(r => r.id === id).status, 'REJECTED');
});

test('summary reconciles to underlying records', () => {
  const count = status => rows.filter(r => r.status === status).length;
  assert.equal(data.summary.candidateCount, rows.length);
  assert.equal(data.summary.actionableCount, count('ACTIONABLE'));
  assert.equal(data.summary.watchCount, count('WATCH'));
  assert.equal(data.summary.rejectedCount, count('REJECTED'));
  assert.equal(data.summary.duplicateLeakage, 0);
});
