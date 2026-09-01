'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { evaluateProfessionalCapabilityMatrix } = require('../../core/professional-capability-gate.cjs');

const runDir = path.resolve(__dirname, '..');
const matrix = JSON.parse(fs.readFileSync(path.join(runDir, 'professional-capability-matrix.json'), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.join(runDir, 'team-manifest.json'), 'utf8'));

const roleIds = new Set(manifest.roles.map((role) => role.id));
const delegatedIds = new Set([
  'uix-ux-architect-015',
  'uix-interaction-designer-015',
  'uix-art-director-015',
  'uix-design-system-015',
  'uix-responsive-accessibility-015',
  'uix-frontend-polish-015',
  'uix-qa-015',
]);

function allBindings(stage) {
  return Array.isArray(stage.specialistBindings) ? stage.specialistBindings : [];
}

test('Run 014 professional capability matrix passes executable G2.5', () => {
  const result = evaluateProfessionalCapabilityMatrix(matrix);
  assert.equal(result.status, 'PASS');
  assert.equal(result.blockedStageCount, 0);
  assert.equal(result.acceptedLimitationCount, 0);
});

test('every required discipline has an explicit specialist binding', () => {
  for (const stage of matrix.professionalCapabilities) {
    const bindings = allBindings(stage);
    const covered = new Set(bindings.map((binding) => binding.discipline));
    for (const discipline of stage.requiredDisciplines) {
      assert(covered.has(discipline), `${stage.stageId} missing binding for ${discipline}`);
    }
  }
});

test('every specialist binding resolves to Run 014 or delegated Run 015', () => {
  for (const stage of matrix.professionalCapabilities) {
    for (const binding of allBindings(stage)) {
      const local = roleIds.has(binding.specialistId);
      const delegated = binding.serviceRunId === 'UIX-015' && delegatedIds.has(binding.specialistId);
      assert(local || delegated, `${stage.stageId} unresolved specialist ${binding.specialistId}`);
    }
  }
});

test('broad compatibility coordinators are not used as specialist evidence', () => {
  const prohibited = new Set(['product-spec', 'implementation', 'challenger-qa']);
  for (const stage of matrix.professionalCapabilities) {
    for (const binding of allBindings(stage)) {
      assert(!prohibited.has(binding.specialistId), `${binding.specialistId} used as specialist binding in ${stage.stageId}`);
    }
  }
});

test('user-facing UI is delegated to Run 015 specialists', () => {
  const stage = matrix.professionalCapabilities.find((item) => item.stageId === 'ux-ui');
  assert(stage);
  assert(stage.specialistBindings.every((binding) => binding.serviceRunId === 'UIX-015'));
  assert.equal(stage.qa.serviceRunId, 'UIX-015');
});

test('no professional limitation is silently accepted', () => {
  assert.deepEqual(matrix.acceptedLimitations, []);
  for (const stage of matrix.professionalCapabilities) {
    assert.equal(stage.limitation, undefined);
  }
});
