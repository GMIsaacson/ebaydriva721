'use strict';
const assert = require('assert');
const { DIMENSIONS, calculateWeightedScore, evaluate } = require('../runtime/ui-quality-gate.cjs');

const GOOD_HASH = '39209fe600000000000000000000000000000000000000000000000000000000';
const FAILED_HASH = '83a40000000000000000000000000000000000000000000000000000000000';
const AUTHORIZED_SURFACES = [
  'desktop-ledger-alignment',
  'tablet-decision-strip-layout',
  'keyboard-filter-aria',
];

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
  const base = {
    baseline: {
      artifactHash: GOOD_HASH,
      overallScore: 92.0,
      visualScore: 91.8,
      passingCheckIds: ['nav', 'primary-flow', 'persistence'],
    },
    parentArtifactHash: GOOD_HASH,
    authorizedSurfaces: AUTHORIZED_SURFACES,
    changedSurfaces: ['desktop-ledger-alignment'],
  };
  return {
    ...base,
    ...overrides,
    baseline: { ...base.baseline, ...(overrides.baseline || {}) },
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

  ['repair requires full immutable baseline hash', () => {
    const p = packet({ repairControl: repairControl({ baseline: { artifactHash: '39209fe6' } }) });
    assert.throws(() => evaluate(p), /REPAIR_BASELINE_FULL_HASH_REQUIRED/);
  }],
  ['83.4 repair cannot replace 92.0 baseline', () => {
    const p = packet({
      scores: Object.fromEntries(Object.keys(DIMENSIONS).map(k=>[k,83.4])),
      review: { visualScore: 83.4 },
      repairControl: repairControl(),
    });
    const result = evaluate(p);
    assert.equal(result.verdict, 'REJECT');
    assert(result.repairControl.failures.includes('REPAIR_OVERALL_SCORE_REGRESSION'));
    assert(result.repairControl.failures.includes('REPAIR_VISUAL_SCORE_REGRESSION'));
  }],
  ['failed repair descendant cannot become next repair parent', () => {
    const result = evaluate(packet({ repairControl: repairControl({ parentArtifactHash: FAILED_HASH }) }));
    assert.equal(result.verdict, 'REJECT');
    assert(result.repairControl.failures.includes('REPAIR_PARENT_NOT_BASELINE'));
  }],
  ['repair cannot mutate an unauthorized UI surface', () => {
    const result = evaluate(packet({ repairControl: repairControl({ changedSurfaces: ['desktop-ledger-alignment', 'global-typography-system'] }) }));
    assert.equal(result.verdict, 'REJECT');
    assert(result.repairControl.failures.some(x => x.startsWith('REPAIR_OUT_OF_SCOPE:')));
  }],
  ['repair cannot silently drop a previously passing check', () => {
    const result = evaluate(packet({ repairControl: repairControl({ baseline: { passingCheckIds: ['nav','primary-flow','persistence','keyboard-filter'] } }) }));
    assert.equal(result.verdict, 'REJECT');
    assert(result.repairControl.failures.some(x => x.includes('keyboard-filter')));
  }],
  ['repair cannot reduce independent visual score', () => {
    const result = evaluate(packet({ review: { visualScore: 91.7 }, repairControl: repairControl() }));
    assert.equal(result.verdict, 'REJECT');
    assert(result.repairControl.failures.includes('REPAIR_VISUAL_SCORE_REGRESSION'));
  }],
  ['repair must bring every dimension to at least 90', () => {
    const result = evaluate(packet({ scores: { typography: 89 }, repairControl: repairControl() }));
    assert.equal(result.verdict, 'REJECT');
    assert(result.repairControl.failures.some(x => x.includes('typography')));
  }],
  ['equal-score repair does not replace current best', () => {
    const scores = Object.fromEntries(Object.keys(DIMENSIONS).map(k=>[k,92]));
    const result = evaluate(packet({ scores, review: { visualScore: 91.8 }, repairControl: repairControl() }));
    assert.equal(result.score, 92);
    assert.equal(result.verdict, 'REVISE');
    assert.equal(result.repairControl.improvesBaseline, false);
  }],
  ['strictly improved bounded repair can pass', () => {
    const result = evaluate(packet({
      review: { visualScore: 92.1 },
      repairControl: repairControl({ changedSurfaces: AUTHORIZED_SURFACES }),
    }));
    assert.equal(result.score, 94);
    assert.equal(result.verdict, 'PASS_PRODUCTION');
    assert.equal(result.repairControl.improvesBaseline, true);
    assert.deepEqual(result.repairControl.failures, []);
  }],
];

let passed = 0;
for (const [name, fn] of tests) {
  try { fn(); passed += 1; console.log(`PASS ${name}`); }
  catch (error) { console.error(`FAIL ${name}: ${error.message}`); process.exitCode = 1; }
}
console.log(`${passed}/${tests.length} PASS`);
if (passed !== tests.length) process.exit(1);
