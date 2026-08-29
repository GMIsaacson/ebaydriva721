'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { evaluateProfessionalCapabilityMatrix } = require('../../core/professional-capability-gate.cjs');

const root = path.resolve(__dirname, '..');
const matrix = JSON.parse(fs.readFileSync(path.join(root, 'professional-capability-matrix.json'), 'utf8'));
const routing = JSON.parse(fs.readFileSync(path.join(root, 'config', 'domain-specialist-routing.json'), 'utf8'));
const taxonomy = JSON.parse(fs.readFileSync(path.join(root, 'config', 'technology-taxonomy.json'), 'utf8'));

test('Run 016 professional capability matrix passes executable G2.5', () => {
  const result = evaluateProfessionalCapabilityMatrix(matrix);
  assert.equal(result.status, 'PASS');
  assert.equal(result.blockedStageCount, 0);
  assert.equal(result.acceptedLimitationCount, 0);
});

test('every governed technology domain resolves to an on-demand specialist pool', () => {
  const routed = new Set(routing.specialistPools.flatMap((pool) => pool.domains || []));
  const missing = taxonomy.domains.map((d) => d.id).filter((id) => !routed.has(id));
  assert.deepEqual(missing, []);
});

test('general technology analyst is not accepted as routed specialist evidence', () => {
  assert.equal(routing.routingRequirements.generalAnalystCountsAsSpecialist, false);
  assert.ok(!routing.specialistPools.some((pool) => pool.id === 'world-technology-intelligence-general-tech-analyst-016'));
});

test('medicine and biotech have dedicated clinical/scientific specialist and independent review', () => {
  const clinical = routing.specialistPools.find((p) => p.id === 'wti-clinical-medicine-specialist');
  const biotech = routing.specialistPools.find((p) => p.id === 'wti-biotech-specialist');
  const review = routing.independentReviewPools.find((p) => p.id === 'wti-clinical-evidence-reviewer');
  assert.ok(clinical.domains.includes('medicine-healthcare'));
  assert.ok(biotech.domains.includes('biotech-synthetic-biology'));
  assert.ok(review.covers.includes('medicine-healthcare'));
  assert.ok(review.covers.includes('biotech-synthetic-biology'));
  assert.equal(routing.routingRequirements.medicalClinicalRequiresDedicatedReview, true);
});

test('defense/dual-use has dedicated analyst and independent evidence reviewer', () => {
  const analyst = routing.specialistPools.find((p) => p.id === 'wti-defense-dual-use-specialist');
  const review = routing.independentReviewPools.find((p) => p.id === 'wti-defense-evidence-reviewer');
  assert.ok(analyst.domains.includes('defense-dual-use'));
  assert.ok(review.covers.includes('defense-dual-use'));
  assert.notEqual(analyst.id, review.id);
  assert.equal(routing.routingRequirements.defenseDualUseRequiresDedicatedReview, true);
});

test('cross-domain stories require every material specialist route', () => {
  assert.equal(routing.routingRequirements.crossDomainRequiresAllMaterialDomains, true);
});

test('price claims require independent price and availability review', () => {
  assert.equal(routing.routingRequirements.priceClaimRequiresPriceAvailabilityReview, true);
  assert.ok(routing.independentReviewPools.some((p) => p.id === 'wti-price-availability-reviewer'));
});

test('emerging/unclassified cannot self-certify expertise', () => {
  const emerging = routing.specialistPools.find((p) => (p.domains || []).includes('emerging-unclassified'));
  assert.ok(emerging);
  assert.equal(routing.routingRequirements.emergingUnclassifiedCannotSelfCertifyExpertise, true);
  assert.match(emerging.rule, /may not claim deep domain interpretation/i);
});

test('specialist routing grants no new external authority or spend', () => {
  assert.equal(routing.routingRequirements.externalActions, 0);
  assert.equal(routing.routingRequirements.maxSpendCents, 0);
});
