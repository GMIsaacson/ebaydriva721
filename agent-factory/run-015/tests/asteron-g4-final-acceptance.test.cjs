'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { evaluate } = require('../runtime/ui-quality-gate.cjs');

const evidenceDir = path.join(__dirname, '..', 'evidence');
const scorecard = JSON.parse(fs.readFileSync(path.join(evidenceDir, 'asteron-g4-scorecard.json'), 'utf8'));
const viewport = JSON.parse(fs.readFileSync(path.join(evidenceDir, 'asteron-g4-viewport-evidence.json'), 'utf8'));
const baseline = JSON.parse(fs.readFileSync(path.join(evidenceDir, 'asteron-g4-baseline.json'), 'utf8'));
const receipt = JSON.parse(fs.readFileSync(path.join(evidenceDir, 'asteron-g4-terminal-receipt.json'), 'utf8'));

const screenshots = {
  mobile: viewport.renderEvidence.mobile.screenshot,
  tablet: viewport.renderEvidence.tablet.screenshot,
  desktop: viewport.renderEvidence.desktop.screenshot,
};

const packet = {
  artifact: scorecard.artifact,
  scores: scorecard.scores,
  evidence: {
    // This is a qualification of one locked artifact, not a mutation. Both
    // sides deliberately reference the same source-locked captures.
    beforeScreenshots: screenshots,
    afterScreenshots: screenshots,
    functionalChecks: viewport.functionalChecks,
  },
  review: {
    reviewerRole: scorecard.review.reviewerRole,
    sameAgentAsImplementer: scorecard.review.sameAgentAsImplementer,
    blockers: scorecard.review.blockers,
    visualScore: scorecard.review.visualScore,
  },
};

const result = evaluate(packet);

assert.equal(viewport.artifactLock.sourceCommit, baseline.artifact.sourceCommit);
assert.equal(viewport.artifactLock.gitBlobSha1, baseline.artifact.gitBlobSha1);
assert.equal(viewport.artifactLock.deploymentCommit, baseline.artifact.sourceCommit);
assert.equal(viewport.captureStatus, 'COMPLETE');
assert(viewport.functionalChecks.length >= 3);
assert(viewport.functionalChecks.every((check) => check.status === 'PASS'));
assert.equal(result.score, 92.6);
assert.equal(result.verdict, 'PASS_PRODUCTION');
assert.deepEqual(result.criticalFailures, []);
assert.equal(scorecard.result, result.verdict);
assert.equal(scorecard.review.decision, 'PASS');
assert.equal(receipt.finalScore, result.score);
assert.equal(receipt.decision, result.verdict);
assert.equal(receipt.terminalState, 'G4_ACCEPTED');
assert.equal(receipt.repairRequired, false);
assert.equal(baseline.quality.finalScore, result.score);
assert.equal(baseline.quality.verdict, result.verdict);
assert.equal(baseline.status, 'G4_ACCEPTED_PASS_PRODUCTION');

console.log(`PASS Asteron G4 final acceptance: ${result.score} ${result.verdict}`);
