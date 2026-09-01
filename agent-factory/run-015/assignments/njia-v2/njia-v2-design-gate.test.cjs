'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const gate = require('../../runtime/ui-quality-gate.cjs');

const assignment = JSON.parse(fs.readFileSync(path.join(__dirname, '01-benchmark-art-direction.json'), 'utf8'));
const registry = JSON.parse(fs.readFileSync(path.join(__dirname, '../../portfolio/visual-genome-registry.json'), 'utf8'));

assert.equal(assignment.schemaVersion, '1.0');
assert.equal(assignment.assignmentId, 'UIX-015-NJIA-V2-001');
assert.equal(assignment.lockedBaseline.commit, '48383a9af1c72f7e2e0128b734265581bab3f324');
assert.equal(assignment.lockedBaseline.score, 93.4);
assert.equal(assignment.implementationAuthority.approved, true);
assert.deepEqual(assignment.implementationAuthority.allowedSurfaces, ['styles.css']);
assert.equal(assignment.implementationAuthority.htmlContentArchitectureChange, false);
assert.equal(assignment.implementationAuthority.businessLogicChange, false);
assert.equal(assignment.implementationAuthority.productionPromotion, false);

const benchmark = gate.validateBenchmarkResearch({ benchmarkResearch: assignment.benchmarkResearch });
assert(benchmark.sources >= 8);
assert(benchmark.directNicheSources >= 4);

const art = gate.validateArtDirection({ artDirection: assignment.artDirection });
assert.equal(art.failures.length, 0);
assert(art.typographySignatureCount >= 3);
assert(art.pairwise.every((row) => row.similarity <= gate.MAX_DIRECTION_SIMILARITY));
assert.equal(art.selected.id, assignment.artDirection.selectedDirectionId);

const portfolioHistory = registry.entries.map((entry) => ({
  productId: entry.productId,
  relatedBrand: false,
  genome: entry.genome,
}));
const portfolio = gate.validatePortfolio({ portfolioHistory }, art.selected);
assert.equal(portfolio.failures.length, 0);
assert(portfolio.comparisons.every((row) => row.similarity <= gate.PORTFOLIO_REVISE_THRESHOLD));

// This rerun specifically exists to break the observed Asteron/Njia-v1 house-style convergence.
const expectedComparisons = new Map(assignment.portfolioComparison.comparisons.map((row) => [row.productId, row]));
for (const productId of ['asteron', 'njia-v1']) {
  assert(expectedComparisons.has(productId));
  assert(expectedComparisons.get(productId).similarity <= gate.PORTFOLIO_REVISE_THRESHOLD);
}

console.log(JSON.stringify({
  status: 'PASS',
  assignmentId: assignment.assignmentId,
  benchmarkSources: benchmark.sources,
  directNicheSources: benchmark.directNicheSources,
  directions: assignment.artDirection.directions.length,
  typographySignatures: art.typographySignatureCount,
  pairwiseSimilarity: art.pairwise,
  portfolioSimilarity: portfolio.comparisons,
  selectedDirection: art.selected.id,
  lockedBaselineScore: assignment.lockedBaseline.score,
}, null, 2));
