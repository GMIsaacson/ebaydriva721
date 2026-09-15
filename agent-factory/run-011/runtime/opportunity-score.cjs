'use strict';

const DIMENSIONS = Object.freeze({
  severityOfPain: 15,
  frequencyRepetition: 10,
  evidencePeoplePay: 15,
  remedyEffectiveness: 15,
  factoryAutomationPotential: 15,
  grossMarginPotential: 10,
  acquisitionFeasibility: 10,
  defensibilityDataAdvantage: 5,
  regulatoryViability: 5,
});

const DECISIONS = Object.freeze({
  KILL: 'KILL',
  WATCH: 'WATCH',
  CONTROLLED_PROBE: 'CONTROLLED_PROBE',
  SERIOUS_INVESTIGATION: 'SERIOUS_INVESTIGATION',
});

function assertScore(name, value) {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error(`${name} must be a finite number from 0 to 100`);
  }
}

function decisionFor(score) {
  if (score >= 80) return DECISIONS.SERIOUS_INVESTIGATION;
  if (score >= 70) return DECISIONS.CONTROLLED_PROBE;
  if (score >= 55) return DECISIONS.WATCH;
  return DECISIONS.KILL;
}

function scoreOpportunity(candidate) {
  if (!candidate || typeof candidate !== 'object') throw new Error('candidate is required');
  const dimensions = candidate.dimensions || {};
  let weighted = 0;
  for (const [name, weight] of Object.entries(DIMENSIONS)) {
    const value = Number(dimensions[name]);
    assertScore(name, value);
    weighted += value * weight;
  }

  const rawScore = Number((weighted / 100).toFixed(1));
  const evidenceLinks = Array.isArray(candidate.evidenceLinks)
    ? candidate.evidenceLinks.filter((x) => typeof x === 'string' && x.trim())
    : [];
  const hasKillCriteria = Array.isArray(candidate.killCriteria) && candidate.killCriteria.length > 0;

  let decision = decisionFor(rawScore);
  const reasons = [];

  if (evidenceLinks.length === 0 && decision !== DECISIONS.KILL) {
    decision = DECISIONS.WATCH;
    reasons.push('Decision capped at WATCH because no evidence links were supplied.');
  }
  if (!hasKillCriteria && [DECISIONS.CONTROLLED_PROBE, DECISIONS.SERIOUS_INVESTIGATION].includes(decision)) {
    decision = DECISIONS.WATCH;
    reasons.push('Decision capped at WATCH because no explicit kill criteria were supplied.');
  }

  return {
    score: rawScore,
    decision,
    evidenceCount: evidenceLinks.length,
    confidence: evidenceLinks.length >= 3 ? 'MEDIUM' : evidenceLinks.length >= 1 ? 'LOW' : 'UNVERIFIED',
    reasons,
    weights: DIMENSIONS,
  };
}

module.exports = { DIMENSIONS, DECISIONS, scoreOpportunity, decisionFor };
