'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { evaluateProfessionalCapabilityMatrix } = require('../../core/professional-capability-gate.cjs');

const root = path.resolve(__dirname, '..');
const matrix = JSON.parse(fs.readFileSync(path.join(root, 'professional-capability-matrix.json'), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'team-manifest.json'), 'utf8'));
const localSpecialists = new Set(manifest.specialistRoles.map((role) => role.id));
const delegated = new Map([
  ['UIX-015', new Set(['uix-ux-architect-015','uix-interaction-designer-015','uix-art-director-015','uix-design-system-015','uix-responsive-accessibility-015','uix-frontend-polish-015','uix-qa-015'])],
  ['SW-PROD-014', new Set(['requirements-engineer-014','frontend-engineer-014','test-engineering','security-dependency'])],
]);

function bindings(stage) { return Array.isArray(stage.specialistBindings) ? stage.specialistBindings : []; }

test('Kinetiq professional capability matrix passes executable G2.5', () => {
  const result = evaluateProfessionalCapabilityMatrix(matrix);
  assert.equal(result.status, 'PASS');
  assert.equal(result.blockedStageCount, 0);
  assert.equal(result.acceptedLimitationCount, 0);
});

test('every material discipline is explicitly bound to a specialist', () => {
  for (const stage of matrix.professionalCapabilities) {
    const covered = new Set(bindings(stage).map((binding) => binding.discipline));
    for (const discipline of stage.requiredDisciplines) {
      assert(covered.has(discipline), `${stage.stageId} missing ${discipline}`);
    }
  }
});

test('specialist bindings resolve locally or to canonical Run 014/015 services', () => {
  for (const stage of matrix.professionalCapabilities) {
    for (const binding of bindings(stage)) {
      if (localSpecialists.has(binding.specialistId)) continue;
      const allowed = delegated.get(binding.serviceRunId);
      assert(allowed && allowed.has(binding.specialistId), `${stage.stageId} unresolved ${binding.specialistId}`);
    }
  }
});

test('legacy workflow units are not accepted as professional specialist evidence', () => {
  const legacy = new Set(manifest.legacyOperationalUnits);
  for (const stage of matrix.professionalCapabilities) {
    for (const binding of bindings(stage)) {
      assert(!legacy.has(binding.specialistId), `${binding.specialistId} improperly used as specialist evidence`);
    }
  }
});

test('website production delegates design to Run 015 and engineering to Run 014', () => {
  const stage = matrix.professionalCapabilities.find((item) => item.stageId === 'website-production');
  assert(stage);
  const services = new Set(stage.specialistBindings.map((binding) => binding.serviceRunId));
  assert(services.has('UIX-015'));
  assert(services.has('SW-PROD-014'));
});

test('KIN-PROD and KIN-QA are explicitly coordination rather than specialist proof', () => {
  assert.match(manifest.legacyRoleReclassification['KIN-PROD-01'], /coordinator only/i);
  assert.match(manifest.legacyRoleReclassification['KIN-QA-01'], /coordinator only/i);
});

test('no limitation or promotion is silently accepted', () => {
  assert.deepEqual(matrix.acceptedLimitations, []);
  assert.deepEqual(manifest.promotionBoundary.acceptedLimitations, []);
  assert.equal(manifest.promotionBoundary.g4, 'BLOCKED_PENDING_REAL_SHADOW_CASES');
  assert.equal(manifest.promotionBoundary.g6, 'BLOCKED_PENDING_PASSING_LIVE_E2E_AND_OWNER_PROMOTION');
});
