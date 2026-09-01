'use strict';
const assert = require('assert');
const {
  DIMENSIONS,
  CRITICAL_DIMENSIONS,
  GENOME_KEYS,
  calculateWeightedScore,
  evaluate,
  genomeSimilarity,
  validateRepairControlAgainstPolicy,
} = require('../runtime/ui-quality-gate.cjs');

const GOOD_HASH = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const FAILED_HASH = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const TEST_SURFACES = ['surface-a', 'surface-b', 'surface-c'];
const BOUND_TEST_POLICY = Object.freeze({
  baselineArtifactHash: GOOD_HASH,
  baselineOverallScore: 92.0,
  baselineVisualScore: 91.8,
  allowedSurfaces: TEST_SURFACES,
  requiredPassingCheckIds: ['nav', 'primary-flow', 'persistence'],
});

function genome(overrides = {}) {
  return {
    paletteTemperature: 'cool-dark',
    primaryHueFamily: 'electric-blue',
    accentHueFamily: 'cyan',
    typographyStrategy: 'neo-grotesk-plus-mono',
    geometry: 'medium-radius-solid-panels',
    density: 'dense-terminal',
    layoutArchetype: 'dashboard-grid',
    componentGrammar: 'modular-cards-tabs',
    imageryIconography: 'data-first-minimal',
    motionStyle: 'micro-interaction-fast',
    dataVizLanguage: 'charts-maps',
    ...overrides,
  };
}

function benchmarkSources() {
  return Array.from({ length: 8 }, (_, index) => ({
    url: `https://example${index + 1}.com/product`,
    observedAt: '2026-08-31',
    category: index < 4 ? 'direct-niche' : 'adjacent-pattern',
    distinctiveIdea: `Distinct benchmark principle ${index + 1}`,
  }));
}

function goodBenchmark() {
  return {
    sources: benchmarkSources(),
    coverage: {
      typography: true,
      palette: true,
      layout: true,
      density: true,
      components: true,
      geometry: true,
      interaction: true,
      dataPresentation: true,
      imageryIconography: true,
      mobileTransformation: true,
      distinctiveIdea: true,
    },
    typographyFamiliesObserved: ['Inter', 'IBM Plex Sans', 'Source Serif 4', 'system-ui'],
    nonCopyingPrinciples: ['make evidence visible', 'match density to task', 'use semantic state color rather than decorative accent'],
  };
}

function goodArtDirection() {
  return {
    selectedDirectionId: 'direction-a',
    directions: [
      {
        id: 'direction-a',
        fontFamilies: ['Inter', 'JetBrains Mono'],
        genome: genome(),
      },
      {
        id: 'direction-b',
        fontFamilies: ['Source Serif 4', 'Source Sans 3'],
        genome: genome({
          paletteTemperature: 'warm-light',
          primaryHueFamily: 'terracotta',
          accentHueFamily: 'gold',
          typographyStrategy: 'editorial-serif-plus-sans',
          geometry: 'square-thin-rule',
          density: 'airy-editorial',
          layoutArchetype: 'editorial-scroll',
          componentGrammar: 'rules-sections',
          imageryIconography: 'photography-led',
          motionStyle: 'restrained-fades',
          dataVizLanguage: 'narrative-charts',
        }),
      },
      {
        id: 'direction-c',
        fontFamilies: ['Atkinson Hyperlegible'],
        genome: genome({
          paletteTemperature: 'neutral-high-contrast',
          primaryHueFamily: 'black-white',
          accentHueFamily: 'signal-red',
          typographyStrategy: 'humanist-sans',
          geometry: 'pill-soft-radius',
          density: 'moderate-operational',
          layoutArchetype: 'command-center',
          componentGrammar: 'status-panels-chips',
          imageryIconography: 'iconographic-line',
          motionStyle: 'snappy-stateful',
          dataVizLanguage: 'route-network',
        }),
      },
    ],
  };
}

