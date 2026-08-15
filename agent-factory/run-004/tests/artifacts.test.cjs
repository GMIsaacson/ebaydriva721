const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

test('all JSON deployment artifacts parse', () => {
  for (const file of [
    'contracts/handoff.schema.json',
    'contracts/run-control.schema.json',
    'contracts/telemetry.schema.json',
    'contracts/registry.json',
    'fixtures/normal-h2.json',
    'firestore/firestore.g4.indexes.json',
    'firestore/firebase.g4.emulator.json',
    'n8n/run-004-g4-offline.workflow.json',
  ]) {
    assert.doesNotThrow(() => JSON.parse(read(file)), file);
  }
});

test('n8n workflow is inactive, manual, credential-free, and connector-free', () => {
  const workflow = JSON.parse(read('n8n/run-004-g4-offline.workflow.json'));
  const allowedTypes = new Set([
    'n8n-nodes-base.manualTrigger',
    'n8n-nodes-base.code',
    'n8n-nodes-base.if',
    'n8n-nodes-base.noOp',
  ]);
  assert.equal(workflow.active, false);
  assert.equal(workflow.nodes.filter((node) => node.type === 'n8n-nodes-base.manualTrigger').length, 1);
  assert.ok(workflow.nodes.every((node) => allowedTypes.has(node.type)));
  assert.ok(workflow.nodes.every((node) => node.credentials === undefined));
  assert.equal(workflow.meta.authority, 'Observe');
});

test('workflow source contains all hard authority caps', () => {
  const source = read('n8n/run-004-g4-offline.workflow.json');
  assert.match(source, /externalActionsEnabled: false/);
  assert.match(source, /spendingAuthorityCents: 0/);
  assert.match(source, /maxCandidates: 25/);
  assert.match(source, /maxSourceRequests: 200/);
  assert.match(source, /externalActions: 0/);
});

test('emulator rules isolate Run 004 and deny delete and default access', () => {
  const rules = read('firestore/firestore.g4.emulator.rules');
  assert.match(rules, /runId == 'DS-S2M-004'/);
  assert.match(rules, /external_actions_enabled == false/);
  assert.match(rules, /spending_authority_cents == 0/);
  assert.match(rules, /allow delete: if false/);
  assert.match(rules, /match \/\{document=\*\*\}/);
  assert.match(rules, /allow read, write: if false/);
});

test('registry preserves stable IDs and Testing lifecycle', () => {
  const registry = JSON.parse(read('contracts/registry.json'));
  const ids = registry.units.map((unit) => unit.unit_id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.includes('AGT-PORTFOLIO-STEWARD-001'));
  assert.ok(ids.includes('AGT-RESEARCH-VALIDATION-001'));
  assert.ok(ids.includes('AGT-OFFER-ASSET-BUILDER-001'));
  assert.ok(ids.includes('WF-DS-S2M-004-G4-001'));
  assert.ok(registry.units.every((unit) => unit.lifecycle_status === 'Testing'));
});
