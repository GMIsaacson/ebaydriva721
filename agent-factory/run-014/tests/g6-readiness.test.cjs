'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const factoryRoot = path.resolve(root, '..');
const readJson = p => JSON.parse(fs.readFileSync(p, 'utf8'));

const manifest = readJson(path.join(root, 'team-manifest.json'));
const g5 = readJson(path.join(root, 'g5', 'g5-operational-receipt.json'));
const g6 = readJson(path.join(root, 'g6', 'g6-readiness-receipt.json'));
const a0 = readJson(path.join(factoryRoot, 'governance', 'a0-decisions', 'A0-SOFT-014-G6-001.a0.json'));
const contract = fs.readFileSync(path.join(root, 'OPERATING-CONTRACT.md'), 'utf8');

test('manifest remains controlled-live while G2.5 professional revalidation is staged', () => {
  assert.equal(manifest.runId, 'SW-PROD-014');
  assert.equal(manifest.currentGate, 'G6');
  assert.equal(manifest.lifecycle, 'Controlled Live');
  assert.ok([
    'Ready for controlled operation',
    'G2.5 specialist remediation staged on PR; controlled-live authority unchanged'
  ].includes(manifest.operatingState));
  assert.equal(manifest.g6.status, 'PASS');
  assert.equal(manifest.g6.terminalState, 'READY_FOR_CONTROLLED_OPERATION');
  assert.equal(manifest.professionalCapabilityGate.gateId, 'G2.5');
});

test('standing external authority remains zero', () => {
  assert.equal(manifest.authority.maxExternalActions, 0);
  assert.equal(manifest.authority.maxSpendCents, 0);
  assert.equal(manifest.authority.deploy, false);
  assert.equal(manifest.g6.productionAuthorityGranted, false);
  assert.equal(a0.authority.external_actions, 0);
  assert.equal(a0.authority.deploy, false);
  assert.equal(a0.authority.production_deploy, false);
});

test('G5 operational evidence is complete and bounded', () => {
  assert.equal(g5.decision, 'PASS');
  assert.equal(g5.deployment.normalizedTarget, 'preview');
  assert.equal(g5.deployment.readyState, 'READY');
  assert.deepEqual(g5.deployment.aliases, []);
  assert.equal(g5.authority.externalActionsUsed, 1);
  assert.equal(g5.authority.observedSpendCents, 0);
  assert.equal(g5.targetGuard.factoryHostTestsPassed, 9);
  assert.equal(g5.targetGuard.factoryHostTestsFailed, 0);
  assert.equal(g5.rollbackRehearsal.productionTrafficMutation, false);
});

test('G6 preserves downstream Run 008 boundary', () => {
  assert.equal(g6.decision, 'PASS');
  assert.equal(g6.promotion, 'CONTROLLED_LIVE_CAPABILITY');
  assert.equal(g6.terminalState, 'READY_FOR_CONTROLLED_OPERATION');
  assert.equal(g6.downstreamBoundary.target, 'OPS-CORE-008');
  assert.equal(g6.downstreamBoundary.run008Acceptance, 'NOT_PROVEN');
  assert.equal(g6.downstreamBoundary.run008Execution, 'NOT_PROVEN');
  assert.equal(manifest.downstream.acceptanceProven, false);
  assert.equal(manifest.downstream.executionProven, false);
});

test('operating contract requires fresh bounded approval for external deployment', () => {
  assert.match(contract, /Standing external authority is \*\*zero\*\*/);
  assert.match(contract, /fresh, bounded owner approval/);
  assert.match(contract, /must not claim that Run 008 accepted or executed/);
});

test('legacy production-target deployment is quarantined, not promotion evidence', () => {
  assert.ok(Array.isArray(g6.nonBlockingTechnicalDebt));
  assert.equal(g6.nonBlockingTechnicalDebt[0].disposition, 'QUARANTINED_LEGACY_ARTIFACT');
  assert.match(g6.nonBlockingTechnicalDebt[0].reasonNonBlocking, /not used as G5\/G6 evidence/);
});
