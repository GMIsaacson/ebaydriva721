'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const registry = require('../live-sourcing/source-access-registry.json');
const { ingestAuthorizedDataset } = require('../runtime/product-intake.cjs');
const { prescreenCandidatesV2 } = require('../runtime/prescreen-v2.cjs');

const observedAt = '2026-08-18T03:10:00Z';
const csv = [
  'title,supplier,sku,mpn,brand,cost,moq,stock,weight_oz,length,width,height,source_url',
  'Part Alpha,Demo Supply,A-1,MP-A,Demo,12.50,1,30,8,5,4,2,https://supplier.example/a',
  'Part Beta,Demo Supply,B-2,MP-B,Demo,28.00,2,20,16,8,6,4,https://supplier.example/b',
  'Ambiguous Part,Demo Supply,,,Demo,5.00,1,10,,,,,',
  'Expensive Part,Demo Supply,E-9,MP-E,Demo,150.00,1,5,12,5,4,3,https://supplier.example/e',
].join('\n');

async function browserCore() {
  return import('../../../src/liveSourcing/browser-core.mjs');
}

async function browserPrescreen() {
  return import('../../../src/liveSourcing/prescreen-v2.mjs');
}

test('browser intake produces the same canonical IDs and normalized records as authoritative CJS intake', async () => {
  const browser = await browserCore();
  const authoritative = ingestAuthorizedDataset({
    registry,
    ownerAttestation: true,
    uploadedBy: 'OWNER-ABERDEEN',
    observedAt,
    fileName: 'parity.csv',
    content: csv,
  });
  const client = await browser.ingestBrowserDataset({
    ownerAttestation: true,
    uploadedBy: 'OWNER-ABERDEEN',
    observedAt,
    fileName: 'parity.csv',
    content: csv,
  });

  assert.equal(client.inputCount, authoritative.inputCount);
  assert.equal(client.acceptedCount, authoritative.acceptedCount);
  assert.equal(client.duplicateCount, authoritative.duplicateCount);
  assert.equal(client.invalidCount, authoritative.invalidCount);
  assert.equal(client.reviewCount, authoritative.reviewCount);
  assert.equal(client.datasetHash, authoritative.datasetHash);
  assert.deepEqual(
    client.records.map((record) => ({
      candidateId: record.candidateId,
      identity: record.productIdentityKey,
      confidence: record.identityConfidence,
      offerKey: record.offerKey,
      cost: record.unitCostCents,
      moq: record.moq,
      weight: record.weightOz,
    })),
    authoritative.records.map((record) => ({
      candidateId: record.candidateId,
      identity: record.productIdentityKey,
      confidence: record.identityConfidence,
      offerKey: record.offerKey,
      cost: record.unitCostCents,
      moq: record.moq,
      weight: record.weightOz,
    })),
  );
});

test('browser prescreen v2 queue, scores and dispositions match authoritative CJS prescreen v2', async () => {
  const browser = await browserCore();
  const browserRanker = await browserPrescreen();
  const authoritativeIntake = ingestAuthorizedDataset({
    registry,
    ownerAttestation: true,
    uploadedBy: 'OWNER-ABERDEEN',
    observedAt,
    fileName: 'parity.csv',
    content: csv,
  });
  const clientIntake = await browser.ingestBrowserDataset({
    ownerAttestation: true,
    uploadedBy: 'OWNER-ABERDEEN',
    observedAt,
    fileName: 'parity.csv',
    content: csv,
  });
  const policy = {
    maxVerificationQueue: 1,
    maxSourceCostCents: 5000,
    maxInitialOutlayCents: 10000,
    excludedTerms: [],
  };
  const authoritative = prescreenCandidatesV2(authoritativeIntake.records, policy);
  const client = browserRanker.prescreenBrowserCandidates(clientIntake.records, policy);

  assert.deepEqual(client.verificationQueue.map((item) => item.candidateId), authoritative.verificationQueue.map((item) => item.candidateId));
  assert.deepEqual(client.verificationQueue.map((item) => item.opportunityScore), authoritative.verificationQueue.map((item) => item.opportunityScore));
  assert.deepEqual(client.verificationQueue.map((item) => item.evidenceConfidence), authoritative.verificationQueue.map((item) => item.evidenceConfidence));
  assert.deepEqual(client.deferred.map((item) => item.candidateId), authoritative.deferred.map((item) => item.candidateId));
  assert.deepEqual(client.review.map((item) => item.candidateId), authoritative.review.map((item) => item.candidateId));
  assert.deepEqual(client.rejected.map((item) => item.candidateId), authoritative.rejected.map((item) => item.candidateId));
  assert.equal(client.marketplaceFetches, 0);
  assert.equal(client.externalActions, 0);
});
