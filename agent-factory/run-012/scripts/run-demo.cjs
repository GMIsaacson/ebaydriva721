const fs = require('node:fs');
const path = require('node:path');
const { buildActionQueue } = require('../runtime/policy.cjs');

const fixture = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../fixtures/demo-opportunities.json'), 'utf8')
);

console.log(JSON.stringify({
  runId: 'GROWTH-ACQ-012',
  externalActions: 0,
  queue: buildActionQueue(fixture)
}, null, 2));
