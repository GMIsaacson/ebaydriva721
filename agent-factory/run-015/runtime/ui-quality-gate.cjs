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
const NEAR_PASS_PROTECTION_THRESHOLD = 90;

// Incident policies must be backed by a durable artifact plus an independently
// verified scorecard. Do not register a real assignment from chat-only or
// otherwise unpersisted scoring claims.
const REPAIR_POLICIES = Object.freeze({});

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

function validateRepairControlAgainstPolicy(packet, score, policy) {
  const control = packet.repairControl;
  if (!policy || typeof policy !== 'object') throw new Error('REPAIR_POLICY_NOT_APPROVED');

  const artifactHash = String(policy.baselineArtifactHash || '');
  if (!artifactHash) throw new Error('REPAIR_POLICY_BASELINE_UNBOUND');
  if (!/^[a-f0-9]{64}$/i.test(artifactHash)) throw new Error('REPAIR_POLICY_BASELINE_HASH_INVALID');

  const parentArtifactHash = String(control.parentArtifactHash || '');
  if (!/^[a-f0-9]{64}$/i.test(parentArtifactHash)) throw new Error('REPAIR_PARENT_FULL_HASH_REQUIRED');

  const baselineOverall = asFiniteScore(policy.baselineOverallScore, 'policy.baselineOverallScore');
  const baselineVisual = asFiniteScore(policy.baselineVisualScore, 'policy.baselineVisualScore');
  const candidateVisual = asFiniteScore(packet.review.visualScore, 'review.visualScore');

  if (!Array.isArray(control.changedSurfaces) || control.changedSurfaces.length === 0) {
    throw new Error('REPAIR_CHANGED_SURFACES_REQUIRED');
  }
  if (!Array.isArray(policy.allowedSurfaces) || policy.allowedSurfaces.length === 0) {
    throw new Error('REPAIR_POLICY_SURFACES_REQUIRED');
  }
  if (!Array.isArray(policy.requiredPassingCheckIds) || policy.requiredPassingCheckIds.length < 3) {
    throw new Error('REPAIR_POLICY_PASSING_CHECKS_REQUIRED');
  }

  const failures = [];
  if (parentArtifactHash.toLowerCase() !== artifactHash.toLowerCase()) failures.push('REPAIR_PARENT_NOT_BASELINE');

  const allowed = new Set(policy.allowedSurfaces.map(String));
  const outOfScope = control.changedSurfaces.map(String).filter((surface) => !allowed.has(surface));
  if (outOfScope.length) failures.push(`REPAIR_OUT_OF_SCOPE:${outOfScope.join(',')}`);

  const currentChecks = new Map(packet.evidence.functionalChecks.map((check) => [String(check.id || ''), check.status]));
  const droppedChecks = policy.requiredPassingCheckIds.map(String).filter((id) => currentChecks.get(id) !== 'PASS');
  if (droppedChecks.length) failures.push(`REPAIR_PREVIOUS_CHECK_REGRESSION:${droppedChecks.join(',')}`);

  if (baselineOverall >= NEAR_PASS_PROTECTION_THRESHOLD) {
    if (score < baselineOverall) failures.push('REPAIR_OVERALL_SCORE_REGRESSION');
    if (candidateVisual < baselineVisual) failures.push('REPAIR_VISUAL_SCORE_REGRESSION');
  }

  const dimensionFailures = Object.keys(DIMENSIONS).filter((key) => Number(packet.scores[key]) < 90);
  if (dimensionFailures.length) failures.push(`REPAIR_DIMENSION_UNDER_90:${dimensionFailures.join(',')}`);

  return {
    active: true,
    policyId: String(control.policyId),
    baselineArtifactHash: artifactHash,
    baselineOverall,
    baselineVisual,
    candidateVisual,
    allowedSurfaces: [...policy.allowedSurfaces],
    failures,
    allDimensionsAtLeast90: dimensionFailures.length === 0,
    improvesBaseline: score > baselineOverall,
    parentMatchesBaseline: parentArtifactHash.toLowerCase() === artifactHash.toLowerCase(),
  };
}

function validateRepairControl(packet, score) {
  const control = packet.repairControl;
  if (control == null) return { active: false, failures: [], allDimensionsAtLeast90: true };
  if (!control || typeof control !== 'object' || Array.isArray(control)) throw new Error('REPAIR_CONTROL_INVALID');
  const policyId = String(control.policyId || '');
  if (!policyId) throw new Error('REPAIR_POLICY_ID_REQUIRED');
  const policy = REPAIR_POLICIES[policyId];
  if (!policy) throw new Error('REPAIR_POLICY_NOT_APPROVED');
  return validateRepairControlAgainstPolicy(packet, score, policy);
}

function evaluate(packet) {
  validatePacket(packet);
  const score = calculateWeightedScore(packet.scores);
  const blockers = Array.isArray(packet.review.blockers) ? packet.review.blockers.filter(Boolean) : [];
  const criticalFailures = CRITICAL_DIMENSIONS.filter((key) => Number(packet.scores[key]) < 90);
  const repair = validateRepairControl(packet, score);

  let verdict;
  if (blockers.length || criticalFailures.length || repair.failures.length || score < 85) verdict = 'REJECT';
  else if (repair.active && !repair.improvesBaseline) verdict = 'REVISE';
  else if (score < 92) verdict = 'REVISE';
  else if (score < 96) verdict = 'PASS_PRODUCTION';
  else verdict = 'PASS_EXCEPTIONAL';

  return {
    schemaVersion: '1.2',
    teamId: 'UIX-TEAM-015',
    runId: 'UIX-015',
    score,
    verdict,
    thresholds: { revise: 85, production: 92, exceptional: 96 },
    criticalMinimum: 90,
    criticalFailures,
    blockers,
    repairControl: repair,
    functionalityPreserved: packet.artifact.businessLogicChanged !== true || packet.artifact.businessLogicChangeApproved === true,
    requiredViewports: REQUIRED_VIEWPORTS,
  };
}

module.exports = {
  DIMENSIONS,
  REQUIRED_VIEWPORTS,
  CRITICAL_DIMENSIONS,
  NEAR_PASS_PROTECTION_THRESHOLD,
  REPAIR_POLICIES,
  validatePacket,
  validateRepairControl,
  validateRepairControlAgainstPolicy,
  calculateWeightedScore,
  evaluate,
};
