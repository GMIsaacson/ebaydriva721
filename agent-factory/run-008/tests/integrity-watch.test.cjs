const test = require('node:test');
const assert = require('node:assert/strict');
const { reconcileState, reconciliationToDecision } = require('../runtime/integrity-watch.cjs');

const asOf = '2026-08-20T01:00:00.000Z';

function baseInput() {
  return {
    subjectId: 'infra:n8n-nonprod-host',
    canonical: {
      memoryGiB: 2,
      n8n: { status: 'running', restartCount: 0 },
      postgres: { status: 'running', restartCount: 0 }
    },
    observed: {
      memoryGiB: 2,
      n8n: { status: 'running', restartCount: 0 },
      postgres: { status: 'running', restartCount: 0 }
    },
    compareFields: [
      'memoryGiB',
      'n8n.status',
      'n8n.restartCount',
      'postgres.status',
      'postgres.restartCount'
    ],
    observedAt: '2026-08-20T00:59:30.000Z',
    asOf,
    maxObservationAgeSeconds: 300
  };
}

test('matching canonical and live state is IN_SYNC and does not create a decision', () => {
  const result = reconcileState(baseInput());
  assert.equal(result.status, 'IN_SYNC');
  assert.equal(result.failClosed, false);
  assert.deepEqual(result.differences, []);
  assert.match(result.evidenceHash, /^sha256:[a-f0-9]{64}$/);
  assert.equal(reconciliationToDecision({ subjectId:'infra:n8n-nonprod-host', result }), null);
});

test('changed server memory is detected as deterministic drift', () => {
  const input = baseInput();
  input.canonical.memoryGiB = 1;
  const result = reconcileState(input);
  assert.equal(result.status, 'DRIFT');
  assert.equal(result.failClosed, true);
  assert.deepEqual(result.differences, [{ field:'memoryGiB', expected:1, observed:2 }]);

  const decisionResult = reconciliationToDecision({ subjectId:input.subjectId, result });
  assert.equal(decisionResult.valid, true);
  assert.equal(decisionResult.decision.decisionType, 'LIVE_STATE_DRIFT');
  assert.equal(decisionResult.decision.severity, 'ATTENTION');
  assert.equal(decisionResult.decision.authorityRequired, 'OWNER_APPROVAL');
  assert.equal(decisionResult.decision.estimatedCostCents, 0);
});

test('stale observation fails closed instead of declaring state healthy', () => {
  const input = baseInput();
  input.observedAt = '2026-08-20T00:00:00.000Z';
  const result = reconcileState(input);
  assert.equal(result.status, 'UNKNOWN');
  assert.equal(result.failClosed, true);
  assert.deepEqual(result.reasons, ['OBSERVATION_STALE']);

  const decisionResult = reconciliationToDecision({ subjectId:input.subjectId, result });
  assert.equal(decisionResult.valid, true);
  assert.equal(decisionResult.decision.decisionType, 'LIVE_STATE_UNKNOWN');
  assert.equal(decisionResult.decision.severity, 'URGENT');
});

test('missing live field fails closed and never guesses', () => {
  const input = baseInput();
  delete input.observed.postgres.status;
  const result = reconcileState(input);
  assert.equal(result.status, 'UNKNOWN');
  assert.equal(result.failClosed, true);
  assert.ok(result.reasons.includes('OBSERVED_FIELD_MISSING:postgres.status'));
});

test('repeated identical drift creates the same decision key', () => {
  const input = baseInput();
  input.canonical.memoryGiB = 1;
  const resultA = reconcileState(input);
  const resultB = reconcileState(input);
  const decisionA = reconciliationToDecision({ subjectId:input.subjectId, result:resultA });
  const decisionB = reconciliationToDecision({ subjectId:input.subjectId, result:resultB });
  assert.equal(decisionA.decision.decisionKey, decisionB.decision.decisionKey);
});
