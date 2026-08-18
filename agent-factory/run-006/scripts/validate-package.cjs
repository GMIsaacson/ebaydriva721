'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const required = [
  'README.md',
  'contracts/handoff.schema.json',
  'contracts/registry.json',
  'contracts/subscription-record.schema.json',
  'firestore/firebase.g4.emulator.json',
  'firestore/firestore.g4.emulator.rules',
  'firestore/firestore.g4.indexes.json',
  'fixtures/synthetic-baseline.json',
  'n8n/node-map.md',
  'n8n/run-006-subscription-baseline.workflow.json',
  'runtime/policy.cjs',
  'runtime/runtime.cjs',
  'scripts/run-demo.cjs',
  'scripts/validate-n8n-execution.cjs',
  'tests/firestore-rules.test.cjs',
  'tests/runtime.test.cjs',
];

const missing = required.filter((file) => !fs.existsSync(path.join(ROOT, file)));
if (missing.length) throw new Error('Missing Run 006 files: ' + missing.join(', '));

const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'contracts/registry.json'), 'utf8'));
const fixture = JSON.parse(fs.readFileSync(path.join(ROOT, 'fixtures/synthetic-baseline.json'), 'utf8'));
const workflow = JSON.parse(fs.readFileSync(path.join(ROOT, 'n8n/run-006-subscription-baseline.workflow.json'), 'utf8'));
const schemas = [
  JSON.parse(fs.readFileSync(path.join(ROOT, 'contracts/handoff.schema.json'), 'utf8')),
  JSON.parse(fs.readFileSync(path.join(ROOT, 'contracts/subscription-record.schema.json'), 'utf8')),
];

if (registry.run_id !== 'SUB-OPS-006' || registry.units.length !== 7) throw new Error('Run 006 registry identity changed');
if (fixture.runId !== 'SUB-OPS-006' || fixture.gate !== 'G4') throw new Error('Run 006 fixture identity changed');
if (fixture.control.maxExternalActions !== 0 || fixture.control.maxNotionWrites !== 0) throw new Error('Run 006 side-effect boundary changed');
if (fixture.control.spendingAuthorityCents !== 0 || fixture.control.maxAiCalls !== 0) throw new Error('Run 006 cost boundary changed');
if (workflow.id !== 'RUN006G4SUBOPS') throw new Error('Run 006 n8n workflow ID changed');
if (workflow.active !== false) throw new Error('Run 006 n8n workflow must remain inactive in source');
if (workflow.nodes.some((node) => node.credentials)) throw new Error('Run 006 n8n source may not contain credentials');
if (workflow.nodes.some((node) => /gmail|notion|stripe|httpRequest/i.test(node.type))) throw new Error('Run 006 n8n source contains an external-action node');
if (!workflow.nodes.some((node) => node.type === 'n8n-nodes-base.manualTrigger')) throw new Error('Run 006 must remain manual-only');
if (schemas.some((schema) => schema.$schema !== 'https://json-schema.org/draft/2020-12/schema')) throw new Error('Run 006 schema version changed');

const serialized = required
  .filter((file) => /\.(json|cjs|md|rules)$/.test(file))
  .map((file) => fs.readFileSync(path.join(ROOT, file), 'utf8'))
  .join('\n');
if (/(password|api[_ -]?key|access[_ -]?token)\s*[:=]\s*["'][^"']+/i.test(serialized)) throw new Error('Secret-like material found in package');

process.stdout.write(JSON.stringify({
  result: 'Pass',
  runId: fixture.runId,
  gate: fixture.gate,
  workflowId: workflow.id,
  workflowActive: workflow.active,
  units: registry.units.length,
  nodes: workflow.nodes.length,
  credentialsInSource: 0,
  externalActionNodes: 0,
  externalActionsAllowed: 0,
  notionWritesAllowed: 0,
  aiCallsAllowed: 0,
  spendingAuthorityCents: 0
}, null, 2) + '\n');
