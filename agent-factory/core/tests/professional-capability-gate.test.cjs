'use strict';

const assert = require('assert');
const {
  evaluateProfessionalCapabilityMatrix,
  assertProfessionalCapabilityComplete,
} = require('../professional-capability-gate.cjs');

const strong = {
  professionalCapabilities: [{
    stageId: 'design',
    workProduct: 'Production UI design',
    requiredDisciplines: ['ux', 'visual-design', 'accessibility'],
    assignedSpecialists: ['ux', 'visual-design', 'accessibility'],
    evidenceStandards: ['task-flow rationale', 'responsive states', 'contrast evidence'],
    qa: {
      type: 'professional_excellence',
      disciplines: ['ux', 'visual-design', 'accessibility'],
      acceptanceCriteria: ['senior-practitioner quality bar'],
      independent: true,
    },
  }],
};

const pass = evaluateProfessionalCapabilityMatrix(strong);
assert.equal(pass.status, 'PASS');
assert.equal(pass.blockedStageCount, 0);
assert.equal(assertProfessionalCapabilityComplete(strong).status, 'PASS');

const genericAgent = JSON.parse(JSON.stringify(strong));
genericAgent.professionalCapabilities[0].assignedSpecialists = ['generic-ui-agent'];
const blockedGeneric = evaluateProfessionalCapabilityMatrix(genericAgent);
assert.equal(blockedGeneric.status, 'BLOCKED');
assert(blockedGeneric.stages[0].defects.some((x) => x.startsWith('MISSING_SPECIALIST_COVERAGE:')));

const correctnessOnlyQa = JSON.parse(JSON.stringify(strong));
correctnessOnlyQa.professionalCapabilities[0].qa.type = 'correctness';
const blockedQa = evaluateProfessionalCapabilityMatrix(correctnessOnlyQa);
assert.equal(blockedQa.status, 'BLOCKED');
assert(blockedQa.stages[0].defects.includes('QA_NOT_PROFESSIONAL_EXCELLENCE'));

const accepted = JSON.parse(JSON.stringify(genericAgent));
accepted.professionalCapabilities[0].limitation = {
  disposition: 'ACCEPTED_LIMITATION',
  owner: 'Business owner',
  rationale: 'Pilot intentionally accepts reduced visual-design depth.',
};
const acceptedResult = evaluateProfessionalCapabilityMatrix(accepted);
assert.equal(acceptedResult.status, 'PASS');
assert.equal(acceptedResult.acceptedLimitationCount, 1);

const missing = evaluateProfessionalCapabilityMatrix({});
assert.equal(missing.status, 'BLOCKED');
assert.throws(() => assertProfessionalCapabilityComplete({}), /G2\.5/);

console.log('professional-capability-gate: PASS');
