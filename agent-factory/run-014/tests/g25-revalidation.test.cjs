'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { run } = require('../runtime/g25-revalidation-runner.cjs');

const runRoot = path.resolve(__dirname, '..');
const assignmentDir = path.join(runRoot, 'assignments', 'factory-core-hybrid-topology');

function execute() {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'run014-g25-'));
  return run({ outDir, assignmentDir });
}

test('bounded specialist revalidation passes with zero authority use', () => {
  const receipt = execute();
  assert.equal(receipt.decision, 'PASS');
  assert.equal(receipt.professionalCompletenessClaim, 'PROVEN_FOR_THIS_BOUNDED_ASSIGNMENT');
  assert.equal(receipt.externalActionsPerformed, 0);
  assert.equal(receipt.spendCents, 0);
  assert.equal(receipt.deploymentsPerformed, 0);
  assert.deepEqual(receipt.blockers, []);
});

test('every applicable stage has specialists, hashed evidence, and independent professional review', () => {
  const receipt = execute();
  for (const stage of receipt.stages.filter(stage => stage.applicable)) {
    assert.ok(stage.specialists.length > 0, `${stage.stageId} has no specialists`);
    assert.ok(stage.evidenceRefs.length > 0, `${stage.stageId} has no evidence refs`);
    assert.ok(stage.evidenceRefs.every(ref => /^[a-f0-9]{64}$/.test(ref.sha256)), `${stage.stageId} has malformed evidence hash`);
    assert.equal(stage.independentReview.decision, 'PASS');
    assert.ok(stage.independentReview.reviewer);
    assert.ok(stage.independentReview.criteria.length > 0);
  }
});

test('broad compatibility coordinators are never counted as specialist execution evidence', () => {
  const receipt = execute();
  const prohibited = new Set(['product-spec', 'implementation', 'challenger-qa']);
  for (const stage of receipt.stages) {
    for (const specialist of stage.specialists) {
      assert.equal(prohibited.has(specialist.specialistId), false, `${specialist.specialistId} improperly counted in ${stage.stageId}`);
    }
  }
});

test('UIX is explicitly conditional and not falsely claimed on the headless assignment', () => {
  const receipt = execute();
  const ui = receipt.stages.find(stage => stage.stageId === 'ux-ui');
  assert(ui);
  assert.equal(ui.applicable, false);
  assert.equal(ui.independentReview.decision, 'NOT_APPLICABLE');
  assert.ok(ui.specialists.every(s => s.serviceRunId === 'UIX-015'));
});
