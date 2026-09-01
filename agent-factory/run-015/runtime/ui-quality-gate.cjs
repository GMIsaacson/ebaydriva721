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
const CRITICAL_DIMENSIONS = Object.freeze(['visualHierarchy', 'uxClarity', 'responsiveExecution', 'accessibility', 'brandDistinction']);
const NEAR_PASS_PROTECTION_THRESHOLD = 90;

const MIN_BENCHMARK_REFERENCES = 8;
const MIN_DIRECT_NICHE_REFERENCES = 4;
const MIN_ART_DIRECTIONS = 3;
const MAX_DIRECTION_SIMILARITY = 0.55;
const PORTFOLIO_REVISE_THRESHOLD = 0.65;
const CALIBRATION_MINIMUM = 90;

const BENCHMARK_COVERAGE_KEYS = Object.freeze([
  'typography',
  'palette',
  'layout',
  'density',
  'components',
  'geometry',
  'interaction',
  'dataPresentation',
  'imageryIconography',
  'mobileTransformation',
  'distinctiveIdea',
]);

const GENOME_KEYS = Object.freeze([
  'paletteTemperature',
  'primaryHueFamily',
  'accentHueFamily',
  'typographyStrategy',
  'geometry',
  'density',
  'layoutArchetype',
  'componentGrammar',
  'imageryIconography',
  'motionStyle',
  'dataVizLanguage',
]);

// Incident policies must be backed by a durable artifact plus an independently
// verified scorecard. Do not register a real assignment from chat-only or
// otherwise unpersisted scoring claims.
const REPAIR_POLICIES = Object.freeze({});

function asFiniteScore(value, key) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 100) throw new Error(`INVALID_SCORE:${key}`);
  return n;
}

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeGenomeValue(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, '-');
}

function validateGenome(genome, label = 'genome') {
  if (!genome || typeof genome !== 'object' || Array.isArray(genome)) throw new Error(`VISUAL_GENOME_REQUIRED:${label}`);
  const missing = GENOME_KEYS.filter((key) => !nonEmpty(genome[key]));
  if (missing.length) throw new Error(`VISUAL_GENOME_FIELDS_REQUIRED:${label}:${missing.join(',')}`);
  return true;
}

function genomeSimilarity(a, b) {
  validateGenome(a, 'left');
  validateGenome(b, 'right');
  let matches = 0;
  for (const key of GENOME_KEYS) {
    if (normalizeGenomeValue(a[key]) === normalizeGenomeValue(b[key])) matches += 1;
  }
  return Math.round((matches / GENOME_KEYS.length) * 1000) / 1000;
}

