const fs = require('node:fs');
const path = require('node:path');

const runRoot = path.join(__dirname, '..');
const sharedRoot = path.join(runRoot, '..', 'shared');
const requiredFiles = [
  path.join(runRoot, 'README.md'),
  path.join(runRoot, 'contracts/team-contract.json'),
  path.join(runRoot, 'contracts/handoff-contract.json'),
  path.join(runRoot, 'runtime/policy.cjs'),
  path.join(runRoot, 'fixtures/demo-opportunities.json'),
  path.join(runRoot, 'tests/policy.test.cjs'),
  path.join(runRoot, 'tests/g4-workflow.test.cjs'),
  path.join(runRoot, 'n8n/run-012-growth-acquisition-g4.workflow.json'),
  path.join(runRoot, 'scripts/run-demo.cjs'),
  path.join(sharedRoot, 'commercial-lifecycle/cclc-v1.0.json'),
  path.join(sharedRoot, 'commercial-lifecycle/cclc.test.cjs'),
  path.join(sharedRoot, 'commercial-conversion/conversion-contract-v1.0.json'),
  path.join(sharedRoot, 'commercial-conversion/runtime.cjs'),
  path.join(sharedRoot, 'commercial-conversion/conversion.test.cjs'),
  path.join(sharedRoot, 'commercial-conversion/fixtures/qualified-opportunity.json'),
  path.join(sharedRoot, 'fulfillment/fulfillment-contract-v1.0.json'),
  path.join(sharedRoot, 'fulfillment/runtime.cjs'),
  path.join(sharedRoot, 'fulfillment/fulfillment.test.cjs'),
  path.join(sharedRoot, 'fulfillment/fixtures/accepted-engagement.json'),
  path.join(sharedRoot, 'fulfillment/README.md'),
  path.join(sharedRoot, 'customer-success/customer-success-contract-v1.0.json'),
  path.join(sharedRoot, 'customer-success/runtime.cjs'),
  path.join(sharedRoot, 'customer-success/customer-success.test.cjs'),
  path.join(sharedRoot, 'customer-success/README.md')
];

for (const full of requiredFiles) {
  if (!fs.existsSync(full)) throw new Error(`missing required file: ${full}`);
}

const team = JSON.parse(fs.readFileSync(path.join(runRoot, 'contracts/team-contract.json'), 'utf8'));
const handoff = JSON.parse(fs.readFileSync(path.join(runRoot, 'contracts/handoff-contract.json'), 'utf8'));
const workflow = JSON.parse(fs.readFileSync(path.join(runRoot, 'n8n/run-012-growth-acquisition-g4.workflow.json'), 'utf8'));
const cclc = JSON.parse(fs.readFileSync(path.join(sharedRoot, 'commercial-lifecycle/cclc-v1.0.json'), 'utf8'));
const conversion = JSON.parse(fs.readFileSync(path.join(sharedRoot, 'commercial-conversion/conversion-contract-v1.0.json'), 'utf8'));
const fulfillment = JSON.parse(fs.readFileSync(path.join(sharedRoot, 'fulfillment/fulfillment-contract-v1.0.json'), 'utf8'));
const customerSuccess = JSON.parse(fs.readFileSync(path.join(sharedRoot, 'customer-success/customer-success-contract-v1.0.json'), 'utf8'));

