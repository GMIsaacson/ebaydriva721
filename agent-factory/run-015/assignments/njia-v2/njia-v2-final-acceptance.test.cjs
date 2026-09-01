'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const gate = require('../../runtime/ui-quality-gate.cjs');

const read = (name) => JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8'));
const assignment = read('01-benchmark-art-direction.json');
const browser = read('02-browser-evidence.json');
const scorecard = read('03-uix-scorecard.json');
const qa = read('04-independent-qa.json');
const registry = JSON.parse(fs.readFileSync(path.join(__dirname, '../../portfolio/visual-genome-registry.json'), 'utf8'));

const screenshots = {
  before: {
    mobile: browser.viewports.mobile.beforeScreenshot,
    tablet: browser.viewports.tablet.beforeScreenshot,
    desktop: browser.viewports.desktop.beforeScreenshot,
  },
  after: {
    mobile: browser.viewports.mobile.afterScreenshot,
    tablet: browser.viewports.tablet.afterScreenshot,
    desktop: browser.viewports.desktop.afterScreenshot,
  },
};

const packet = {
  artifact: {
    id: 'njia-v2-signal-grid-market-wire',
    businessLogicChanged: false,
    businessLogicChangeApproved: false,
  },
  scores: scorecard.scores,
  evidence: {
    beforeScreenshots: screenshots.before,
    afterScreenshots: screenshots.after,
    functionalChecks: browser.functionalChecks,
  },
  review: {
    reviewerRole: 'independent-visual-qa',
    sameAgentAsImplementer: false,
    blockers: qa.blockers || [],
    visualScore: scorecard.review.visualScore,
  },
  benchmarkResearch: assignment.benchmarkResearch,
  artDirection: assignment.artDirection,
  portfolioHistory: registry.entries.map((entry) => ({
    productId: entry.productId,
    relatedBrand: false,
    genome: entry.genome,
  })),
  calibration: {
    nicheAppropriateness: scorecard.calibration.nicheAppropriateness,
    portfolioDistinction: scorecard.calibration.portfolioDistinction,
  },
};

const result = gate.evaluate(packet);

assert.equal(assignment.assignmentId, 'UIX-015-NJIA-V2-001');
assert.equal(assignment.lockedBaseline.commit, '48383a9af1c72f7e2e0128b734265581bab3f324');
assert.equal(assignment.lockedBaseline.score, 93.4);
assert.equal(assignment.implementationAuthority.businessLogicChange, false);
assert.equal(assignment.implementationAuthority.htmlContentArchitectureChange, false);
assert.equal(assignment.implementationAuthority.productionPromotion, false);

assert.equal(browser.status, 'PASS');
assert(browser.functionalChecks.length >= 14);
assert(browser.functionalChecks.every((check) => check.status === 'PASS'));
assert(Object.values(browser.viewports).every((viewport) => viewport.noPageOverflow === true));
assert.equal(browser.lockedParent.commit, assignment.lockedBaseline.commit);
assert.equal(browser.lockedParent.score, assignment.lockedBaseline.score);
assert.equal(browser.lockedParent.indexHtmlUnchanged, true);

assert.equal(result.score, 94.8);
assert.equal(result.score, scorecard.weightedScore);
assert.equal(result.verdict, 'PASS_PRODUCTION');
assert.deepEqual(result.criticalFailures, []);
assert.deepEqual(result.blockers, []);
assert.deepEqual(result.artDirection.failures, []);
assert.deepEqual(result.portfolioSimilarity.failures, []);
assert.deepEqual(result.calibration.failures, []);
assert.equal(result.artDirection.selectedDirectionId, 'signal-grid-market-wire');
assert(result.artDirection.typographySignatureCount >= 3);
assert(result.artDirection.pairwiseSimilarity.every((row) => row.similarity <= gate.MAX_DIRECTION_SIMILARITY));
assert(result.portfolioSimilarity.comparisons.every((row) => row.relatedBrand || row.similarity <= gate.PORTFOLIO_REVISE_THRESHOLD));
assert(result.calibration.nicheAppropriateness >= gate.CALIBRATION_MINIMUM);
assert(result.calibration.portfolioDistinction >= gate.CALIBRATION_MINIMUM);

assert.equal(qa.decision, 'PASS');
assert.equal(qa.qualityTier, 'PASS_PRODUCTION');
assert.equal(qa.productionDeploymentAuthorized, false);
assert.equal(scorecard.productionMutationAuthorized, false);
assert.equal(scorecard.nonRegression.candidateScoreAtLeastBaseline, true);
assert.equal(scorecard.nonRegression.allPreviouslyPassingFunctionalChecksRemainPass, true);
assert.equal(scorecard.nonRegression.allCriticalDimensionsAtLeast90, true);
assert(result.score >= assignment.lockedBaseline.score);
assert.equal(Math.round((result.score - assignment.lockedBaseline.score) * 10) / 10, 1.4);

for (const dimension of gate.CRITICAL_DIMENSIONS) {
  assert(Number(scorecard.scores[dimension]) >= 90, `critical dimension regressed: ${dimension}`);
}

console.log(JSON.stringify({
  status: 'PASS',
  assignmentId: assignment.assignmentId,
  baselineScore: assignment.lockedBaseline.score,
  candidateScore: result.score,
  delta: Math.round((result.score - assignment.lockedBaseline.score) * 10) / 10,
  verdict: result.verdict,
  selectedDirection: result.artDirection.selectedDirectionId,
  benchmarkSources: result.benchmarkResearch.sources,
  directNicheSources: result.benchmarkResearch.directNicheSources,
  nicheAppropriateness: result.calibration.nicheAppropriateness,
  portfolioDistinction: result.calibration.portfolioDistinction,
  qaDecision: qa.decision,
  productionDeploymentAuthorized: qa.productionDeploymentAuthorized,
}, null, 2));
