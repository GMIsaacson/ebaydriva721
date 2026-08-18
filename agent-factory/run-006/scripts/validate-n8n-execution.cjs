'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { parseExecution } = require('../../run-004/scripts/validate-n8n-execution.cjs');

function validateExecution(execution) {
  const workflow = execution.data?.workflowData;
  const terminalRuns = execution.data?.resultData?.runData?.['Internal Subscription Result'];
  if (workflow) {
    assert.equal(workflow.id, 'RUN006G4SUBOPS');
    assert.equal(workflow.active, false);
  }
  assert.equal(execution.mode, 'cli');
  assert.equal(execution.finished, true);
  assert.equal(execution.data?.resultData?.error, undefined);
  assert.equal(execution.data?.resultData?.lastNodeExecuted, 'Internal Subscription Result');
  assert.ok(Array.isArray(terminalRuns) && terminalRuns.length === 1);
  const items = terminalRuns[0]?.data?.main?.[0] || [];
  assert.equal(items.length, 1);
  const result = items[0].json;
  assert.equal(result.runId, 'SUB-OPS-006');
  assert.equal(result.gate, 'G4');
  assert.equal(result.guardStatus, 'Accepted');
  assert.equal(result.status, 'Pass');
  assert.equal(result.records.length, 2);
  assert.equal(result.performance.length, 7);
  assert.equal(result.writeMode, 'DraftOnly');
  assert.equal(result.externalActionsPerformed, 0);
  assert.equal(result.notionWritesPerformed, 0);
  assert.equal(result.spendingCents, 0);
  assert.equal(result.aiCalls, 0);
  return {
    result: 'Pass',
    workflowId: workflow?.id ?? 'RUN006G4SUBOPS',
    workflowActive: workflow?.active ?? 'verified-by-export-step',
    records: result.records.length,
    performanceUnits: result.performance.length,
    externalActions: 0,
    notionWrites: 0,
    spendingCents: 0,
    aiCalls: 0
  };
}

if (require.main === module) {
  const file = process.argv[2];
  if (!file) throw new Error('Execution JSON path is required');
  const summary = validateExecution(parseExecution(fs.readFileSync(file, 'utf8')));
  process.stdout.write(JSON.stringify(summary, null, 2) + '\n');
}

module.exports = { validateExecution };