if (team.runId !== 'GROWTH-ACQ-012') throw new Error('wrong runId');
if (team.primaryKpi !== 'attributed_revenue_usd') throw new Error('revenue must remain primary KPI');
if (team.agents.length !== 11) throw new Error('expected 11 registered team units');
if (team.authority.spendMoney !== false) throw new Error('spending authority must be disabled');
if (team.authority.phoneOrSmsOutreach !== false) throw new Error('phone/SMS outreach must remain disabled');
if (team.externalActionsDuringG3 !== 0) throw new Error('G3 external actions must be zero');
if (handoff.runId !== team.runId) throw new Error('handoff contract runId mismatch');
if (handoff.cclcRef !== 'CCLC-001-v1.0') throw new Error('handoff must bind CCLC v1');
if (handoff.handoffs?.qualified_opportunity_v1?.receiverContract !== 'COMM-CONV-001-v1.0') throw new Error('qualified opportunity receiver contract missing');
if (cclc.contractId !== 'CCLC-001' || cclc.version !== '1.0.0') throw new Error('CCLC contract mismatch');
if (conversion.moduleId !== 'COMM-CONV-001' || conversion.version !== '1.0.0') throw new Error('conversion contract mismatch');
if (conversion.input !== 'qualified_opportunity_v1') throw new Error('conversion input mismatch');
if (conversion.authority.sendExternal !== false || conversion.authority.moneyMovement !== false) throw new Error('conversion authority boundary expanded');
if (fulfillment.moduleId !== 'FULFILL-001' || fulfillment.version !== '1.0.0') throw new Error('fulfillment contract mismatch');
if (fulfillment.input !== 'commercial_acceptance_v1') throw new Error('fulfillment input mismatch');
if (fulfillment.outputs?.delivered !== 'delivered_engagement_v1') throw new Error('fulfillment delivered output mismatch');
if (fulfillment.authority.deliverExternally !== false || fulfillment.authority.moneyMovement !== false || fulfillment.authority.customerSuccessAction !== false) throw new Error('fulfillment authority boundary expanded');
if (!fulfillment.rules.some(r => r.includes('No production before client_ready_v1'))) throw new Error('client readiness production gate missing');
if (!fulfillment.rules.some(r => r.includes('QA PASS does not grant delivery authority'))) throw new Error('QA/delivery authority separation missing');
if (customerSuccess.moduleId !== 'CUST-SUCCESS-001' || customerSuccess.version !== '1.0.0') throw new Error('customer success contract mismatch');
if (customerSuccess.input !== 'delivered_engagement_v1') throw new Error('customer success input mismatch');
if (customerSuccess.outputs?.successOutcome !== 'success_outcome_v1') throw new Error('success outcome output mismatch');
if (customerSuccess.outputs?.renewalExpansion !== 'renewal_or_expansion_opportunity_v1') throw new Error('renewal/expansion output mismatch');
if (customerSuccess.authority.sendExternal !== false || customerSuccess.authority.grantRefund !== false || customerSuccess.authority.moneyMovement !== false || customerSuccess.authority.publishCustomerProof !== false) throw new Error('customer success authority boundary expanded');
if (!customerSuccess.rules.some(r => r.includes('No response from a customer is not acceptance'))) throw new Error('silence inference safeguard missing');
if (!customerSuccess.rules.some(r => r.includes('require explicit permission evidence'))) throw new Error('customer proof permission safeguard missing');
if (workflow.active !== false) throw new Error('G4 workflow must remain inactive');
if (workflow.meta?.runId !== team.runId) throw new Error('workflow runId mismatch');
if (workflow.meta?.deploymentMode !== 'inactive-nonproduction') throw new Error('wrong deployment mode');

console.log(JSON.stringify({
  runId: team.runId,
  status: 'PASS',
  agents: team.agents.length,
  primaryKpi: team.primaryKpi,
  cclc: `${cclc.contractId}-v${cclc.version}`,
  conversion: `${conversion.moduleId}-v${conversion.version}`,
  fulfillment: `${fulfillment.moduleId}-v${fulfillment.version}`,
  customerSuccess: `${customerSuccess.moduleId}-v${customerSuccess.version}`,
  qualifiedOpportunityReceiver: handoff.handoffs.qualified_opportunity_v1.receiverContract,
  fulfillmentInput: fulfillment.input,
  fulfillmentOutput: fulfillment.outputs.delivered,
  customerSuccessInput: customerSuccess.input,
  customerSuccessOutcome: customerSuccess.outputs.successOutcome,
  renewalExpansionOutput: customerSuccess.outputs.renewalExpansion,
  workflowId: workflow.meta.workflowId,
  workflowActive: workflow.active,
  externalActionsAllowedAtG3: team.externalActionsDuringG3,
  spendAuthorityUsd: team.spendAuthorityUsd
}, null, 2));
