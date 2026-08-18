'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

async function adapter() {
  return import('../../../src/liveSourcing/ss-activewear-adapter.mjs');
}

test('detects S&S product data, blocks NoeRetailing=true, and maps allowed rows', async () => {
  const { adaptSsActivewearDataset } = await adapter();
  const content = [
    'sku,gtin,brandName,styleName,colorName,sizeName,customerPrice,Qty,NoeRetailing',
    'A1,00880723038404,Gildan,2000,Black,L,3.72,238,false',
    'A2,00880723038411,Gildan,2000,Navy,XL,3.92,114,true',
  ].join('\n');
  const result = adaptSsActivewearDataset({ content, fileName: 'Products.csv' });
  assert.equal(result.detected, true);
  assert.equal(result.inputCount, 2);
  assert.equal(result.allowedCount, 1);
  assert.equal(result.prohibitedCount, 1);
  assert.equal(result.reviewCount, 0);
  const rows = JSON.parse(result.content);
  assert.equal(rows[0].title, 'Gildan 2000 Black L');
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
    { sku: 'A1', gtin: '00880723038404', brandName: 'Gildan', styleName: '2000', customerPrice: 3.72, NoeRetailing: false },
    { sku: 'A2', gtin: '00880723038411', brandName: 'Gildan', styleName: '2000', customerPrice: 3.92, NoeRetailing: 'unknown' },
  ]);
  const result = adaptSsActivewearDataset({ content, fileName: 'Products.json' });
  assert.equal(result.allowedCount, 1);
  assert.equal(result.reviewCount, 1);
  assert.equal(result.prohibitedCount, 0);
  assert.match(result.review[0].reason, /missing or unparseable/);
});

test('actual Products.xlsx flattened names map fullCaseOnly_DS and unitWeight correctly', async () => {
  const { adaptSsActivewearDataset } = await adapter();
  const content = JSON.stringify([{
    sku: 'B49695500', gtin: '00194602593517', brandName: '47 Brand', styleName: '4700', colorName: 'Black', sizeName: 'Adjustable',
    customerPrice: '7.50', Qty: '143', NoeRetailing: false, fullCaseOnly_DS: true, CaseQty: '144', unitWeight: '0.2777777777777',
  }]);
  const result = adaptSsActivewearDataset({ content, fileName: 'Products.json' });
  const [row] = JSON.parse(result.content);
  assert.equal(row.moq, 144);
  assert.equal(row.weight_lb, '0.2777777777777');
  assert.equal(row.stock, '143');
  assert.equal(row.title, '47 Brand 4700 Black Adjustable');
});

test('fullCaseOnly false keeps MOQ at one', async () => {
  const { adaptSsActivewearDataset } = await adapter();
  const content = JSON.stringify([{
    sku: 'CASE2', gtin: '00880723038435', brandName: 'Demo', styleName: 'Single Product', customerPrice: 4.00,
    Qty: 120, NoeRetailing: false, fullCaseOnly_DS: false, CaseQty: 24, unitWeight: 0.5,
  }]);
  const result = adaptSsActivewearDataset({ content, fileName: 'Products.json' });
  const [row] = JSON.parse(result.content);
  assert.equal(row.moq, 1);
  assert.equal(row.weight_lb, 0.5);
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
