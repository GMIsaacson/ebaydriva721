const test = require('node:test');
const assert = require('node:assert/strict');
const fixture = require('../fixtures/normal-h2.json');
const { DEFAULT_CONFIG } = require('../runtime/config.cjs');
const { validateHandoff } = require('../runtime/handoff.cjs');
const { evaluatePolicy } = require('../runtime/policy.cjs');

const NOW = new Date('2026-08-13T09:30:00.000Z');

test('accepts the complete typed H2 fixture', () => {
  assert.deepEqual(validateHandoff(fixture.handoff, DEFAULT_CONFIG, NOW), {
    valid: true,
    errors: [],
    expired: false,
    status: 'Accepted',
  });
});

test('rejects narrative-only or malformed idempotency', () => {
  const handoff = { ...fixture.handoff, idempotency_key: 'please process this' };
  assert.match(validateHandoff(handoff, DEFAULT_CONFIG, NOW).errors.join(' '), /idempotency_key/);
});

test('routes expired evidence-bearing handoffs to Review', () => {
  const handoff = { ...fixture.handoff, expires_at: '2026-08-12T00:00:00.000Z' };
  const result = validateHandoff(handoff, DEFAULT_CONFIG, NOW);
  assert.equal(result.valid, false);
  assert.equal(result.status, 'Review');
});

test('requires exact approval for the Builder branch', () => {
  const handoff = {
    ...fixture.handoff,
    idempotency_key: 'DS-S2M-004:H3:0123456789abcdef',
    consumer_agent_id: 'AGT-OFFER-ASSET-BUILDER-001',
    approval_ref: null,
  };
  assert.match(validateHandoff(handoff, DEFAULT_CONFIG, NOW).errors.join(' '), /approval_ref/);
});

test('accepts the normal internal recommendation policy', () => {
  const result = evaluatePolicy(fixture.request, DEFAULT_CONFIG);
  assert.equal(result.status, 'Accepted');
  assert.equal(result.economics.netProfitCents, 900);
  assert.equal(result.externalActions, 0);
});

test('rejects prohibited external actions and spending', () => {
  assert.equal(evaluatePolicy({ ...fixture.request, requestedAction: 'purchase' }, DEFAULT_CONFIG).status, 'Rejected');
  assert.equal(
    evaluatePolicy({ ...fixture.request, spendingRequestedCents: 1 }, DEFAULT_CONFIG).status,
    'Rejected',
  );
});

test('blocks candidate and source-request overflow', () => {
  assert.equal(evaluatePolicy({ ...fixture.request, candidateCount: 26 }, DEFAULT_CONFIG).status, 'Rejected');
  assert.equal(
    evaluatePolicy({ ...fixture.request, sourceRequestCount: 201 }, DEFAULT_CONFIG).status,
    'Rejected',
  );
});

test('routes missing, stale, conflicting, and partial evidence safely', () => {
  assert.equal(evaluatePolicy({ ...fixture.request, hasSoldEvidence: false }, DEFAULT_CONFIG).status, 'Incomplete');
  assert.equal(evaluatePolicy({ ...fixture.request, evidenceAgeDays: 8 }, DEFAULT_CONFIG).status, 'Review');
  assert.equal(evaluatePolicy({ ...fixture.request, conflictingEvidence: true }, DEFAULT_CONFIG).status, 'Review');
  assert.equal(evaluatePolicy({ ...fixture.request, partialFailure: true }, DEFAULT_CONFIG).status, 'Incomplete');
});

test('ignores and logs prompt injection without changing authority', () => {
  const result = evaluatePolicy({ ...fixture.request, promptInjection: true }, DEFAULT_CONFIG);
  assert.equal(result.status, 'Accepted');
  assert.deepEqual(result.loggedEvents, ['prompt-injection-ignored']);
  assert.equal(result.externalActions, 0);
});
