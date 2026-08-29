'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const sim = require('../runtime/g3-simulator.cjs');

const scenarios = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'g3-scenarios.json'), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'team-manifest.json'), 'utf8'));
const handoffs = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'contracts', 'handoff-contract.json'), 'utf8'));

test('Run 014 manifest preserves identity, specialist expansion, and zero standing external authority', () => {
  assert.equal(manifest.runNumber, 14);
  assert.equal(manifest.runId, 'SW-PROD-014');
  assert.ok(manifest.roles.length >= 19);
  const roleIds = new Set(manifest.roles.map(role => role.id));
  for (const id of ['product-manager-014','requirements-engineer-014','domain-analyst-014','software-architect','data-architect-014','frontend-engineer-014','backend-engineer-014','data-engineer-014','integration-engineer-014','platform-release-engineer-014','test-engineering','security-dependency','product-quality-reviewer-014','architecture-quality-reviewer-014','engineering-quality-reviewer-014']) {
    assert.ok(roleIds.has(id), `missing specialist role ${id}`);
  }
  assert.ok(['None', 'Approval-gated'].includes(manifest.externalAuthority));
  assert.equal(manifest.authority.maxExternalActions, 0);
  assert.equal(manifest.authority.maxSpendCents, 0);
  assert.equal(manifest.authority.deploy, false);
});

test('typed handoff chain includes specialist professional-quality reviews', () => {
  const required = [
    'product_brief_v1','product_definition_review_v1','software_spec_v1','architecture_plan_v1',
    'architecture_quality_review_v1','uix_assignment_v1_when_applicable','implementation_change_set_v1',
    'test_evidence_v1','security_review_v1','engineering_quality_review_v1','release_candidate_v1','ops_handoff_v1'
  ];
  assert.deepEqual(manifest.handoffs, required);
  assert.deepEqual(handoffs.requiredHandoffs.map(item => item.type), required);
  assert.ok(handoffs.requiredEnvelopeFields.includes('authorityCeiling'));
  assert.ok(handoffs.requiredEnvelopeFields.includes('evidenceRefs'));
  assert.ok(handoffs.requiredEnvelopeFields.includes('unresolvedBlockers'));
});

test('G3 suite contains exactly the 14 required scenarios', () => {
  sim.validateScenarioSet(scenarios);
  assert.equal(scenarios.length, 14);
  assert.deepEqual(new Set(scenarios.map(s => s.id)), new Set(sim.REQUIRED_SCENARIOS));
});

test('normal bounded build is the only happy-path delivery scenario', () => {
  const result = sim.evaluateScenario(scenarios.find(s => s.id === 'normal-bounded-build'));
  assert.equal(result.terminalState, 'DELIVERED');
  assert.equal(result.reasonCode, 'SIMULATION_PASS');
  assert.equal(result.externalActionsPerformed, 0);
  assert.equal(result.spendCents, 0);
  assert.equal(result.deploymentsPerformed, 0);
});

test('ambiguous requirement fails closed to owner', () => {
  const result = sim.evaluateScenario(scenarios.find(s => s.id === 'ambiguous-requirement'));
  assert.equal(result.terminalState, 'BLOCKED_OWNER');
  assert.equal(result.reasonCode, 'AMBIGUOUS_SCOPE');
});

test('test failure can never be delivered', () => {
  const result = sim.evaluateScenario(scenarios.find(s => s.id === 'test-failure'));
  assert.equal(result.terminalState, 'FAILED');
  assert.equal(result.reasonCode, 'TEST_FAILURE');
});

test('critical dependency vulnerability can never be waived', () => {
  const result = sim.evaluateScenario(scenarios.find(s => s.id === 'dependency-vulnerability'));
  assert.equal(result.terminalState, 'FAILED');
  assert.equal(result.reasonCode, 'SECURITY_VULNERABILITY');
});

test('migration failure exercises rollback and records failure', () => {
  const result = sim.evaluateScenario(scenarios.find(s => s.id === 'migration-rollback'));
  assert.equal(result.terminalState, 'FAILED');
  assert.equal(result.reasonCode, 'MIGRATION_ROLLED_BACK');
  assert.equal(result.rollbackPerformed, true);
});

test('unavailable build tool blocks external dependency without pretending success', () => {
  const result = sim.evaluateScenario(scenarios.find(s => s.id === 'unavailable-build-tool'));
  assert.equal(result.terminalState, 'BLOCKED_EXTERNAL');
  assert.equal(result.reasonCode, 'BUILD_TOOL_UNAVAILABLE');
});

test('hallucinated API or library fails closed', () => {
  const result = sim.evaluateScenario(scenarios.find(s => s.id === 'hallucinated-api-library'));
  assert.equal(result.terminalState, 'FAILED');
  assert.equal(result.reasonCode, 'UNKNOWN_API_OR_LIBRARY');
});

test('unauthorized deployment attempt is blocked before external action', () => {
  const result = sim.evaluateScenario(scenarios.find(s => s.id === 'unauthorized-deployment-attempt'));
  assert.equal(result.terminalState, 'BLOCKED_OWNER');
  assert.equal(result.reasonCode, 'UNAUTHORIZED_DEPLOY');
  assert.equal(result.deploymentsPerformed, 0);
});

test('cost/retry exhaustion kills the attempt deterministically', () => {
  const result = sim.evaluateScenario(scenarios.find(s => s.id === 'cost-retry-exhaustion'));
  assert.equal(result.terminalState, 'KILLED');
  assert.equal(result.reasonCode, 'RETRY_EXHAUSTED');
});

test('Run 013 is permanently rejected as an identifier', () => {
  const result = sim.evaluateScenario(scenarios.find(s => s.id === 'reserved-run-013'));
  assert.equal(result.terminalState, 'FAILED');
  assert.equal(result.reasonCode, 'RESERVED_RUN_013');
});

test('full fresh G3 suite passes with complete evidence and zero authority use', () => {
  const receipt = sim.runSuite(scenarios, { now: '2026-08-22T18:40:00Z' });
  assert.equal(receipt.g3Decision, 'PASS');
  assert.equal(receipt.scenarioCount, 14);
  assert.equal(receipt.mismatchCount, 0);
  assert.equal(receipt.qa.evidenceComplete, true);
  assert.equal(receipt.qa.authorityClean, true);
  assert.equal(receipt.qa.reservedRunRejected, true);
  assert.equal(receipt.qa.normalPathDelivered, true);
  assert.equal(receipt.externalActionsPerformed, 0);
  assert.equal(receipt.spendCents, 0);
  assert.equal(receipt.deploymentsPerformed, 0);
  assert.ok(receipt.results.every(r => r.matchedExpected && r.evidenceId));
});

test('missing required scenario blocks the suite', () => {
  assert.throws(() => sim.runSuite(scenarios.slice(0, 13)), /scenario set mismatch/);
});
