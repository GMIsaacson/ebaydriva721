const assert = require('node:assert/strict');
const fs = require('node:fs');

const file = process.argv[2];
if (!file) {
  throw new Error('Execution JSON path is required');
}

const execution = JSON.parse(fs.readFileSync(file, 'utf8'));
const workflow = execution.data?.workflowData;
const terminalRuns = execution.data?.resultData?.runData?.['Internal Result Only'];

assert.equal(workflow?.id, 'RUN004G4OFFLINE');
assert.equal(workflow?.active, false);
assert.equal(execution.mode, 'cli');
assert.equal(execution.finished, true);
assert.equal(execution.data?.resultData?.error, undefined);
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

process.stdout.write(
  `${JSON.stringify({
    result: 'Pass',
    workflowId: workflow.id,
    workflowActive: workflow.active,
    executionMode: execution.mode,
    status: result.status,
    netProfitCents: result.economics.netProfitCents,
    externalActions: result.telemetry.externalActions,
    estimatedCostCents: result.telemetry.estimatedCostCents,
  }, null, 2)}\n`,
);
