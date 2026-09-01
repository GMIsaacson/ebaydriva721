'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { calculateWeightedScore } = require('../runtime/ui-quality-gate.cjs');

// Asteron was accepted before A0-UIX-015-002 introduced mandatory niche-web,
// divergent-art-direction and portfolio-genome evidence. This test protects the
// historical acceptance record under the exact evidence contract that existed
// at acceptance time. It intentionally does NOT call the current evaluate()
// function: all NEW assignments must satisfy the stricter v2 gate and cannot
// use this historical compatibility check as a bypass.

const evidenceDir = path.join(__dirname, '..', 'evidence');
const scorecard = JSON.parse(fs.readFileSync(path.join(evidenceDir, 'asteron-g4-scorecard.json'), 'utf8'));
const viewport = JSON.parse(fs.readFileSync(path.join(evidenceDir, 'asteron-g4-viewport-evidence.json'), 'utf8'));
const baseline = JSON.parse(fs.readFileSync(path.join(evidenceDir, 'asteron-g4-baseline.json'), 'utf8'));
const receipt = JSON.parse(fs.readFileSync(path.join(evidenceDir, 'asteron-g4-terminal-receipt.json'), 'utf8'));
const registry = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'portfolio', 'visual-genome-registry.json'), 'utf8'));

const historicalScore = calculateWeightedScore(scorecard.scores);
const historicalCriticalDimensions = ['visualHierarchy', 'uxClarity', 'responsiveExecution', 'accessibility'];
const historicalCriticalFailures = historicalCriticalDimensions.filter((key) => Number(scorecard.scores[key]) < 90);
const expectedHistoricalVerdict = historicalCriticalFailures.length || historicalScore < 85
  ? 'REJECT'
  : historicalScore < 92
    ? 'REVISE'
    : historicalScore < 96
      ? 'PASS_PRODUCTION'
      : 'PASS_EXCEPTIONAL';

assert.equal(viewport.artifactLock.sourceCommit, baseline.artifact.sourceCommit);
assert.equal(viewport.artifactLock.gitBlobSha1, baseline.artifact.gitBlobSha1);
assert.equal(viewport.artifactLock.deploymentCommit, baseline.artifact.sourceCommit);
assert.equal(viewport.captureStatus, 'COMPLETE');
assert(viewport.functionalChecks.length >= 3);
assert(viewport.functionalChecks.every((check) => check.status === 'PASS'));
assert.equal(historicalScore, 92.6);
assert.equal(expectedHistoricalVerdict, 'PASS_PRODUCTION');
assert.deepEqual(historicalCriticalFailures, []);
assert.equal(scorecard.result, expectedHistoricalVerdict);
assert.equal(scorecard.review.decision, 'PASS');
assert.equal(receipt.finalScore, historicalScore);
assert.equal(receipt.decision, expectedHistoricalVerdict);
assert.equal(receipt.terminalState, 'G4_ACCEPTED');
assert.equal(receipt.repairRequired, false);
assert.equal(baseline.quality.finalScore, historicalScore);
assert.equal(baseline.quality.verdict, expectedHistoricalVerdict);
assert.equal(baseline.status, 'G4_ACCEPTED_PASS_PRODUCTION');
assert(registry.entries.some((entry) => entry.productId === 'asteron'), 'ASTERON_VISUAL_GENOME_NOT_REGISTERED');

console.log(`PASS historical Asteron G4 acceptance preserved: ${historicalScore} ${expectedHistoricalVerdict}`);
