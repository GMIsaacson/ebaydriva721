const fs = require('node:fs');
const path = require('node:path');
const { loadConfig } = require('../runtime/config.cjs');
const { calculateEconomics } = require('../runtime/economics.cjs');

const ROOT = path.resolve(__dirname, '..');
const requiredFiles = [
  '.env.g4.example',
  'README.md',
  'contracts/handoff.schema.json',
  'contracts/run-control.schema.json',
  'contracts/telemetry.schema.json',
  'contracts/registry.json',
  'firestore/firestore.g4.emulator.rules',
  'firestore/firestore.g4.indexes.json',
  'firestore/firebase.g4.emulator.json',
  'n8n/run-004-g4-offline.workflow.json',
  'n8n/node-map.md',
  'runtime/config.cjs',
  'runtime/economics.cjs',
  'runtime/handoff.cjs',
  'runtime/policy.cjs',
  'runtime/runtime.cjs',
  'runtime/store.cjs',
];

const missing = requiredFiles.filter((file) => !fs.existsSync(path.join(ROOT, file)));
if (missing.length) throw new Error(`Missing G4 files: ${missing.join(', ')}`);

const workflow = JSON.parse(fs.readFileSync(path.join(ROOT, 'n8n/run-004-g4-offline.workflow.json'), 'utf8'));
if (workflow.active !== false) throw new Error('n8n workflow must remain inactive');
if (workflow.nodes.some((node) => node.credentials)) throw new Error('n8n workflow may not contain credentials');

const forbiddenNodeFragments = ['httpRequest', 'webhook', 'scheduleTrigger', 'email', 'slack', 'postgres', 'firestore'];
for (const node of workflow.nodes) {
  if (forbiddenNodeFragments.some((fragment) => node.type.toLowerCase().includes(fragment.toLowerCase()))) {
    throw new Error(`Forbidden n8n node: ${node.type}`);
  }
}

const config = loadConfig({});
const economics = calculateEconomics({
  collectedRevenueCents: 4000,
  sourceCostCents: 1000,
  inboundFreightCents: 500,
  marketplaceFeesCents: 600,
  outboundShippingCents: 700,
  packagingCents: 100,
  riskReserveCents: 200,
});

const summary = {
  runId: config.runId,
  contractVersion: config.contractVersion,
  mode: config.mode,
  filesChecked: requiredFiles.length,
  workflowNodes: workflow.nodes.length,
  workflowActive: workflow.active,
  credentials: 0,
  externalActionsEnabled: config.externalActionsEnabled,
  spendingAuthorityCents: config.spendingAuthorityCents,
  maxAiCalls: config.maxAiCalls,
  economicsFixture: {
    formulaVersion: economics.formulaVersion,
    netProfitCents: economics.netProfitCents,
    breakEvenCollectedRevenueCents: economics.breakEvenCollectedRevenueCents,
    inputHash: economics.inputHash,
  },
  result: 'Pass',
};

console.log(JSON.stringify(summary, null, 2));
