'use strict';

const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
const required = [
  'README.md',
  'contracts/registry.json',
  'fixtures/g4-demo.json',
  'fixtures/g5-shadow.json',
  'n8n/run-011-opportunity-intelligence.workflow.json',
  'runtime/policy.cjs',
  'runtime/runtime.cjs',
  'scripts/run-demo.cjs',
  'scripts/run-g5-shadow.cjs',
  'scripts/validate-n8n-execution.cjs',
  'tests/runtime.test.cjs',
  'tests/g5-shadow.test.cjs',
];
const missing = required.filter((file) => !fs.existsSync(path.join(ROOT, file)));
if (missing.length) throw new Error('Missing Run 011 files: ' + missing.join(', '));

const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'contracts/registry.json'), 'utf8'));
const g4 = JSON.parse(fs.readFileSync(path.join(ROOT, 'fixtures/g4-demo.json'), 'utf8'));
const g5 = JSON.parse(fs.readFileSync(path.join(ROOT, 'fixtures/g5-shadow.json'), 'utf8'));
const workflow = JSON.parse(fs.readFileSync(path.join(ROOT, 'n8n/run-011-opportunity-intelligence.workflow.json'), 'utf8'));

if (registry.run_id !== 'OPP-INTEL-011' || registry.units.length !== 7) throw new Error('Run 011 registry identity changed');
if (registry.workflow_version !== '1.1.0') throw new Error('Run 011 registry workflow version changed');
if (g4.runId !== 'OPP-INTEL-011' || g4.gate !== 'G4' || g4.workflowVersion !== '1.1.0') throw new Error('Run 011 G4 fixture contract changed');
if (g5.runId !== 'OPP-INTEL-011' || g5.gate !== 'G5' || g5.workflowVersion !== '1.1.0' || g5.candidates.length !== 10) throw new Error('Run 011 G5 fixture contract changed');
for (const fixture of [g4, g5]) {
  if (fixture.control.maxExternalActions !== 0 || fixture.control.maxCanonicalPortfolioWrites !== 0) throw new Error('Run 011 side-effect boundary changed');
  if (fixture.control.maxPaidToolCostUsd !== 0 || fixture.control.maxAiCalls !== 0) throw new Error('Run 011 cost/model boundary changed');
  if (fixture.control.scheduleEnabled !== false || fixture.control.webhookEnabled !== false || fixture.control.manualOnly !== true) throw new Error('Run 011 trigger boundary changed');
}
if (workflow.id !== 'RUN011G4OIT') throw new Error('Run 011 n8n workflow ID changed');
if (workflow.meta?.workflowVersion !== '1.1.0') throw new Error('Run 011 n8n workflow version changed');
if (workflow.active !== false) throw new Error('Run 011 n8n workflow must remain inactive in source');
if (workflow.nodes.some((node) => node.credentials)) throw new Error('Run 011 n8n source may not contain credentials');
if (workflow.nodes.some((node) => /gmail|notion|stripe|httpRequest|webhook/i.test(node.type))) throw new Error('Run 011 n8n source contains an external-action node');
if (!workflow.nodes.some((node) => node.type === 'n8n-nodes-base.manualTrigger')) throw new Error('Run 011 must remain manual-only');

const serialized = required
  .filter((file) => /\.(json|cjs|md)$/.test(file))
  .map((file) => fs.readFileSync(path.join(ROOT, file), 'utf8'))
  .join('\n');
if (/(password|api[_ -]?key|access[_ -]?token)\s*[:=]\s*["'][^"']+/i.test(serialized)) throw new Error('Secret-like material found in package');

process.stdout.write(JSON.stringify({
  result: 'Pass',
  runId: g4.runId,
  gatesCovered: ['G4', 'G5'],
  workflowId: workflow.id,
  workflowVersion: registry.workflow_version,
  workflowActive: workflow.active,
  units: registry.units.length,
  g5Candidates: g5.candidates.length,
  nodes: workflow.nodes.length,
  credentialsInSource: 0,
  externalActionNodes: 0,
  externalActionsAllowed: 0,
  canonicalPortfolioWritesAllowed: 0,
  aiCallsAllowedInControlRuns: 0,
  incrementalPaidToolCostUsd: 0
}, null, 2) + '\n');
