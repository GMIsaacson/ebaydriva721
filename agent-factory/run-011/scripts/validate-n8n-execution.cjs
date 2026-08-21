'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { parseExecution } = require('../../run-004/scripts/validate-n8n-execution.cjs');

function validateExecution(execution) {
  const workflow = execution.data?.workflowData;
  const terminalRuns = execution.data?.resultData?.runData?.['Internal OIT Result'];
  if (workflow) {
    assert.equal(workflow.id, 'RUN011G4OIT');
    assert.equal(workflow.active, false);
  }
  assert.equal(execution.mode, 'cli');
  assert.equal(execution.finished, true);
  assert.equal(execution.data?.resultData?.error, undefined);
  assert.equal(execution.data?.resultData?.lastNodeExecuted, 'Internal OIT Result');
  assert.ok(Array.isArray(terminalRuns) && terminalRuns.length === 1);
  const items = terminalRuns[0]?.data?.main?.[0] || [];
  assert.equal(items.length, 1);
  const result = items[0].json;
  assert.equal(result.runId, 'OPP-INTEL-011');
  assert.equal(result.gate, 'G4');
  assert.equal(result.status, 'Pass');
  assert.equal(result.summary.candidatesIn, 3);
  assert.equal(result.summary.escalated, 1);
  assert.equal(result.summary.watched, 1);
  assert.equal(result.summary.archived, 1);
  assert.equal(result.summary.blocked, 0);
  assert.equal(result.summary.duplicatesSuppressed, 1);
  assert.equal(result.externalActions, 0);
  assert.equal(result.canonicalPortfolioWrites, 0);
  assert.equal(result.aiCalls, 0);
  assert.equal(result.incrementalCostUsd, 0);
  return {
    result: 'Pass',
    workflowId: workflow?.id ?? 'RUN011G4OIT',
    workflowActive: workflow?.active ?? 'verified-by-export-step',
    candidatesIn: result.summary.candidatesIn,
    escalated: result.summary.escalated,
    watched: result.summary.watched,
    archived: result.summary.archived,
    duplicatesSuppressed: result.summary.duplicatesSuppressed,
    externalActions: 0,
    canonicalPortfolioWrites: 0,
    aiCalls: 0,
    incrementalCostUsd: 0
  };
}

if (require.main === module) {
  const file = process.argv[2];
  if (!file) throw new Error('Execution JSON path is required');
  const summary = validateExecution(parseExecution(fs.readFileSync(file, 'utf8')));
  process.stdout.write(JSON.stringify(summary, null, 2) + '\n');
}

module.exports = { validateExecution };
