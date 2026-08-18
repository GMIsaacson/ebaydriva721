const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const requiredFiles = [
  'README.md',
  'contracts/team-contract.json',
  'contracts/handoff-contract.json',
  'runtime/policy.cjs',
  'fixtures/demo-opportunities.json',
  'tests/policy.test.cjs',
  'tests/g4-workflow.test.cjs',
  'n8n/run-012-growth-acquisition-g4.workflow.json',
  'scripts/run-demo.cjs'
];

for (const rel of requiredFiles) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) throw new Error(`missing required file: ${rel}`);
}

const team = JSON.parse(fs.readFileSync(path.join(root, 'contracts/team-contract.json'), 'utf8'));
const handoff = JSON.parse(fs.readFileSync(path.join(root, 'contracts/handoff-contract.json'), 'utf8'));
const workflow = JSON.parse(fs.readFileSync(path.join(root, 'n8n/run-012-growth-acquisition-g4.workflow.json'), 'utf8'));

if (team.runId !== 'GROWTH-ACQ-012') throw new Error('wrong runId');
if (team.primaryKpi !== 'attributed_revenue_usd') throw new Error('revenue must remain primary KPI');
if (team.agents.length !== 11) throw new Error('expected 11 registered team units');
if (team.authority.spendMoney !== false) throw new Error('spending authority must be disabled');
if (team.authority.phoneOrSmsOutreach !== false) throw new Error('phone/SMS outreach must remain disabled');
if (team.externalActionsDuringG3 !== 0) throw new Error('G3 external actions must be zero');
if (handoff.runId !== team.runId) throw new Error('handoff contract runId mismatch');
if (workflow.active !== false) throw new Error('G4 workflow must remain inactive');
if (workflow.meta?.runId !== team.runId) throw new Error('workflow runId mismatch');
if (workflow.meta?.deploymentMode !== 'inactive-nonproduction') throw new Error('wrong deployment mode');

console.log(JSON.stringify({
  runId: team.runId,
  status: 'PASS',
  agents: team.agents.length,
  primaryKpi: team.primaryKpi,
  workflowId: workflow.meta.workflowId,
  workflowActive: workflow.active,
  externalActionsAllowedAtG3: team.externalActionsDuringG3,
  spendAuthorityUsd: team.spendAuthorityUsd
}, null, 2));