function unrelatedPortfolioEntry() {
  return {
    productId: 'prior-unrelated',
    relatedBrand: false,
    genome: genome({
      paletteTemperature: 'warm-muted',
      primaryHueFamily: 'violet',
      accentHueFamily: 'lime',
      typographyStrategy: 'display-serif',
      geometry: 'sharp-outline',
      density: 'sparse',
      layoutArchetype: 'storytelling-canvas',
      componentGrammar: 'floating-cards',
      imageryIconography: 'illustration-led',
      motionStyle: 'expressive-scroll',
      dataVizLanguage: 'none',
    }),
  };
}

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
    benchmarkResearch: goodBenchmark(),
    artDirection: goodArtDirection(),
    portfolioHistory: [unrelatedPortfolioEntry()],
    calibration: { nicheAppropriateness: 94, portfolioDistinction: 94 },
    review: { reviewerRole: 'independent-visual-qa', sameAgentAsImplementer: false, blockers: [], visualScore: 94 },
  };
  return {
    ...base,
    ...overrides,
    artifact: { ...base.artifact, ...(overrides.artifact || {}) },
    scores: { ...base.scores, ...(overrides.scores || {}) },
    evidence: { ...base.evidence, ...(overrides.evidence || {}) },
    benchmarkResearch: overrides.benchmarkResearch === null ? null : { ...base.benchmarkResearch, ...(overrides.benchmarkResearch || {}) },
    artDirection: overrides.artDirection === null ? null : { ...base.artDirection, ...(overrides.artDirection || {}) },
    calibration: overrides.calibration === null ? null : { ...base.calibration, ...(overrides.calibration || {}) },
    review: { ...base.review, ...(overrides.review || {}) },
  };
}

function repairControl(overrides = {}) {
  return {
    policyId: 'SYNTHETIC-TEST-POLICY',
    parentArtifactHash: GOOD_HASH,
    changedSurfaces: ['surface-a'],
    ...overrides,
  };
}

function evaluateAgainstBoundFixture(p, policy = BOUND_TEST_POLICY) {
  const score = calculateWeightedScore(p.scores);
  return validateRepairControlAgainstPolicy(p, score, policy);
}

const asteronGenome = {
  paletteTemperature: 'warm-neutral',
  primaryHueFamily: 'desaturated-green-teal',
  accentHueFamily: 'earth-metal-brass',
  typographyStrategy: 'institutional-sans-plus-mono',
  geometry: 'square-low-radius-thin-rule',
  density: 'moderate-dense',
  layoutArchetype: 'editorial-enterprise',
  componentGrammar: 'border-led-panels-rails-ledgers',
  imageryIconography: 'minimal-symbolic-no-photography',
  motionStyle: 'restrained-minimal-native',
  dataVizLanguage: 'process-rails-ledgers',
};
const njiaGenome = {
  paletteTemperature: 'warm-neutral',
  primaryHueFamily: 'desaturated-green-teal',
  accentHueFamily: 'earth-metal-rust-ochre',
  typographyStrategy: 'editorial-serif-display-plus-sans',
  geometry: 'square-low-radius-thin-rule',
  density: 'moderate-dense',
  layoutArchetype: 'editorial-enterprise',
  componentGrammar: 'border-led-panels-rails-ledgers',
  imageryIconography: 'minimal-symbolic-no-photography',
  motionStyle: 'restrained-minimal-native',
  dataVizLanguage: 'sparklines-bars-evidence',
};

