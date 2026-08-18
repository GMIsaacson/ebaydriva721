const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const file = path.join(__dirname, '../n8n/run-012-growth-acquisition-g4.workflow.json');
const wf = JSON.parse(fs.readFileSync(file, 'utf8'));

test('workflow is inactive and manual-only', () => {
  assert.equal(wf.active, false);
  assert.equal(wf.nodes.filter(n => n.type === 'n8n-nodes-base.manualTrigger').length, 1);
  assert.equal(wf.nodes.some(n => /webhook|scheduleTrigger/i.test(n.type)), false);
});

test('workflow contains no external connector/action nodes', () => {
  const forbidden = /httpRequest|gmail|emailSend|twitter|linkedin|slack|webhook|stripe|twilio/i;
  assert.equal(wf.nodes.some(n => forbidden.test(n.type)), false);
});

test('workflow policy hard-locks authority to zero', () => {
  const load = wf.nodes.find(n => n.name === 'Load Synthetic Growth Signals');
  const code = load.parameters.jsCode;
  assert.match(code, /maxExternalActions:0/);
  assert.match(code, /maxCrmWrites:0/);
  assert.match(code, /spendingAuthorityCents:0/);
  assert.match(code, /maxAiCalls:0/);
});

test('workflow output blocks external execution', () => {
  const scoring = wf.nodes.find(n => n.name === 'Score Route and Deduplicate');
  assert.match(scoring.parameters.jsCode, /BLOCKED_PENDING_OWNER_APPROVAL/);
  assert.match(scoring.parameters.jsCode, /externalActionsPerformed:0/);
});
