const assert = require('node:assert/strict');
const fs = require('node:fs');
const { parseExecution } = require('../../run-004/scripts/validate-n8n-execution.cjs');

function validateExecution(execution) {
  const workflow = execution.data?.workflowData;
  const terminalRuns = execution.data?.resultData?.runData?.['Internal Pilot Result'];
  if (workflow) {
    assert.equal(workflow.id, 'RUN005G6NOTIFY');
    assert.equal(workflow.active, false);
  }
  assert.equal(execution.mode, 'cli');
  assert.equal(execution.finished, true);
  assert.equal(execution.data?.resultData?.error, undefined);
  assert.equal(execution.data?.resultData?.lastNodeExecuted, 'Internal Pilot Result');
  assert.ok(Array.isArray(terminalRuns) && terminalRuns.length === 1);
  const items = terminalRuns[0]?.data?.main?.[0] || [];
  assert.equal(items.length, 1);
  const result = items[0].json;
  assert.equal(result.runId, 'FACT-NOTIFY-005');
  assert.equal(result.gate, 'G6');
  assert.equal(result.guardStatus, 'Accepted');
  assert.equal(result.status, 'ReadyForApprovedExecutor');
  assert.equal(result.executorHandoff.action, 'gmail.send_email');
  assert.equal(result.executorHandoff.recipient, 'me');
  assert.equal(result.retryAllowed, false);
  assert.equal(result.externalActionsPerformed, 0);
  assert.equal(result.externalActionLimit, 1);
  assert.equal(result.spendingCents, 0);
  return {
    result: 'Pass',
    workflowId: workflow?.id ?? 'RUN005G6NOTIFY',
    workflowActive: workflow?.active ?? 'verified-by-export-step',
    status: result.status,
    recipient: result.executorHandoff.recipient,
    liveActionsInCI: 0,
    approvedExternalActionLimit: 1,
    spendingCents: 0,
  };
}

if (require.main === module) {
  const file = process.argv[2];
  if (!file) throw new Error('Execution JSON path is required');
  const summary = validateExecution(parseExecution(fs.readFileSync(file, 'utf8')));
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

module.exports = { validateExecution };

