'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const registry = require('../live-sourcing/source-access-registry.json');
const { ingestAuthorizedDataset } = require('../runtime/product-intake.cjs');

const base = {
  registry,
  ownerAttestation: true,
  uploadedBy: 'OWNER-ABERDEEN',
  observedAt: '2026-08-18T02:20:00Z',
};

test('requires explicit owner attestation for uploaded data', () => {
  assert.throws(() => ingestAuthorizedDataset({
    ...base,
    ownerAttestation: false,
    format: 'json',
    content: '[]',
  }), (error) => error.code === 'OWNER_ATTESTATION_REQUIRED');
});

test('fails closed when the access source is not authorized', () => {
  assert.throws(() => ingestAuthorizedDataset({
    ...base,
    sourceId: 'unverified-machine-source-template',
    format: 'json',
    content: '[]',
  }), (error) => error.code === 'SOURCE_ACCESS_DENIED');
});

test('normalizes JSON aliases into the canonical intake record', () => {
  const result = ingestAuthorizedDataset({
    ...base,
    fileName: 'supplier.json',
    format: 'json',
    content: JSON.stringify([{
      Product: '3M Filter 123', Vendor: 'Demo Supply', SKU: 'A-123', MPN: '123', Manufacturer: '3M',
      UPC: '000123456789', Cost: '$12.34', MinQty: 2, Stock: 20, WeightLb: 1.5,
      Length: 8, Width: 6, Height: 4, ProductURL: 'https://supplier.example/item/A-123',
    }]),
  });
  assert.equal(result.status, 'ACCEPTED');
  assert.equal(result.acceptedCount, 1);
  assert.equal(result.records[0].unitCostCents, 1234);
  assert.equal(result.records[0].weightOz, 24);
  assert.equal(result.records[0].moq, 2);
  assert.equal(result.records[0].identityConfidence, 'HIGH');
  assert.equal(result.records[0].eRetailingProhibited, null);
  assert.match(result.records[0].candidateId, /^DSC-[a-f0-9]{20}$/);
  assert.equal(result.machineFetches, 0);
  assert.equal(result.externalActions, 0);
});

test('normalizes S&S-style product fields and captures the mill e-retailing restriction', () => {
  const result = ingestAuthorizedDataset({
    ...base,
    fileName: 'ss-products.json',
    format: 'json',
    defaultSupplier: 'S&S Activewear',
    content: JSON.stringify([{
      sku: '00760-00001-00',
      gtin: '00880723038404',
      brandName: 'Gildan',
      styleName: '2000 Ultra Cotton Tee',
      colorName: 'Black',
      sizeName: 'L',
      customerPrice: '3.72',
      qty: 238,
      noeRetailing: true,
    }]),
  });
  assert.equal(result.acceptedCount, 1);
  assert.equal(result.records[0].supplier, 'S&S Activewear');
  assert.equal(result.records[0].title, 'Gildan 2000 Ultra Cotton Tee Black L');
  assert.equal(result.records[0].upc, '00880723038404');
  assert.equal(result.records[0].unitCostCents, 372);
  assert.equal(result.records[0].availableQuantity, 238);
  assert.equal(result.records[0].identityConfidence, 'HIGH');
  assert.equal(result.records[0].eRetailingProhibited, true);
});

test('parses CSV and uses a default supplier when supplied by intake metadata', () => {
  const content = [
    'title,sku,cost,stock,pack_qty',
    'Widget One,W-1,7.25,30,2',
    'Widget Two,W-2,9.50,12,1',
  ].join('\n');
  const result = ingestAuthorizedDataset({ ...base, fileName: 'feed.csv', content, defaultSupplier: 'Uploaded Supplier' });
  assert.equal(result.format, 'csv');
  assert.equal(result.acceptedCount, 2);
  assert.equal(result.records[0].supplier, 'Uploaded Supplier');
  assert.equal(result.records[0].unitCostCents, 725);
  assert.equal(result.records[0].packQuantity, 2);
});

test('handles at least 600 records deterministically', () => {
  const rows = Array.from({ length: 600 }, (_, index) => ({
    title: `Part ${index + 1}`,
    supplier: 'Scale Supplier',
    sku: `S-${String(index + 1).padStart(4, '0')}`,
    cost: (5 + index / 100).toFixed(2),
    stock: 100,
    weight_oz: 8,
  }));
  const first = ingestAuthorizedDataset({ ...base, fileName: 'scale.json', format: 'json', content: JSON.stringify(rows) });
  const second = ingestAuthorizedDataset({ ...base, fileName: 'scale.json', format: 'json', content: JSON.stringify(rows) });
  assert.equal(first.acceptedCount, 600);
  assert.equal(first.invalidCount, 0);
  assert.equal(first.reviewCount, 0);
  assert.equal(first.datasetHash, second.datasetHash);
  assert.equal(first.records[599].candidateId, second.records[599].candidateId);
});

test('suppresses exact duplicate supplier offers', () => {
  const row = { title: 'Same Part', supplier: 'Supplier A', sku: 'X1', cost: '10.00' };
  const result = ingestAuthorizedDataset({ ...base, format: 'json', content: JSON.stringify([row, row]) });
  assert.equal(result.acceptedCount, 1);
  assert.equal(result.duplicateCount, 1);
  assert.equal(result.reviewCount, 0);
});

test('routes conflicting duplicate supplier offers to review instead of choosing a value', () => {
  const result = ingestAuthorizedDataset({
    ...base,
    format: 'json',
    content: JSON.stringify([
      { title: 'Same Part', supplier: 'Supplier A', sku: 'X1', cost: '10.00' },
      { title: 'Same Part', supplier: 'Supplier A', sku: 'X1', cost: '15.00' },
    ]),
  });
  assert.equal(result.status, 'REVIEW');
  assert.equal(result.acceptedCount, 0);
  assert.equal(result.reviewCount, 1);
  assert.match(result.reviews[0].reason, /conflicting/);
});

test('invalid rows are isolated and never silently assigned guessed economics', () => {
  const result = ingestAuthorizedDataset({
    ...base,
    format: 'json',
    content: JSON.stringify([
      { title: 'Good', supplier: 'Supplier A', sku: 'G1', cost: '12.00' },
      { title: 'Bad', supplier: 'Supplier A', sku: 'B1', cost: '-4.00' },
      { supplier: 'Supplier A', sku: 'B2', cost: '3.00' },
    ]),
  });
  assert.equal(result.status, 'REVIEW');
  assert.equal(result.acceptedCount, 1);
  assert.equal(result.invalidCount, 2);
  assert.ok(result.invalid.some((item) => /non-negative/.test(item.reason)));
  assert.ok(result.invalid.some((item) => /title is required/.test(item.reason)));
});

test('enforces the bounded record cap before processing', () => {
  const rows = Array.from({ length: 11 }, (_, index) => ({ title: `P${index}`, supplier: 'S', sku: `${index}`, cost: '1' }));
  assert.throws(() => ingestAuthorizedDataset({ ...base, format: 'json', content: JSON.stringify(rows), maxRecords: 10 }), (error) => error.code === 'DATASET_RECORD_CAP_EXCEEDED');
});
