const assert = require('node:assert/strict');
const fs = require('node:fs');
const { parseExecution } = require('./validate-n8n-execution.cjs');

function validateExecution(execution) {
  const workflow = execution.data?.workflowData;
  const terminalRuns = execution.data?.resultData?.runData?.['Internal Shadow Results'];
  if (workflow) {
    assert.equal(workflow.id, 'RUN004G5SHADOW');
    assert.equal(workflow.active, false);
  }
  assert.equal(execution.mode, 'cli');
  assert.equal(execution.finished, true);
  assert.equal(execution.data?.resultData?.error, undefined);
  assert.equal(execution.data?.resultData?.lastNodeExecuted, 'Internal Shadow Results');
  assert.ok(Array.isArray(terminalRuns) && terminalRuns.length === 1);

  const items = terminalRuns[0]?.data?.main?.[0] || [];
  assert.equal(items.length, 2);
  const results = items.map((item) => item.json).sort((a, b) => a.candidateId.localeCompare(b.candidateId));
  assert.deepEqual(results.map((result) => result.candidateId), ['H-157WB', 'H-596B']);
  for (const result of results) {
    assert.equal(result.runId, 'DS-S2M-004');
    assert.equal(result.gate, 'G5');
    assert.equal(result.guardStatus, 'Accepted');
    assert.equal(result.status, 'Incomplete');
    assert.ok(result.soldEvidenceCount > 0);
    assert.ok(result.missingEconomics.includes('inboundFreightCents'));
    assert.ok(result.missingEconomics.includes('outboundShippingCents'));
    assert.equal(result.telemetry.humanReviewRequired, true);
    assert.equal(result.telemetry.estimatedCostCents, 0);
    assert.equal(result.telemetry.externalActions, 0);
    assert.equal(result.telemetry.spendingCents, 0);
  }
  return {
    result: 'Pass',
    workflowId: workflow?.id ?? 'RUN004G5SHADOW',
    workflowActive: workflow?.active ?? 'verified-by-export-step',
    executionMode: execution.mode,
    candidateStatuses: Object.fromEntries(results.map((result) => [result.candidateId, result.status])),
    externalActions: 0,
    estimatedCostCents: 0,
  };
}

if (require.main === module) {
  const file = process.argv[2];
  if (!file) throw new Error('Execution JSON path is required');
  const summary = validateExecution(parseExecution(fs.readFileSync(file, 'utf8')));
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

module.exports = { validateExecution };
