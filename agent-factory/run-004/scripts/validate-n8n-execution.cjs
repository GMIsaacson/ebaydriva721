const assert = require('node:assert/strict');
const fs = require('node:fs');

function parseExecution(raw) {
  const normalized = raw.replace(/^\uFEFF/, '');
  const starts = [0];
  for (const match of normalized.matchAll(/^\{/gm)) {
    starts.push(match.index);
  }

  for (const start of new Set(starts)) {
    try {
      const parsed = JSON.parse(normalized.slice(start).trim());
      if (parsed?.data?.resultData && parsed?.mode === 'cli') return parsed;
    } catch {
      // n8n may emit task-runner startup lines before --rawOutput JSON.
    }
  }
  throw new Error('No valid n8n CLI execution JSON found');
}

function validateExecution(execution) {
  const workflow = execution.data?.workflowData;
  const terminalRuns = execution.data?.resultData?.runData?.['Internal Result Only'];

  if (workflow) {
    assert.equal(workflow.id, 'RUN004G4OFFLINE');
    assert.equal(workflow.active, false);
  }
  assert.equal(execution.mode, 'cli');
  assert.equal(execution.finished, true);
  assert.equal(execution.data?.resultData?.error, undefined);
  assert.equal(execution.data?.resultData?.lastNodeExecuted, 'Internal Result Only');
  assert.ok(Array.isArray(terminalRuns) && terminalRuns.length === 1);

  const result = terminalRuns[0]?.data?.main?.[0]?.[0]?.json;
  assert.equal(result?.runId, 'DS-S2M-004');
  assert.equal(result?.guardStatus, 'Accepted');
  assert.equal(result?.status, 'Accepted');
  assert.deepEqual(result?.violations, []);
  assert.equal(result?.economics?.formulaVersion, 'datascout-landed-economics/1.0.0');
  assert.equal(result?.economics?.totalCostCents, 3100);
  assert.equal(result?.economics?.netProfitCents, 900);
  assert.equal(result?.economics?.breakEvenCollectedRevenueCents, 3100);
  assert.equal(result?.telemetry?.humanReviewRequired, false);
  assert.equal(result?.telemetry?.estimatedCostCents, 0);
  assert.equal(result?.telemetry?.externalActions, 0);
  assert.equal(result?.externalActions, 0);

  return {
    result: 'Pass',
    workflowId: workflow?.id ?? 'RUN004G4OFFLINE',
    workflowActive: workflow?.active ?? 'verified-by-export-step',
    executionMode: execution.mode,
    status: result.status,
    netProfitCents: result.economics.netProfitCents,
    externalActions: result.telemetry.externalActions,
    estimatedCostCents: result.telemetry.estimatedCostCents,
  };
}

if (require.main === module) {
  const file = process.argv[2];
  if (!file) throw new Error('Execution JSON path is required');
  const summary = validateExecution(parseExecution(fs.readFileSync(file, 'utf8')));
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

module.exports = { parseExecution, validateExecution };
