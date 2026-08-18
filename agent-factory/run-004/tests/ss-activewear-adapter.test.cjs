'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

async function adapter() {
  return import('../../../src/liveSourcing/ss-activewear-adapter.mjs');
}

test('detects S&S product data, blocks noeRetailing=true, and maps allowed rows', async () => {
  const { adaptSsActivewearDataset } = await adapter();
  const content = [
    'sku,gtin,brandName,styleName,colorName,sizeName,customerPrice,qty,noeRetailing',
    'A1,00880723038404,Gildan,2000 Ultra Cotton Tee,Black,L,3.72,238,false',
    'A2,00880723038411,Gildan,2000 Ultra Cotton Tee,Navy,XL,3.92,114,true',
  ].join('\n');
  const result = adaptSsActivewearDataset({ content, fileName: 'ss-products.csv' });
  assert.equal(result.detected, true);
  assert.equal(result.inputCount, 2);
  assert.equal(result.allowedCount, 1);
  assert.equal(result.prohibitedCount, 1);
  assert.equal(result.reviewCount, 0);
  const rows = JSON.parse(result.content);
  assert.equal(rows[0].title, 'Gildan 2000 Ultra Cotton Tee Black L');
  assert.equal(rows[0].supplier, 'S&S Activewear');
  assert.equal(rows[0].sku, 'A1');
  assert.equal(rows[0].upc, '00880723038404');
  assert.equal(rows[0].cost, '3.72');
  assert.equal(rows[0].stock, '238');
  assert.match(result.prohibited[0].reason, /prohibits e-retailing/);
});

test('S&S restriction flag is fail-closed when missing or unparseable', async () => {
  const { adaptSsActivewearDataset } = await adapter();
  const content = JSON.stringify([
    { sku: 'A1', gtin: '00880723038404', brandName: 'Gildan', styleName: '2000', customerPrice: 3.72, noeRetailing: false },
    { sku: 'A2', gtin: '00880723038411', brandName: 'Gildan', styleName: '2000', customerPrice: 3.92, noeRetailing: 'unknown' },
  ]);
  const result = adaptSsActivewearDataset({ content, fileName: 'ss-products.json' });
  assert.equal(result.allowedCount, 1);
  assert.equal(result.reviewCount, 1);
  assert.equal(result.prohibitedCount, 0);
  assert.match(result.review[0].reason, /missing or unparseable/);
});

test('fullCaseOnly uses caseQty as MOQ when the flattened supplier file exposes both fields', async () => {
  const { adaptSsActivewearDataset } = await adapter();
  const content = JSON.stringify([{
    sku: 'CASE1', gtin: '00880723038428', brandName: 'Demo', styleName: 'Case Product', customerPrice: 4.00,
    qty: 120, noeRetailing: false, fullCaseOnly: true, caseQty: 24,
  }]);
  const result = adaptSsActivewearDataset({ content, fileName: 'ss-products.json' });
  const [row] = JSON.parse(result.content);
  assert.equal(row.moq, 24);
});

test('non-S&S files pass through unchanged', async () => {
  const { adaptSsActivewearDataset } = await adapter();
  const content = 'title,supplier,sku,cost\nWidget,Demo,W1,5.00';
  const result = adaptSsActivewearDataset({ content, fileName: 'generic.csv' });
  assert.equal(result.detected, false);
  assert.equal(result.content, content);
  assert.equal(result.prohibitedCount, 0);
  assert.equal(result.reviewCount, 0);
});
