const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const required = [
  'README.md',
  'contracts/registry.json',
  'fixtures/approved-self-email.json',
  'n8n/node-map.md',
  'n8n/run-005-controlled-notification.workflow.json',
  'runtime/pilot.cjs',
  'scripts/run-preflight.cjs',
  'scripts/validate-n8n-execution.cjs',
  'tests/pilot.test.cjs',
];
const missing = required.filter((file) => !fs.existsSync(path.join(ROOT, file)));
if (missing.length) throw new Error(`Missing Run 005 files: ${missing.join(', ')}`);

const fixture = JSON.parse(fs.readFileSync(path.join(ROOT, 'fixtures/approved-self-email.json'), 'utf8'));
const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'contracts/registry.json'), 'utf8'));
const workflow = JSON.parse(fs.readFileSync(path.join(ROOT, 'n8n/run-005-controlled-notification.workflow.json'), 'utf8'));
if (fixture.runId !== 'FACT-NOTIFY-005' || fixture.gate !== 'G6') throw new Error('Run 005 fixture identity changed');
if (fixture.recipient.to !== 'me' || fixture.recipient.selector !== 'authenticated_self') throw new Error('Run 005 recipient changed');
if (fixture.control.maxExternalActions !== 1 || fixture.control.spendingAuthorityCents !== 0) throw new Error('Run 005 authority changed');
if (workflow.active !== false) throw new Error('Run 005 n8n workflow must remain inactive in source');
if (workflow.nodes.some((node) => node.credentials)) throw new Error('Run 005 n8n source may not contain credentials');
const allowedTypes = new Set(['n8n-nodes-base.manualTrigger', 'n8n-nodes-base.code', 'n8n-nodes-base.if', 'n8n-nodes-base.noOp']);
if (!workflow.nodes.every((node) => allowedTypes.has(node.type))) throw new Error('Run 005 n8n source contains a live-action node');
if (registry.units.length !== 1 || registry.units[0].authority_level !== 'Act with approval') throw new Error('Run 005 registry contract changed');

process.stdout.write(`${JSON.stringify({
  result: 'Pass',
  runId: fixture.runId,
  gate: fixture.gate,
  workflowId: workflow.id,
  workflowActive: workflow.active,
  nodes: workflow.nodes.length,
  credentialsInSource: 0,
  liveActionsInCI: 0,
  approvedExternalActionLimit: 1,
  spendingAuthorityCents: 0,
}, null, 2)}\n`);

