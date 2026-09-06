'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  validateSpecialistRegistry,
  evaluateProfessionalReadiness,
  completionAttestation,
} = require('../professional-capability.cjs');

const registry = [
  { specialistId:'SP-QA', discipline:'Quality Engineering', subdiscipline:'Deterministic QA', qualificationState:'QUALIFIED', allowedTaskClasses:['qa'], excludedTaskClasses:[], eligibleAsReviewer:true },
  { specialistId:'SP-EVID', discipline:'Research QA', subdiscipline:'Evidence Verification', qualificationState:'QUALIFIED', allowedTaskClasses:['evidence'], excludedTaskClasses:[], eligibleAsReviewer:true },
  { specialistId:'SP-PROD', discipline:'Product Management', subdiscipline:'Software Product Strategy', qualificationState:'QUALIFIED', allowedTaskClasses:['product'], excludedTaskClasses:[], eligibleAsReviewer:false },
  { specialistId:'SP-PROD-REV', discipline:'Product Management', subdiscipline:'Software Product Strategy', qualificationState:'QUALIFIED', allowedTaskClasses:['product-review'], excludedTaskClasses:[], eligibleAsReviewer:true },
  { specialistId:'SP-UX', discipline:'Product Design', subdiscipline:'UX Architecture', qualificationState:'PROVISIONAL', allowedTaskClasses:['ux'], excludedTaskClasses:[], eligibleAsReviewer:true },
];

function pcm(overrides = {}) {
  return {
    jobId:'J-1', deliverableType:'software-product', businessOutcome:'usable release candidate', materialDecisions:['scope','ux'],
    requiredDisciplines:[
      { discipline:'Product Management', subdiscipline:'Software Product Strategy', criticality:'gating', assignedSpecialistId:'SP-PROD', independentReviewerId:'SP-PROD-REV', scopeBoundary:'product decisions only', evidenceStandard:'requirements traceability', professionalAcceptanceStandard:'senior product practitioner would approve' },
    ],
    ...overrides,
  };
}

test('registry rejects duplicates', () => {
  assert.throws(() => validateSpecialistRegistry([...registry, registry[0]]), /duplicate specialistId/);
});

test('qualified gating specialist plus independent qualified reviewer is READY', () => {
  const result = evaluateProfessionalReadiness(pcm(), registry);
  assert.equal(result.professionalReadiness, 'READY');
  assert.equal(result.independenceDefects.length, 0);
});

test('gating provisional specialist blocks professional readiness', () => {
  const input = pcm({ requiredDisciplines:[{ discipline:'Product Design', subdiscipline:'UX Architecture', criticality:'gating', assignedSpecialistId:'SP-UX', independentReviewerId:'SP-EVID', scopeBoundary:'ux only', evidenceStandard:'usability evidence', professionalAcceptanceStandard:'senior UX practitioner would approve' }] });
  const result = evaluateProfessionalReadiness(input, registry);
  assert.equal(result.professionalReadiness, 'BLOCKED');
});

test('missing gating specialist blocks professional readiness', () => {
  const input = pcm({ requiredDisciplines:[{ discipline:'Freight & Import', subdiscipline:'Cross-border landed cost', criticality:'gating', scopeBoundary:'freight only', evidenceStandard:'quote-level freight', professionalAcceptanceStandard:'experienced importer would approve' }] });
  const result = evaluateProfessionalReadiness(input, registry);
  assert.equal(result.professionalReadiness, 'BLOCKED');
  assert.equal(result.unfilledCapabilities.length, 1);
});

test('self-review blocks professional readiness', () => {
  const input = pcm({ requiredDisciplines:[{ discipline:'Product Management', subdiscipline:'Software Product Strategy', criticality:'gating', assignedSpecialistId:'SP-PROD', independentReviewerId:'SP-PROD', scopeBoundary:'product only', evidenceStandard:'requirements traceability', professionalAcceptanceStandard:'senior product practitioner would approve' }] });
  const result = evaluateProfessionalReadiness(input, registry);
  assert.equal(result.professionalReadiness, 'BLOCKED');
});

test('Q1 and Q2 cannot substitute for Q3', () => {
  const attestation = completionAttestation({ operationalReady:true, evidenceReady:true, pcm:pcm(), registry, professionalReview:{ reviewerId:'SP-PROD-REV', result:'PE_FAIL', disciplinesReviewed:['Product Management'] } });
  assert.equal(attestation.overallReadiness, 'BLOCKED');
});

test('READY requires Q1, Q2 and passing independent Q3', () => {
  const attestation = completionAttestation({ operationalReady:true, evidenceReady:true, pcm:pcm(), registry, professionalReview:{ reviewerId:'SP-PROD-REV', result:'PE_PASS', disciplinesReviewed:['Product Management'] } });
  assert.equal(attestation.professionalReadiness, 'READY');
  assert.equal(attestation.overallReadiness, 'READY');
});
