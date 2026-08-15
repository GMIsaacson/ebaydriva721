const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const required = [
  'fixtures/g5-shadow-two-sku.json',
  'n8n/run-004-g5-shadow.workflow.json',
  'n8n/g5-node-map.md',
  'scripts/run-g5-shadow.cjs',
  'scripts/validate-g5-n8n-execution.cjs',
  'tests/g5-shadow.test.cjs',
];
const missing = required.filter((file) => !fs.existsSync(path.join(ROOT, file)));
if (missing.length) throw new Error(`Missing G5 files: ${missing.join(', ')}`);

const fixture = JSON.parse(fs.readFileSync(path.join(ROOT, 'fixtures/g5-shadow-two-sku.json'), 'utf8'));
const workflow = JSON.parse(fs.readFileSync(path.join(ROOT, 'n8n/run-004-g5-shadow.workflow.json'), 'utf8'));
if (fixture.candidates.length !== 2 || fixture.authority.sourceRequestLimit !== 7) {
  throw new Error('G5 fixture scope changed');
}
if (workflow.active !== false) throw new Error('G5 workflow must remain inactive');
if (workflow.nodes.some((node) => node.credentials)) throw new Error('G5 workflow may not contain credentials');
const allowedTypes = new Set([
  'n8n-nodes-base.manualTrigger',
  'n8n-nodes-base.code',
  'n8n-nodes-base.if',
  'n8n-nodes-base.noOp',
]);
if (!workflow.nodes.every((node) => allowedTypes.has(node.type))) throw new Error('G5 workflow has a forbidden node');
const source = JSON.stringify({ fixture, workflow });
for (const fragment of ['httpRequest', 'webhook', 'scheduleTrigger', 'credentials":']) {
  if (source.toLowerCase().includes(fragment.toLowerCase())) throw new Error(`Forbidden G5 fragment: ${fragment}`);
}

process.stdout.write(`${JSON.stringify({
  result: 'Pass',
  runId: fixture.runId,
  gate: fixture.gate,
  candidates: fixture.candidates.map((candidate) => candidate.candidateId),
  sourceRequestLimit: fixture.authority.sourceRequestLimit,
  workflowId: workflow.id,
  workflowActive: workflow.active,
  workflowNodes: workflow.nodes.length,
  credentials: 0,
  externalActions: 0,
  spendingCents: 0,
}, null, 2)}\n`);
