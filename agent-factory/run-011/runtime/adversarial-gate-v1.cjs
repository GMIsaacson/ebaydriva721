'use strict';

const GATE_VERSION = '1.0';
const MIN_CRITICAL_ASSUMPTIONS = 5;
const MAX_CRITICAL_ASSUMPTIONS = 10;
const WEAKEST_LINK_THRESHOLD = 60;
const EVIDENCE_STATES = Object.freeze(['P', 'I', 'A', 'U']);
const PROMOTION_DECISIONS = Object.freeze(['KILL', 'HOLD', 'ADVANCE']);
const C8_STATUSES = Object.freeze(['NOT_READY', 'READY', 'TESTING', 'PASSED', 'FAILED']);
const C9_STATUSES = Object.freeze(['NOT_ELIGIBLE', 'ELIGIBLE']);
const DIMENSION_FIELDS = Object.freeze([
  'evidenceInputReality',
  'economicReality',
  'buyerReality',
  'acquisitionReality',
  'competitiveReality',
  'factoryAdvantage',
  'tinyTestReadiness',
]);

const validDimensionScore = (value) => Number.isInteger(value) && value >= 0 && value <= 100;
const validDate = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);

function calculateWeakestLink(dimensions) {
  if (!dimensions || DIMENSION_FIELDS.some((field) => !validDimensionScore(dimensions[field]))) {
    throw new Error('all adversarial gate dimensions must be integers 0-100');
  }
  return Math.min(...DIMENSION_FIELDS.map((field) => dimensions[field]));
}

function summarizeAssumptions(assumptions) {
  const summary = { P: 0, I: 0, A: 0, U: 0, existentialUnresolved: 0 };
  for (const item of Array.isArray(assumptions) ? assumptions : []) {
    if (EVIDENCE_STATES.includes(item?.state)) summary[item.state] += 1;
    if (item?.existential === true && ['A', 'U'].includes(item?.state)) summary.existentialUnresolved += 1;
  }
  return summary;
}

function validateAdversarialGate(gate) {
  const violations = [];
  if (!gate || typeof gate !== 'object') return ['adversarial gate receipt missing'];
  if (gate.version !== GATE_VERSION) violations.push('wrong adversarial gate version');
  if (!PROMOTION_DECISIONS.includes(gate.promotionDecision)) violations.push('promotion decision missing');
  if (!C8_STATUSES.includes(gate.c8Status)) violations.push('C8 status missing');
  if (!C9_STATUSES.includes(gate.c9Status)) violations.push('C9 status missing');
  if (!validDate(gate.evidenceFreshnessDate)) violations.push('evidence freshness date missing');

  if (!Array.isArray(gate.criticalAssumptions)) {
    violations.push('critical assumptions missing');
  } else {
    if (gate.criticalAssumptions.length < MIN_CRITICAL_ASSUMPTIONS || gate.criticalAssumptions.length > MAX_CRITICAL_ASSUMPTIONS) {
      violations.push(`critical assumptions must contain ${MIN_CRITICAL_ASSUMPTIONS}-${MAX_CRITICAL_ASSUMPTIONS} items`);
    }
    gate.criticalAssumptions.forEach((item, index) => {
      if (!item || typeof item !== 'object') return violations.push(`critical assumption ${index} invalid`);
      if (typeof item.statement !== 'string' || item.statement.trim().length < 8) violations.push(`critical assumption ${index} statement missing`);
      if (!EVIDENCE_STATES.includes(item.state)) violations.push(`critical assumption ${index} evidence state invalid`);
      if (typeof item.existential !== 'boolean') violations.push(`critical assumption ${index} existential flag missing`);
      if (item.state === 'P' && (typeof item.evidenceRef !== 'string' || item.evidenceRef.trim().length < 3)) violations.push(`critical assumption ${index} proven state requires evidenceRef`);
    });
  }

  if (!gate.dimensions || DIMENSION_FIELDS.some((field) => !validDimensionScore(gate.dimensions[field]))) {
    violations.push('invalid adversarial gate dimensions');
  } else if (gate.claimedWeakestLinkScore !== undefined && Number(gate.claimedWeakestLinkScore) !== calculateWeakestLink(gate.dimensions)) {
    violations.push('weakest-link score mismatch');
  }

  if (['HOLD', 'KILL'].includes(gate.promotionDecision)) {
    if (typeof gate.failureReason !== 'string' || gate.failureReason.trim().length < 8) violations.push('failure reason missing');
    if (typeof gate.restartCondition !== 'string' || gate.restartCondition.trim().length < 8) violations.push('restart condition missing');
  }

  return [...new Set(violations)];
}

