'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const guard = require('./a0-guard.cjs');
const policy = JSON.parse(fs.readFileSync(path.join(__dirname, 'a0-policy.json'), 'utf8'));

function decision(overrides = {}) {
  return {
    decision_id: 'A0-TEST-001',
    status: 'PASS',
    verdict: 'NEW',
    owner: 'Owner',
    decided_at: '2026-08-18',
    business_outcome: 'Own an unowned business loop.',
    existing_owner_scan: 'Registry and system map checked.',
    reuse_candidates_checked: ['existing-unit-1'],
    duplication_analysis: 'No existing unit owns the residual loop.',
    residual_unowned_loop: 'A bounded loop remains unowned.',
    covers_paths: ['agent-factory/run-013/'],
    evidence_ref: 'notion:A0-TEST-001',
    ...overrides,
  };
}

function wrapDecision(value, touchedInChange = true) {
  return {
    repoPath: 'agent-factory/governance/a0-decisions/A0-TEST-001.a0.json',
    decision: value,
    touchedInChange,
    validationErrors: guard.validateDecision(value, policy),
  };
}

test('new run is blocked without an A0 decision', () => {
  const result = guard.evaluateChanges({
    changes: [{ status: 'A', path: 'agent-factory/run-013/README.md' }],
    decisions: [],
    policy,
    baseRunExistence: new Map([['agent-factory/run-013', false]]),
  });
  assert.equal(result.violations.length, 1);
});

test('current PASS/NEW decision covers a new run', () => {
  const result = guard.evaluateChanges({
    changes: [{ status: 'A', path: 'agent-factory/run-013/contracts/team-contract.json' }],
    decisions: [wrapDecision(decision())],
    policy,
    baseRunExistence: new Map([['agent-factory/run-013', false]]),
  });
  assert.equal(result.violations.length, 0);
});

test('REUSE cannot authorize structural creation', () => {
  const d = decision({ verdict: 'REUSE' });
  const result = guard.evaluateChanges({
    changes: [{ status: 'A', path: 'agent-factory/run-013/contracts/team-contract.json' }],
    decisions: [wrapDecision(d)],
    policy,
    baseRunExistence: new Map([['agent-factory/run-013', false]]),
  });
  assert.equal(result.violations.length, 1);
  assert.match(result.violations[0].reason, /verdict must be/);
});

test('stale untouched A0 evidence cannot be inherited', () => {
  const result = guard.evaluateChanges({
    changes: [{ status: 'A', path: 'agent-factory/run-013/contracts/team-contract.json' }],
    decisions: [wrapDecision(decision(), false)],
    policy,
    baseRunExistence: new Map([['agent-factory/run-013', false]]),
  });
  assert.equal(result.violations.length, 1);
  assert.match(result.violations[0].reason, /no changed A0 decision/);
});

test('missing reuse evidence fails closed', () => {
  const d = decision({ reuse_candidates_checked: [] });
  const result = guard.evaluateChanges({
    changes: [{ status: 'A', path: 'agent-factory/run-013/contracts/team-contract.json' }],
    decisions: [wrapDecision(d)],
    policy,
    baseRunExistence: new Map([['agent-factory/run-013', false]]),
  });
  assert.equal(result.violations.length, 1);
  assert.match(result.violations[0].reason, /reuse_candidates_checked/);
});

test('structural addition to an existing run is protected', () => {
  const d = decision({ verdict: 'EXTEND', covers_paths: ['agent-factory/run-004/agents/'] });
  const result = guard.evaluateChanges({
    changes: [{ status: 'A', path: 'agent-factory/run-004/agents/new-agent.json' }],
    decisions: [wrapDecision(d)],
    policy,
    baseRunExistence: new Map([['agent-factory/run-004', true]]),
  });
  assert.equal(result.protectedChanges.length, 1);
  assert.equal(result.violations.length, 0);
});

test('tests and fixtures do not create false structural gates', () => {
  const result = guard.evaluateChanges({
    changes: [
      { status: 'A', path: 'agent-factory/run-004/tests/workflow.test.cjs' },
      { status: 'A', path: 'agent-factory/run-004/fixtures/team.json' },
    ],
    decisions: [],
    policy,
    baseRunExistence: new Map([['agent-factory/run-004', true]]),
  });
  assert.equal(result.protectedChanges.length, 0);
  assert.equal(result.violations.length, 0);
});

test('governance and CI files are exempt so the guard can maintain itself', () => {
  const result = guard.evaluateChanges({
    changes: [
      { status: 'A', path: 'agent-factory/governance/a0-policy.json' },
      { status: 'A', path: '.github/workflows/a0-constitutional-guard.yml' },
    ],
    decisions: [],
    policy,
    baseRunExistence: new Map(),
  });
  assert.equal(result.protectedChanges.length, 0);
});