function validateBenchmarkResearch(packet) {
  const research = packet.benchmarkResearch;
  if (!research || typeof research !== 'object' || Array.isArray(research)) throw new Error('NICHE_BENCHMARK_RESEARCH_REQUIRED');
  if (!Array.isArray(research.sources)) throw new Error('NICHE_BENCHMARK_SOURCES_REQUIRED');

  const sparsityAccepted = research.sparsityException?.acceptedByIndependentQA === true && nonEmpty(research.sparsityException?.rationale);
  if (research.sources.length < MIN_BENCHMARK_REFERENCES && !sparsityAccepted) {
    throw new Error(`NICHE_BENCHMARK_REFERENCE_MINIMUM:${MIN_BENCHMARK_REFERENCES}`);
  }

  const direct = research.sources.filter((source) => source?.category === 'direct-niche');
  if (direct.length < MIN_DIRECT_NICHE_REFERENCES && !sparsityAccepted) {
    throw new Error(`DIRECT_NICHE_REFERENCE_MINIMUM:${MIN_DIRECT_NICHE_REFERENCES}`);
  }

  for (const [index, source] of research.sources.entries()) {
    if (!source || typeof source !== 'object') throw new Error(`BENCHMARK_SOURCE_INVALID:${index}`);
    if (!/^https?:\/\//i.test(String(source.url || ''))) throw new Error(`BENCHMARK_SOURCE_URL_REQUIRED:${index}`);
    if (!nonEmpty(source.observedAt)) throw new Error(`BENCHMARK_SOURCE_DATE_REQUIRED:${index}`);
    if (!['direct-niche', 'adjacent-pattern'].includes(source.category)) throw new Error(`BENCHMARK_SOURCE_CATEGORY_INVALID:${index}`);
    if (!nonEmpty(source.distinctiveIdea)) throw new Error(`BENCHMARK_DISTINCTIVE_IDEA_REQUIRED:${index}`);
  }

  const coverage = research.coverage || {};
  const missingCoverage = BENCHMARK_COVERAGE_KEYS.filter((key) => coverage[key] !== true);
  if (missingCoverage.length) throw new Error(`BENCHMARK_COVERAGE_INCOMPLETE:${missingCoverage.join(',')}`);

  if (!Array.isArray(research.typographyFamiliesObserved) || research.typographyFamiliesObserved.length === 0) {
    throw new Error('BENCHMARK_TYPOGRAPHY_OBSERVATIONS_REQUIRED');
  }
  if (!Array.isArray(research.nonCopyingPrinciples) || research.nonCopyingPrinciples.length < 3) {
    throw new Error('BENCHMARK_NON_COPYING_PRINCIPLES_REQUIRED');
  }

  return {
    sources: research.sources.length,
    directNicheSources: direct.length,
    sparsityExceptionAccepted: sparsityAccepted,
  };
}

function validateArtDirection(packet) {
  const art = packet.artDirection;
  if (!art || typeof art !== 'object' || Array.isArray(art)) throw new Error('ART_DIRECTION_EVIDENCE_REQUIRED');
  if (!Array.isArray(art.directions) || art.directions.length < MIN_ART_DIRECTIONS) {
    throw new Error(`ART_DIRECTION_MINIMUM:${MIN_ART_DIRECTIONS}`);
  }
  if (!nonEmpty(art.selectedDirectionId)) throw new Error('SELECTED_ART_DIRECTION_REQUIRED');

  const ids = new Set();
  for (const [index, direction] of art.directions.entries()) {
    if (!direction || typeof direction !== 'object') throw new Error(`ART_DIRECTION_INVALID:${index}`);
    if (!nonEmpty(direction.id)) throw new Error(`ART_DIRECTION_ID_REQUIRED:${index}`);
    if (ids.has(direction.id)) throw new Error(`ART_DIRECTION_ID_DUPLICATE:${direction.id}`);
    ids.add(direction.id);
    validateGenome(direction.genome, direction.id);
    if (!Array.isArray(direction.fontFamilies) || direction.fontFamilies.length === 0 || !direction.fontFamilies.every(nonEmpty)) {
      throw new Error(`ART_DIRECTION_FONT_FAMILIES_REQUIRED:${direction.id}`);
    }
  }

  const selected = art.directions.find((direction) => direction.id === art.selectedDirectionId);
  if (!selected) throw new Error('SELECTED_ART_DIRECTION_NOT_FOUND');

  const failures = [];
  const pairwise = [];
  for (let i = 0; i < art.directions.length; i += 1) {
    for (let j = i + 1; j < art.directions.length; j += 1) {
      const left = art.directions[i];
      const right = art.directions[j];
      const similarity = genomeSimilarity(left.genome, right.genome);
      pairwise.push({ left: left.id, right: right.id, similarity });
      if (similarity > MAX_DIRECTION_SIMILARITY) failures.push(`ART_DIRECTION_TOO_SIMILAR:${left.id}:${right.id}:${similarity}`);
    }
  }

  const typographySignatures = new Set(art.directions.map((direction) => direction.fontFamilies.map((x) => x.trim().toLowerCase()).sort().join('|')));
  if (typographySignatures.size === 1 && art.typographyLockedByBrand !== true) {
    failures.push('ART_DIRECTION_TYPOGRAPHY_NOT_DIVERGENT');
  }

  const diversityExceptionAccepted = art.diversityException?.acceptedByIndependentQA === true && nonEmpty(art.diversityException?.rationale);
  return {
    selected,
    pairwise,
    typographySignatureCount: typographySignatures.size,
    diversityExceptionAccepted,
    failures: diversityExceptionAccepted ? [] : failures,
  };
}

function validatePortfolio(packet, selectedDirection) {
  const history = packet.portfolioHistory;
  if (!Array.isArray(history)) throw new Error('PORTFOLIO_HISTORY_REQUIRED');

  const comparisons = [];
  const failures = [];
  for (const [index, entry] of history.entries()) {
    if (!entry || typeof entry !== 'object') throw new Error(`PORTFOLIO_ENTRY_INVALID:${index}`);
    if (!nonEmpty(entry.productId)) throw new Error(`PORTFOLIO_PRODUCT_ID_REQUIRED:${index}`);
    validateGenome(entry.genome, `portfolio:${entry.productId}`);
    const similarity = genomeSimilarity(selectedDirection.genome, entry.genome);
    const related = entry.relatedBrand === true;
    comparisons.push({ productId: entry.productId, relatedBrand: related, similarity });
    if (!related && similarity > PORTFOLIO_REVISE_THRESHOLD) {
      failures.push(`PORTFOLIO_SIMILARITY_HIGH:${entry.productId}:${similarity}`);
    }
  }

  const exceptionAccepted = packet.portfolioSimilarityException?.acceptedByIndependentQA === true &&
    nonEmpty(packet.portfolioSimilarityException?.rationale) &&
    !/^(premium|professional|clean|enterprise)$/i.test(packet.portfolioSimilarityException.rationale.trim());

  return {
    comparisons,
    exceptionAccepted,
    failures: exceptionAccepted ? [] : failures,
  };
}

function validateCalibration(packet) {
  const calibration = packet.calibration;
  if (!calibration || typeof calibration !== 'object' || Array.isArray(calibration)) throw new Error('UIX_CALIBRATION_REQUIRED');
  const nicheAppropriateness = asFiniteScore(calibration.nicheAppropriateness, 'calibration.nicheAppropriateness');
  const portfolioDistinction = asFiniteScore(calibration.portfolioDistinction, 'calibration.portfolioDistinction');
  const failures = [];
  if (nicheAppropriateness < CALIBRATION_MINIMUM) failures.push('NICHE_APPROPRIATENESS_UNDER_90');
  if (portfolioDistinction < CALIBRATION_MINIMUM) failures.push('PORTFOLIO_DISTINCTION_UNDER_90');
  return { nicheAppropriateness, portfolioDistinction, failures };
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
  validateBenchmarkResearch(packet);
  validateCalibration(packet);
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
  const artDirection = validateArtDirection(packet);
  const portfolio = validatePortfolio(packet, artDirection.selected);
  const calibration = validateCalibration(packet);
  const repair = validateRepairControl(packet, score);

  let verdict;
  if (blockers.length || criticalFailures.length || repair.failures.length || score < 85) verdict = 'REJECT';
  else if (artDirection.failures.length || portfolio.failures.length || calibration.failures.length) verdict = 'REVISE';
  else if (repair.active && !repair.improvesBaseline) verdict = 'REVISE';
  else if (score < 92) verdict = 'REVISE';
  else if (score < 96) verdict = 'PASS_PRODUCTION';
  else verdict = 'PASS_EXCEPTIONAL';

  return {
    schemaVersion: '1.3',
    teamId: 'UIX-TEAM-015',
    runId: 'UIX-015',
    score,
    verdict,
    thresholds: { revise: 85, production: 92, exceptional: 96 },
    criticalMinimum: 90,
    criticalFailures,
    blockers,
    benchmarkResearch: validateBenchmarkResearch(packet),
    artDirection: {
      selectedDirectionId: artDirection.selected.id,
      pairwiseSimilarity: artDirection.pairwise,
      typographySignatureCount: artDirection.typographySignatureCount,
      failures: artDirection.failures,
    },
    portfolioSimilarity: portfolio,
    calibration,
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
  MIN_BENCHMARK_REFERENCES,
  MIN_DIRECT_NICHE_REFERENCES,
  MIN_ART_DIRECTIONS,
  MAX_DIRECTION_SIMILARITY,
  PORTFOLIO_REVISE_THRESHOLD,
  CALIBRATION_MINIMUM,
  BENCHMARK_COVERAGE_KEYS,
  GENOME_KEYS,
  REPAIR_POLICIES,
  validateGenome,
  genomeSimilarity,
  validateBenchmarkResearch,
  validateArtDirection,
  validatePortfolio,
  validateCalibration,
  validatePacket,
  validateRepairControl,
  validateRepairControlAgainstPolicy,
  calculateWeightedScore,
  evaluate,
};
