'use strict';

const fixture = require('../fixtures/g5-shadow.json');
const { processPacket } = require('../runtime/runtime.cjs');

const result = processPacket(fixture);
const expectedById = new Map(fixture.candidates.map((candidate) => [candidate.candidateId, candidate.expectedRoute]));
const routeChecks = result.results.map((item) => ({
  candidateId: item.candidateId,
  expectedRoute: expectedById.get(item.candidateId),
  actualRoute: item.route,
  match: item.status === 'Pass' && item.route === expectedById.get(item.candidateId),
  deterministicScore: item.deterministicScore,
}));
const parityMatches = routeChecks.filter((item) => item.match).length;
const shadow = {
  ...result,
  shadow: {
    sourceSet: 'Calibration 001 — The Koerner Office',
    realPublicEvidence: true,
    normalizedInputsPreviouslyOwnerSupervised: true,
    autonomousSourceInterpretationDemonstrated: false,
    routeChecks,
    parityMatches,
    parityTotal: fixture.candidates.length,
    routeParity: parityMatches === fixture.candidates.length ? 'Pass' : 'Fail',
  },
};
if (shadow.status !== 'Pass') throw new Error('G5 runtime result was not Pass');
if (shadow.shadow.routeParity !== 'Pass') throw new Error(`G5 route parity ${parityMatches}/${fixture.candidates.length}`);
if (shadow.summary.escalated !== 2 || shadow.summary.watched !== 7 || shadow.summary.archived !== 1 || shadow.summary.blocked !== 0) throw new Error('G5 routing summary mismatch');
if (shadow.summary.duplicatesSuppressed !== 3) throw new Error('G5 duplicate-suppression count mismatch');
if (shadow.externalActions !== 0 || shadow.canonicalPortfolioWrites !== 0 || shadow.aiCalls !== 0 || shadow.incrementalCostUsd !== 0) throw new Error('G5 authority/cost boundary changed');
process.stdout.write(JSON.stringify(shadow, null, 2) + '\n');
