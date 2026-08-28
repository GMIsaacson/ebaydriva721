'use strict';
const assert = require('assert');
const { DIMENSIONS, calculateWeightedScore, evaluate } = require('../runtime/ui-quality-gate.cjs');

function packet(overrides = {}) {
  const base = {
    artifact: { id: 'fixture-ui', businessLogicChanged: false, businessLogicChangeApproved: false },
    scores: {
      visualHierarchy: 94, typography: 94, layoutSpacing: 94, componentQuality: 94, uxClarity: 94,
      interactionPolish: 94, responsiveExecution: 94, brandDistinction: 94, accessibility: 94, statesAndFeedback: 94,
    },
    evidence: {
      beforeScreenshots: { mobile: 'before-mobile.png', tablet: 'before-tablet.png', desktop: 'before-desktop.png' },
      afterScreenshots: { mobile: 'after-mobile.png', tablet: 'after-tablet.png', desktop: 'after-desktop.png' },
      functionalChecks: [{id:'nav',status:'PASS'},{id:'primary-flow',status:'PASS'},{id:'persistence',status:'PASS'}],
    },
    review: { reviewerRole: 'independent-visual-qa', sameAgentAsImplementer: false, blockers: [] },
  };
  return {
    ...base,
    ...overrides,
    artifact: { ...base.artifact, ...(overrides.artifact || {}) },
    scores: { ...base.scores, ...(overrides.scores || {}) },
    evidence: { ...base.evidence, ...(overrides.evidence || {}) },
    review: { ...base.review, ...(overrides.review || {}) },
  };
}

const tests = [
  ['weights sum to 100', () => assert.equal(Object.values(DIMENSIONS).reduce((a,b)=>a+b,0), 100)],
  ['94 scores pass production', () => assert.equal(evaluate(packet()).verdict, 'PASS_PRODUCTION')],
  ['97 scores pass exceptional', () => assert.equal(evaluate(packet({ scores: Object.fromEntries(Object.keys(DIMENSIONS).map(k=>[k,97])) })).verdict, 'PASS_EXCEPTIONAL')],
  ['89 overall requires revision when criticals remain >=90', () => {
    const p = packet({ scores: { typography: 82, layoutSpacing: 82, componentQuality: 82, interactionPolish: 82, brandDistinction: 82, statesAndFeedback: 82 } });
    assert.equal(evaluate(p).verdict, 'REVISE');
  }],
  ['sub-85 rejects', () => assert.equal(evaluate(packet({ scores: Object.fromEntries(Object.keys(DIMENSIONS).map(k=>[k,80])) })).verdict, 'REJECT')],
  ['blocker overrides high score', () => assert.equal(evaluate(packet({ review: { blockers: ['contrast failure'] } })).verdict, 'REJECT')],
  ['critical dimension under 90 rejects', () => assert.equal(evaluate(packet({ scores: { accessibility: 89 } })).verdict, 'REJECT')],
  ['missing mobile screenshot fails closed', () => assert.throws(() => evaluate(packet({ evidence: { afterScreenshots: { tablet:'x', desktop:'y' } } })), /SCREENSHOT_EVIDENCE_REQUIRED:mobile/)],
  ['missing functional equivalence evidence fails closed', () => assert.throws(() => evaluate(packet({ evidence: { functionalChecks: [] } })), /FUNCTIONAL_EQUIVALENCE_EVIDENCE_REQUIRED/)],
  ['failed functional check fails closed', () => assert.throws(() => evaluate(packet({ evidence: { functionalChecks: [{status:'PASS'},{status:'FAIL'},{status:'PASS'}] } })), /FUNCTIONAL_EQUIVALENCE_FAILED/)],
  ['unapproved logic change fails closed', () => assert.throws(() => evaluate(packet({ artifact: { businessLogicChanged: true } })), /UNAPPROVED_BUSINESS_LOGIC_CHANGE/)],
  ['approved logic change is allowed', () => assert.equal(evaluate(packet({ artifact: { businessLogicChanged: true, businessLogicChangeApproved: true } })).verdict, 'PASS_PRODUCTION')],
  ['self approval is forbidden', () => assert.throws(() => evaluate(packet({ review: { sameAgentAsImplementer: true } })), /SELF_APPROVAL_FORBIDDEN/)],
  ['invalid score is rejected', () => assert.throws(() => calculateWeightedScore({ ...packet().scores, typography: 101 }), /INVALID_SCORE:typography/)],
];

let passed = 0;
for (const [name, fn] of tests) {
  try { fn(); passed += 1; console.log(`PASS ${name}`); }
  catch (error) { console.error(`FAIL ${name}: ${error.message}`); process.exitCode = 1; }
}
console.log(`${passed}/${tests.length} PASS`);
if (passed !== tests.length) process.exit(1);
