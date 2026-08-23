'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const handoff = JSON.parse(fs.readFileSync(path.join(root, 'ops-handoff.json'), 'utf8'));

test('ops handoff targets Run 008 without claiming acceptance', () => {
  assert.equal(handoff.handoffType, 'ops_handoff_v1');
  assert.equal(handoff.sourceRun, 'SW-PROD-014');
  assert.equal(handoff.target, 'OPS-CORE-008');
  assert.equal(handoff.status, 'PACKAGE_READY');
  assert.match(handoff.downstreamBoundary, /does not claim OPS-CORE-008 accepted or executed/);
});

test('ops handoff preserves zero external authority', () => {
  assert.equal(handoff.authorityCeiling.externalDeploymentAuthorized, false);
  assert.equal(handoff.authorityCeiling.maxSpendCents, 0);
  assert.equal(handoff.authorityCeiling.productionMutation, false);
  assert.deepEqual(handoff.unresolvedBlockers, []);
});