function evaluateAdversarialCandidate(candidate) {
  const gate = candidate?.adversarialGate;
  const violations = validateAdversarialGate(gate);
  if (violations.length) {
    return { valid: false, reason: 'adversarial_gate_schema_invalid', violations, promotionEligible: false };
  }

  const weakestLinkScore = calculateWeakestLink(gate.dimensions);
  const assumptionSummary = summarizeAssumptions(gate.criticalAssumptions);
  const base = {
    valid: true,
    promotionDecision: gate.promotionDecision,
    weakestLinkScore,
    assumptionSummary,
    c8Status: gate.c8Status,
    c9Status: gate.c9Status,
    promotionEligible: false,
  };

  if (gate.promotionDecision === 'ADVANCE') {
    if (candidate?.fatalRisk === true) return { ...base, valid: false, reason: 'fatal_risk_blocks_advance' };
    if (weakestLinkScore < WEAKEST_LINK_THRESHOLD) return { ...base, valid: false, reason: 'weakest_link_below_threshold' };
    if (assumptionSummary.existentialUnresolved > 0) return { ...base, valid: false, reason: 'existential_assumption_unresolved' };
    if (gate.c8Status !== 'PASSED') return { ...base, valid: false, reason: 'C8_not_passed' };
    if (gate.c9Status !== 'ELIGIBLE') return { ...base, valid: false, reason: 'C9_not_eligible' };
    return { ...base, routeCeiling: 'Escalate', promotionEligible: true };
  }

  if (gate.c9Status !== 'NOT_ELIGIBLE') return { ...base, valid: false, reason: 'non_advance_C9_must_be_not_eligible' };
  if (gate.promotionDecision === 'HOLD') return { ...base, routeCeiling: 'Watch' };
  return { ...base, routeCeiling: 'Archive' };
}

function isPromotionReceiptEligible(receipt) {
  return Boolean(
    receipt &&
    receipt.schemaVersion === 'adversarial_opportunity_gate_v1' &&
    receipt.promotionDecision === 'ADVANCE' &&
    receipt.promotionEligible === true &&
    Number.isInteger(receipt.weakestLinkScore) &&
    receipt.weakestLinkScore >= WEAKEST_LINK_THRESHOLD &&
    receipt.c8Status === 'PASSED' &&
    receipt.c9Status === 'ELIGIBLE'
  );
}

function makePromotionReceipt(candidateId, evaluation) {
  if (!evaluation || evaluation.valid !== true) return null;
  return {
    schemaVersion: 'adversarial_opportunity_gate_v1',
    version: GATE_VERSION,
    candidateId,
    promotionDecision: evaluation.promotionDecision,
    weakestLinkScore: evaluation.weakestLinkScore,
    assumptionSummary: evaluation.assumptionSummary,
    c8Status: evaluation.c8Status,
    c9Status: evaluation.c9Status,
    promotionEligible: evaluation.promotionEligible === true,
  };
}

module.exports = {
  C8_STATUSES,
  C9_STATUSES,
  DIMENSION_FIELDS,
  EVIDENCE_STATES,
  GATE_VERSION,
  MAX_CRITICAL_ASSUMPTIONS,
  MIN_CRITICAL_ASSUMPTIONS,
  PROMOTION_DECISIONS,
  WEAKEST_LINK_THRESHOLD,
  calculateWeakestLink,
  evaluateAdversarialCandidate,
  isPromotionReceiptEligible,
  makePromotionReceipt,
  summarizeAssumptions,
  validateAdversarialGate,
};
