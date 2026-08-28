'use strict';

const DIMENSIONS = Object.freeze({
  visualHierarchy: 15,
  typography: 10,
  layoutSpacing: 10,
  componentQuality: 10,
  uxClarity: 15,
  interactionPolish: 10,
  responsiveExecution: 10,
  brandDistinction: 10,
  accessibility: 5,
  statesAndFeedback: 5,
});

const REQUIRED_VIEWPORTS = Object.freeze(['mobile', 'tablet', 'desktop']);
const CRITICAL_DIMENSIONS = Object.freeze(['visualHierarchy', 'uxClarity', 'responsiveExecution', 'accessibility']);

function asFiniteScore(value, key) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 100) throw new Error(`INVALID_SCORE:${key}`);
  return n;
}

function validatePacket(packet) {
  if (!packet || typeof packet !== 'object' || Array.isArray(packet)) throw new Error('PACKET_REQUIRED');
  if (!packet.artifact || typeof packet.artifact !== 'object') throw new Error('ARTIFACT_REQUIRED');
  if (!packet.scores || typeof packet.scores !== 'object') throw new Error('SCORES_REQUIRED');
  if (!packet.evidence || typeof packet.evidence !== 'object') throw new Error('EVIDENCE_REQUIRED');
  if (!packet.review || typeof packet.review !== 'object') throw new Error('REVIEW_REQUIRED');

  if (packet.review.reviewerRole !== 'independent-visual-qa') throw new Error('INDEPENDENT_REVIEW_REQUIRED');
  if (packet.review.sameAgentAsImplementer === true) throw new Error('SELF_APPROVAL_FORBIDDEN');

  if (packet.artifact.businessLogicChanged === true && packet.artifact.businessLogicChangeApproved !== true) {
    throw new Error('UNAPPROVED_BUSINESS_LOGIC_CHANGE');
  }

  const before = packet.evidence.beforeScreenshots || {};
  const after = packet.evidence.afterScreenshots || {};
  for (const viewport of REQUIRED_VIEWPORTS) {
    if (!before[viewport] || !after[viewport]) throw new Error(`SCREENSHOT_EVIDENCE_REQUIRED:${viewport}`);
  }

  if (!Array.isArray(packet.evidence.functionalChecks) || packet.evidence.functionalChecks.length < 3) {
    throw new Error('FUNCTIONAL_EQUIVALENCE_EVIDENCE_REQUIRED');
  }
  if (packet.evidence.functionalChecks.some((check) => !check || check.status !== 'PASS')) {
    throw new Error('FUNCTIONAL_EQUIVALENCE_FAILED');
  }

  for (const key of Object.keys(DIMENSIONS)) asFiniteScore(packet.scores[key], key);
  return true;
}

function calculateWeightedScore(scores) {
  let total = 0;
  for (const [key, weight] of Object.entries(DIMENSIONS)) {
    total += asFiniteScore(scores[key], key) * weight / 100;
  }
  return Math.round(total * 10) / 10;
}

function evaluate(packet) {
  validatePacket(packet);
  const score = calculateWeightedScore(packet.scores);
  const blockers = Array.isArray(packet.review.blockers) ? packet.review.blockers.filter(Boolean) : [];
  const criticalFailures = CRITICAL_DIMENSIONS.filter((key) => Number(packet.scores[key]) < 90);

  let verdict;
  if (blockers.length || criticalFailures.length || score < 85) verdict = 'REJECT';
  else if (score < 92) verdict = 'REVISE';
  else if (score < 96) verdict = 'PASS_PRODUCTION';
  else verdict = 'PASS_EXCEPTIONAL';

  return {
    schemaVersion: '1.0',
    teamId: 'UIX-TEAM-015',
    runId: 'UIX-015',
    score,
    verdict,
    thresholds: { revise: 85, production: 92, exceptional: 96 },
    criticalMinimum: 90,
    criticalFailures,
    blockers,
    functionalityPreserved: packet.artifact.businessLogicChanged !== true || packet.artifact.businessLogicChangeApproved === true,
    requiredViewports: REQUIRED_VIEWPORTS,
  };
}

module.exports = { DIMENSIONS, REQUIRED_VIEWPORTS, CRITICAL_DIMENSIONS, validatePacket, calculateWeightedScore, evaluate };
