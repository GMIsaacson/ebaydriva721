'use strict';
const assert = require('assert');
const {
  DIMENSIONS,
  calculateWeightedScore,
  evaluate,
  validateRepairControlAgainstPolicy,
} = require('../runtime/ui-quality-gate.cjs');

const GOOD_HASH = '39209fe600000000000000000000000000000000000000000000000000000000';
const FAILED_HASH = '83a4000000000000000000000000000000000000000000000000000000000000';
const AUTHORIZED_SURFACES = [
  'desktop-ledger-alignment',
  'tablet-decision-strip-layout',
  'keyboard-filter-aria',
];
const BOUND_TEST_POLICY = Object.freeze({
  baselineArtifactHash: GOOD_HASH,
  baselineOverallScore: 92.0,
  baselineVisualScore: 91.8,
  allowedSurfaces: AUTHORIZED_SURFACES,
  requiredPassingCheckIds: ['nav', 'primary-flow', 'persistence'],
});

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
    review: { reviewerRole: 'independent-visual-qa', sameAgentAsImplementer: false, blockers: [], visualScore: 94 },
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

function repairControl(overrides = {}) {
  return {
    policyId: 'RUN015-NJIA-20260831',
    parentArtifactHash: GOOD_HASH,
    changedSurfaces: ['desktop-ledger-alignment'],
    ...overrides,
  };
}

function evaluateAgainstBoundFixture(p) {
  const score = calculateWeightedScore(p.scores);
  return validateRepairControlAgainstPolicy(p, score, BOUND_TEST_POLICY);
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

  ['unknown repair policy fails closed', () => {
    const p = packet({ repairControl: repairControl({ policyId: 'NOT-APPROVED' }) });
    assert.throws(() => evaluate(p), /REPAIR_POLICY_NOT_APPROVED/);
  }],
  ['current Njia repair policy cannot run until exact baseline hash is bound', () => {
    const p = packet({ repairControl: repairControl() });
    assert.throws(() => evaluate(p), /REPAIR_POLICY_BASELINE_UNBOUND/);
  }],
  ['83.4 repair cannot replace 92.0 baseline', () => {
    const p = packet({
      scores: Object.fromEntries(Object.keys(DIMENSIONS).map(k=>[k,83.4])),
      review: { visualScore: 83.4 },
      repairControl: repairControl(),
    });
    const result = evaluateAgainstBoundFixture(p);
    assert(result.failures.includes('REPAIR_OVERALL_SCORE_REGRESSION'));
    assert(result.failures.includes('REPAIR_VISUAL_SCORE_REGRESSION'));
    assert(result.failures.some(x => x.startsWith('REPAIR_DIMENSION_UNDER_90:')));
  }],
  ['failed repair descendant cannot become next repair parent', () => {
    const result = evaluateAgainstBoundFixture(packet({ repairControl: repairControl({ parentArtifactHash: FAILED_HASH }) }));
    assert(result.failures.includes('REPAIR_PARENT_NOT_BASELINE'));
  }],
  ['repair candidate cannot self-authorize a global UI mutation', () => {
    const result = evaluateAgainstBoundFixture(packet({ repairControl: repairControl({
      authorizedSurfaces: ['global-typography-system'],
      changedSurfaces: ['global-typography-system'],
    }) }));
    assert(result.failures.some(x => x.startsWith('REPAIR_OUT_OF_SCOPE:')));
  }],
  ['repair cannot mutate an unauthorized UI surface', () => {
    const result = evaluateAgainstBoundFixture(packet({ repairControl: repairControl({ changedSurfaces: ['desktop-ledger-alignment', 'global-typography-system'] }) }));
    assert(result.failures.some(x => x.startsWith('REPAIR_OUT_OF_SCOPE:')));
  }],
  ['repair cannot silently drop a policy-required passing check', () => {
    const policy = { ...BOUND_TEST_POLICY, requiredPassingCheckIds: ['nav','primary-flow','persistence','keyboard-filter'] };
    const result = validateRepairControlAgainstPolicy(packet({ repairControl: repairControl() }), 94, policy);
    assert(result.failures.some(x => x.includes('keyboard-filter')));
  }],
  ['repair cannot reduce independent visual score', () => {
    const result = evaluateAgainstBoundFixture(packet({ review: { visualScore: 91.7 }, repairControl: repairControl() }));
    assert(result.failures.includes('REPAIR_VISUAL_SCORE_REGRESSION'));
  }],
  ['repair must bring every dimension to at least 90', () => {
    const p = packet({ scores: { typography: 89 }, repairControl: repairControl() });
    const result = evaluateAgainstBoundFixture(p);
    assert(result.failures.some(x => x.includes('typography')));
  }],
  ['equal-score repair does not improve current best', () => {
    const scores = Object.fromEntries(Object.keys(DIMENSIONS).map(k=>[k,92]));
    const p = packet({ scores, review: { visualScore: 91.8 }, repairControl: repairControl() });
    const result = evaluateAgainstBoundFixture(p);
    assert.equal(result.improvesBaseline, false);
    assert.deepEqual(result.failures, []);
  }],
  ['strictly improved bounded repair clears repair-control checks', () => {
    const result = evaluateAgainstBoundFixture(packet({
      review: { visualScore: 92.1 },
      repairControl: repairControl({ changedSurfaces: AUTHORIZED_SURFACES }),
    }));
    assert.equal(result.improvesBaseline, true);
    assert.deepEqual(result.failures, []);
  }],
];

let passed = 0;
for (const [name, fn] of tests) {
  try { fn(); passed += 1; console.log(`PASS ${name}`); }
  catch (error) { console.error(`FAIL ${name}: ${error.message}`); process.exitCode = 1; }
}
console.log(`${passed}/${tests.length} PASS`);
if (passed !== tests.length) process.exit(1);