const tests = [
  // Pre-extension safeguards: retained, not weakened.
  ['weights sum to 100', () => assert.equal(Object.values(DIMENSIONS).reduce((a,b)=>a+b,0), 100)],
  ['original critical dimensions remain critical and brand distinction is added', () => {
    for (const key of ['visualHierarchy','uxClarity','responsiveExecution','accessibility','brandDistinction']) assert(CRITICAL_DIMENSIONS.includes(key));
  }],
  ['94 scores pass production with complete new evidence', () => assert.equal(evaluate(packet()).verdict, 'PASS_PRODUCTION')],
  ['97 scores pass exceptional', () => assert.equal(evaluate(packet({ scores: Object.fromEntries(Object.keys(DIMENSIONS).map(k=>[k,97])) })).verdict, 'PASS_EXCEPTIONAL')],
  ['89 overall requires revision when criticals remain >=90', () => {
    const p = packet({ scores: { typography: 82, layoutSpacing: 82, componentQuality: 82, interactionPolish: 82, statesAndFeedback: 82 } });
    assert.equal(evaluate(p).verdict, 'REVISE');
  }],
  ['sub-85 rejects', () => assert.equal(evaluate(packet({ scores: Object.fromEntries(Object.keys(DIMENSIONS).map(k=>[k,80])) })).verdict, 'REJECT')],
  ['blocker overrides high score', () => assert.equal(evaluate(packet({ review: { blockers: ['contrast failure'] } })).verdict, 'REJECT')],
  ['critical dimension under 90 rejects', () => assert.equal(evaluate(packet({ scores: { accessibility: 89 } })).verdict, 'REJECT')],
  ['brand distinction under 90 now rejects', () => assert.equal(evaluate(packet({ scores: { brandDistinction: 89 } })).verdict, 'REJECT')],
  ['missing mobile screenshot fails closed', () => assert.throws(() => evaluate(packet({ evidence: { afterScreenshots: { tablet:'x', desktop:'y' } } })), /SCREENSHOT_EVIDENCE_REQUIRED:mobile/)],
  ['missing functional equivalence evidence fails closed', () => assert.throws(() => evaluate(packet({ evidence: { functionalChecks: [] } })), /FUNCTIONAL_EQUIVALENCE_EVIDENCE_REQUIRED/)],
  ['failed functional check fails closed', () => assert.throws(() => evaluate(packet({ evidence: { functionalChecks: [{status:'PASS'},{status:'FAIL'},{status:'PASS'}] } })), /FUNCTIONAL_EQUIVALENCE_FAILED/)],
  ['unapproved logic change fails closed', () => assert.throws(() => evaluate(packet({ artifact: { businessLogicChanged: true } })), /UNAPPROVED_BUSINESS_LOGIC_CHANGE/)],
  ['approved logic change is allowed', () => assert.equal(evaluate(packet({ artifact: { businessLogicChanged: true, businessLogicChangeApproved: true } })).verdict, 'PASS_PRODUCTION')],
  ['self approval is forbidden', () => assert.throws(() => evaluate(packet({ review: { sameAgentAsImplementer: true } })), /SELF_APPROVAL_FORBIDDEN/)],
  ['invalid score is rejected', () => assert.throws(() => calculateWeightedScore({ ...packet().scores, typography: 101 }), /INVALID_SCORE:typography/)],
  ['unregistered real repair policy fails closed', () => {
    const p = packet({ repairControl: repairControl() });
    assert.throws(() => evaluate(p), /REPAIR_POLICY_NOT_APPROVED/);
  }],
  ['synthetic 83.4 candidate cannot replace 92.0 baseline', () => {
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
  ['failed descendant cannot become next repair parent', () => {
    const result = evaluateAgainstBoundFixture(packet({ repairControl: repairControl({ parentArtifactHash: FAILED_HASH }) }));
    assert(result.failures.includes('REPAIR_PARENT_NOT_BASELINE'));
  }],
  ['candidate cannot self-authorize a wider surface', () => {
    const result = evaluateAgainstBoundFixture(packet({ repairControl: repairControl({
      authorizedSurfaces: ['global-redesign'],
      changedSurfaces: ['global-redesign'],
    }) }));
    assert(result.failures.some(x => x.startsWith('REPAIR_OUT_OF_SCOPE:')));
  }],
  ['repair cannot mutate unauthorized surface', () => {
    const result = evaluateAgainstBoundFixture(packet({ repairControl: repairControl({ changedSurfaces: ['surface-a', 'global-redesign'] }) }));
    assert(result.failures.some(x => x.startsWith('REPAIR_OUT_OF_SCOPE:')));
  }],
  ['repair cannot silently drop a policy-required passing check', () => {
    const policy = { ...BOUND_TEST_POLICY, requiredPassingCheckIds: ['nav','primary-flow','persistence','keyboard-filter'] };
    const result = evaluateAgainstBoundFixture(packet({ repairControl: repairControl() }), policy);
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
  ['strictly improved bounded repair clears control checks', () => {
    const result = evaluateAgainstBoundFixture(packet({
      review: { visualScore: 92.1 },
      repairControl: repairControl({ changedSurfaces: TEST_SURFACES }),
    }));
    assert.equal(result.improvesBaseline, true);
    assert.deepEqual(result.failures, []);
  }],

  // New benchmark and portfolio-diversity safeguards.
  ['visual genome schema has eleven explicit dimensions', () => assert.equal(GENOME_KEYS.length, 11)],
  ['Asteron and Njia seed genomes expose the observed similarity defect', () => assert(genomeSimilarity(asteronGenome, njiaGenome) > 0.65)],
  ['missing niche benchmark evidence fails closed', () => assert.throws(() => evaluate(packet({ benchmarkResearch: null })), /NICHE_BENCHMARK_RESEARCH_REQUIRED/)],
  ['fewer than eight benchmark references fails closed', () => assert.throws(() => evaluate(packet({ benchmarkResearch: { sources: benchmarkSources().slice(0,7) } })), /NICHE_BENCHMARK_REFERENCE_MINIMUM:8/)],
  ['fewer than four direct-niche references fails closed', () => {
    const sources = benchmarkSources().map((source, index) => ({ ...source, category: index < 3 ? 'direct-niche' : 'adjacent-pattern' }));
    assert.throws(() => evaluate(packet({ benchmarkResearch: { sources } })), /DIRECT_NICHE_REFERENCE_MINIMUM:4/);
  }],
  ['benchmark must include typography observations', () => assert.throws(() => evaluate(packet({ benchmarkResearch: { typographyFamiliesObserved: [] } })), /BENCHMARK_TYPOGRAPHY_OBSERVATIONS_REQUIRED/)],
  ['benchmark must cover all required visual dimensions', () => assert.throws(() => evaluate(packet({ benchmarkResearch: { coverage: { ...goodBenchmark().coverage, typography: false } } })), /BENCHMARK_COVERAGE_INCOMPLETE:typography/)],
  ['at least three art directions are required', () => assert.throws(() => evaluate(packet({ artDirection: { directions: goodArtDirection().directions.slice(0,2) } })), /ART_DIRECTION_MINIMUM:3/)],
  ['three directions cannot all reuse the same font family set', () => {
    const directions = goodArtDirection().directions.map((direction) => ({ ...direction, fontFamilies: ['Inter'] }));
    const result = evaluate(packet({ artDirection: { directions } }));
    assert.equal(result.verdict, 'REVISE');
    assert(result.artDirection.failures.includes('ART_DIRECTION_TYPOGRAPHY_NOT_DIVERGENT'));
  }],
  ['near-identical art directions revise instead of passing', () => {
    const directions = goodArtDirection().directions.map((direction, index) => ({
      ...direction,
      fontFamilies: [`Font-${index}`],
      genome: genome({ typographyStrategy: `type-${index}` }),
    }));
    const result = evaluate(packet({ artDirection: { directions } }));
    assert.equal(result.verdict, 'REVISE');
    assert(result.artDirection.failures.some((failure) => failure.startsWith('ART_DIRECTION_TOO_SIMILAR:')));
  }],
  ['unrelated portfolio similarity above 65 percent revises', () => {
    const selected = goodArtDirection().directions[0].genome;
    const result = evaluate(packet({ portfolioHistory: [{ productId: 'lookalike', relatedBrand: false, genome: { ...selected } }] }));
    assert.equal(result.verdict, 'REVISE');
    assert(result.portfolioSimilarity.failures.some((failure) => failure.startsWith('PORTFOLIO_SIMILARITY_HIGH:lookalike:')));
  }],
  ['related brand may intentionally reuse its visual system', () => {
    const selected = goodArtDirection().directions[0].genome;
    const result = evaluate(packet({ portfolioHistory: [{ productId: 'same-brand-sibling', relatedBrand: true, genome: { ...selected } }] }));
    assert.equal(result.verdict, 'PASS_PRODUCTION');
  }],
  ['niche appropriateness under 90 revises', () => {
    const result = evaluate(packet({ calibration: { nicheAppropriateness: 89 } }));
    assert.equal(result.verdict, 'REVISE');
    assert(result.calibration.failures.includes('NICHE_APPROPRIATENESS_UNDER_90'));
  }],
  ['portfolio distinction under 90 revises', () => {
    const result = evaluate(packet({ calibration: { portfolioDistinction: 89 } }));
    assert.equal(result.verdict, 'REVISE');
    assert(result.calibration.failures.includes('PORTFOLIO_DISTINCTION_UNDER_90'));
  }],
  ['generic premium justification cannot bypass portfolio similarity', () => {
    const selected = goodArtDirection().directions[0].genome;
    const result = evaluate(packet({
      portfolioHistory: [{ productId: 'lookalike', relatedBrand: false, genome: { ...selected } }],
      portfolioSimilarityException: { acceptedByIndependentQA: true, rationale: 'premium' },
    }));
    assert.equal(result.verdict, 'REVISE');
  }],
];

let passed = 0;
for (const [name, fn] of tests) {
  try { fn(); passed += 1; console.log(`PASS ${name}`); }
  catch (error) { console.error(`FAIL ${name}: ${error.message}`); process.exitCode = 1; }
}
console.log(`${passed}/${tests.length} PASS`);
if (passed !== tests.length) process.exit(1);
