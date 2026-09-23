'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  validateContract,
  evaluateReadiness,
  evaluateReadinessBatch,
} = require('../runtime/readiness-engine.cjs');

function baseAuthority() {
  return {
    mode: 'INTERNAL_WRITE',
    externalActionAuthorized: false,
    costCeilingCents: 0,
  };
}

const demandValidation = {
  workflowId: 'amazon-demand-validation-v1',
  version: '1.0.0',
  owner: 'Run 004',
  priority: 80,
  dispatchTarget: { kind:'WORK_CONTROL_WORKER', id:'amazon-demand-validator-v1' },
  requires: [
    { fact:'asin', operator:'EXISTS' },
    { fact:'amazonUrl', operator:'EXISTS' },
  ],
  blocksIf: [],
  produces: ['demand.monthlySignal','demand.verifiedAt'],
  authority: baseAuthority(),
};

const sellerEnrichment = {
  workflowId: 'amazon-seller-enrichment-v1',
  version: '1.0.0',
  owner: 'Run 004 / Seller Graph',
  priority: 70,
  dispatchTarget: { kind:'WORK_CONTROL_WORKER', id:'amazon-seller-enrichment-v1' },
  requires: [
    { fact:'seller.id', operator:'EXISTS' },
    { fact:'listingClassification.classification', operator:'EXISTS' },
  ],
  blocksIf: [],
  produces: ['seller.type','seller.classificationConfidence'],
  authority: baseAuthority(),
};

const ppEquivalence = {
  workflowId: 'amazon-pp-equivalence-v1',
  version: '1.0.0',
  owner: 'Run 004',
  priority: 85,
  dispatchTarget: { kind:'WORK_CONTROL_WORKER', id:'amazon-pp-equivalence-v1' },
  requires: [
    { fact:'asin', operator:'EXISTS' },
    { fact:'supplierCandidate.productUrl', operator:'EXISTS' },
    { fact:'listingClassification.sourcingRoute', operator:'EXISTS' },
  ],
  blocksIf: [
    {
      fact:'listingClassification.sourcingRoute',
      operator:'IN',
      value:['STOP_NO_JUMP_ON','DEEP_CLASSIFICATION_REQUIRED'],
      reason:'Listing classification does not permit normal supplier equivalence work.',
    },
  ],
  produces: ['equivalence.productIdentity','equivalence.sellablePack'],
  authority: baseAuthority(),
};

test('valid micro-workflow contract passes validation', () => {
  assert.deepEqual(validateContract(demandValidation), { valid:true, errors:[] });
});

test('demand validation becomes READY as soon as its own ingredients exist', () => {
  const result = evaluateReadiness(demandValidation, {
    subjectId:'asin:B08TVLYB3Q',
    inputVersion:'obs-001',
    facts:{
      asin:'B08TVLYB3Q',
      amazonUrl:'https://www.amazon.com/dp/B08TVLYB3Q',
      seller:{ id:'A3QR7MJ9FCPSP7' },
    },
  });

  assert.equal(result.state, 'READY');
  assert.equal(result.ready, true);
  assert.equal(result.missing.length, 0);
  assert.equal(result.dispatchAuthorized, false);
  assert.match(result.proposedWorkKey, /^idem:v1:/);
});

test('seller enrichment waits only for its missing classification ingredient', () => {
  const result = evaluateReadiness(sellerEnrichment, {
    subjectId:'seller:A3QR7MJ9FCPSP7',
    inputVersion:'seller-shell-001',
    facts:{
      seller:{ id:'A3QR7MJ9FCPSP7', name:'HAVE ME' },
    },
  });

  assert.equal(result.state, 'WAITING');
  assert.deepEqual(result.missing.map(x => x.fact), ['listingClassification.classification']);
  assert.equal(result.proposedWorkKey, null);
});

test('seller enrichment wakes when classification evidence arrives', () => {
  const result = evaluateReadiness(sellerEnrichment, {
    subjectId:'seller:A3QR7MJ9FCPSP7',
    inputVersion:'listing-class-004',
    facts:{
      seller:{ id:'A3QR7MJ9FCPSP7', name:'HAVE ME' },
      listingClassification:{ classification:'BRAND_OWNER_DOMINATED' },
    },
  });

  assert.equal(result.state, 'READY');
  assert.equal(result.ready, true);
});

test('hard block wins over satisfied required ingredients', () => {
  const result = evaluateReadiness(ppEquivalence, {
    subjectId:'asin:B08TVLYB3Q:supplier:1',
    inputVersion:'supplier-001',
    facts:{
      asin:'B08TVLYB3Q',
      supplierCandidate:{ productUrl:'https://example.test/product/1' },
      listingClassification:{ sourcingRoute:'STOP_NO_JUMP_ON' },
    },
  });

  assert.equal(result.state, 'BLOCKED');
  assert.equal(result.ready, false);
  assert.equal(result.blockedBy.length, 1);
  assert.equal(result.blockedBy[0].reason, 'Listing classification does not permit normal supplier equivalence work.');
});

test('multiple independent micro-workflows may be READY simultaneously', () => {
  const batch = evaluateReadinessBatch([
    {
      contract:demandValidation,
      snapshot:{
        subjectId:'asin:B00939HS1I',
        inputVersion:'obs-3m-001',
        facts:{
          asin:'B00939HS1I',
          amazonUrl:'https://www.amazon.com/dp/B00939HS1I',
        },
      },
    },
    {
      contract:ppEquivalence,
      snapshot:{
        subjectId:'asin:B00939HS1I:supplier:digikey',
        inputVersion:'supplier-digikey-001',
        facts:{
          asin:'B00939HS1I',
          supplierCandidate:{ productUrl:'https://example.test/digikey/CT8BK50-C' },
          listingClassification:{ sourcingRoute:'AUTHORIZED_DISTRIBUTOR_ONLY' },
        },
      },
    },
    {
      contract:sellerEnrichment,
      snapshot:{
        subjectId:'seller:WAITING1',
        inputVersion:'seller-shell-001',
        facts:{ seller:{ id:'WAITING1' } },
      },
    },
  ]);

  assert.equal(batch.counts.READY, 2);
  assert.equal(batch.counts.WAITING, 1);
  assert.deepEqual(
    batch.ready.map(x => x.workflowId),
    ['amazon-pp-equivalence-v1','amazon-demand-validation-v1'],
  );
  assert.equal(batch.executionAuthority, 'NONE_PHASE_0_1');
});

test('same workflow + subject + input version produces the same proposed work key', () => {
  const snapshot = {
    subjectId:'asin:B08TVLYB3Q',
    inputVersion:'obs-001',
    facts:{
      asin:'B08TVLYB3Q',
      amazonUrl:'https://www.amazon.com/dp/B08TVLYB3Q',
    },
  };

  const a = evaluateReadiness(demandValidation, snapshot);
  const b = evaluateReadiness(demandValidation, snapshot);
  assert.equal(a.proposedWorkKey, b.proposedWorkKey);
});

test('input version change produces a new proposed work key', () => {
  const facts = {
    asin:'B08TVLYB3Q',
    amazonUrl:'https://www.amazon.com/dp/B08TVLYB3Q',
  };

  const a = evaluateReadiness(demandValidation, {
    subjectId:'asin:B08TVLYB3Q',
    inputVersion:'obs-001',
    facts,
  });
  const b = evaluateReadiness(demandValidation, {
    subjectId:'asin:B08TVLYB3Q',
    inputVersion:'obs-002',
    facts,
  });

  assert.notEqual(a.proposedWorkKey, b.proposedWorkKey);
});
