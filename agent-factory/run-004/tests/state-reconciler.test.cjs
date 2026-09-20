const test = require('node:test');
const assert = require('node:assert/strict');
const { reconcileSourceMarginState } = require('../runtime/state-reconciler.cjs');

function fixture() {
  return {
    now: '2026-09-19T22:00:00-05:00',
    maxAgeHours: 24,
    supabase: {
      asOf: '2026-09-19T21:30:00-05:00',
      projectId: 'SourceMargin',
      milestoneId: 'M-004',
      currentPhase: 'STAGE_2_VALIDATION',
      stage2: { frozen: 3, checkpointTarget: 10, cohortTarget: 100, sourceReady: 0, sampleReady: 0 },
      census: { creditedCoveragePct: 0, status: 'BOOTSTRAP' },
      blockers: ['taxonomy not yet imported'],
      sourceRefs: ['supabase://source-margin'],
    },
    workControl: {
      asOf: '2026-09-19T21:45:00-05:00',
      projectId: 'SourceMargin',
      milestoneId: 'M-004',
      activeWorkOrder: 'Stage 2 candidate #4',
      owner: 'Agent 000',
      lifecycle: 'READY',
      nextAction: 'Find and validate Stage 2 candidate #4',
      blockers: [],
      sourceRefs: ['work-control://M-004'],
    },
    github: {
      asOf: '2026-09-19T21:50:00-05:00',
      projectId: 'SourceMargin',
      milestoneId: 'M-004',
      currentPhase: 'STAGE_2_VALIDATION',
      stage2: { frozen: 3, checkpointTarget: 10, cohortTarget: 100, sourceReady: 0, sampleReady: 0 },
      census: { creditedCoveragePct: 0, status: 'BOOTSTRAP' },
      lastMaterialDecision: 'Stop at 10 frozen candidates if no SOURCE_READY or SAMPLE_READY result.',
      sourceRefs: ['github://GMIsaacson/sourcemargin1.0/docs/PROJECT_STATUS.md'],
    },
  };
}

test('consistent inputs produce deterministic idempotent receipt', () => {
  const a = reconcileSourceMarginState(fixture());
  const b = reconcileSourceMarginState(fixture());
  assert.equal(a.reconciliationStatus, 'CONSISTENT');
  assert.equal(a.receiptId, b.receiptId);
  assert.deepEqual(a, b);
  assert.equal(a.authority, 'Observe');
  assert.equal(a.stage2Checkpoint.frozen, 3);
  assert.equal(a.censusCoverage.creditedCoveragePct, 0);
});

test('contradictory stage checkpoint fails closed to CONFLICT', () => {
  const input = fixture();
  input.github.stage2.frozen = 4;
  const receipt = reconcileSourceMarginState(input);
  assert.equal(receipt.reconciliationStatus, 'CONFLICT');
  assert.ok(receipt.conflicts.some((item) => item.field === 'stage2.frozen'));
});

test('stale source fails closed to STALE', () => {
  const input = fixture();
  input.supabase.asOf = '2026-09-17T20:00:00-05:00';
  const receipt = reconcileSourceMarginState(input);
  assert.equal(receipt.reconciliationStatus, 'STALE');
  assert.equal(receipt.freshness.supabase.status, 'STALE');
});

test('missing owner or next action blocks execution', () => {
  const input = fixture();
  input.workControl.owner = '';
  input.workControl.nextAction = '';
  const receipt = reconcileSourceMarginState(input);
  assert.equal(receipt.reconciliationStatus, 'BLOCKED');
  assert.deepEqual(receipt.missingExecutionFields, ['owner', 'nextAction']);
});

test('receipt preserves evidence refs and ignores strategy-write fields', () => {
  const input = fixture();
  input.workControl.northStar = 'MUTATION ATTEMPT';
  input.github.killCriteria = ['MUTATION ATTEMPT'];
  const receipt = reconcileSourceMarginState(input);
  assert.equal(receipt.sourceRefs.length, 3);
  assert.equal(Object.hasOwn(receipt, 'northStar'), false);
  assert.equal(Object.hasOwn(receipt, 'killCriteria'), false);
});
