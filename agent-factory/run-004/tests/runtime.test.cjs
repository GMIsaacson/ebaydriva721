const test = require('node:test');
const assert = require('node:assert/strict');
const fixture = require('../fixtures/normal-h2.json');
const { DEFAULT_CONFIG } = require('../runtime/config.cjs');
const { ControlledRuntime } = require('../runtime/runtime.cjs');
const { InMemoryRunStore } = require('../runtime/store.cjs');

const CLOCK = () => new Date('2026-08-13T09:30:00.000Z');

function setup() {
  const store = new InMemoryRunStore(CLOCK);
  const runtime = new ControlledRuntime({ config: DEFAULT_CONFIG, store, clock: CLOCK });
  runtime.start();
  return { runtime, store };
}

function withKey(suffix) {
  return {
    handoff: { ...fixture.handoff, handoff_id: `H2-${suffix}`, idempotency_key: `DS-S2M-004:H2:${suffix}` },
    request: structuredClone(fixture.request),
  };
}

test('executes one internal recommendation with complete telemetry', async () => {
  const { runtime, store } = setup();
  const result = await runtime.execute(fixture);
  assert.equal(result.status, 'Accepted');
  assert.equal(result.economics.netProfitCents, 900);
  assert.equal(result.externalActions, 0);
  assert.equal(store.attempts.length, 1);
  assert.equal(store.getControl(DEFAULT_CONFIG.runId).checkpoint.status, 'Accepted');
});

test('deduplicates a repeated handoff by idempotency key', async () => {
  const { runtime, store } = setup();
  await runtime.execute(fixture);
  const second = await runtime.execute(fixture);
  assert.equal(second.duplicate, true);
  assert.equal(store.attempts.length, 1);
  assert.equal(store.results.size, 1);
});

test('retries a transient operation twice then dead-letters it', async () => {
  const { runtime, store } = setup();
  let calls = 0;
  const result = await runtime.execute(withKey('aaaaaaaa'), async () => {
    calls += 1;
    const error = new Error('synthetic unavailable');
    error.code = 'UNAVAILABLE';
    throw error;
  });
  assert.equal(calls, 3);
  assert.equal(result.status, 'Review');
  assert.equal(result.retries, 2);
  assert.equal(store.deadLetters.length, 1);
});

test('does not retry a permission failure', async () => {
  const { runtime, store } = setup();
  let calls = 0;
  const result = await runtime.execute(withKey('bbbbbbbb'), async () => {
    calls += 1;
    const error = new Error('synthetic permission denied');
    error.code = 'PERMISSION_DENIED';
    throw error;
  });
  assert.equal(calls, 1);
  assert.equal(result.retries, 0);
  assert.equal(store.deadLetters.length, 1);
});

test('stop prevents work and restart resumes from the preserved checkpoint', async () => {
  const { runtime, store } = setup();
  await runtime.execute(withKey('cccccccc'));
  const before = store.getControl(DEFAULT_CONFIG.runId).checkpoint;
  runtime.stop('acceptance test');
  const stopped = await runtime.execute(withKey('dddddddd'));
  assert.equal(stopped.status, 'Review');
  const restarted = runtime.restart();
  assert.equal(restarted.state, 'running');
  assert.equal(restarted.restartCount, 1);
  assert.notDeepEqual(restarted.checkpoint, before);
  const resumed = await runtime.execute(withKey('eeeeeeee'));
  assert.equal(resumed.status, 'Accepted');
});

test('kill switch cancellation prevents restart and downstream work', async () => {
  const { runtime } = setup();
  runtime.cancel('owner kill switch');
  const result = await runtime.execute(withKey('ffffffff'));
  assert.equal(result.status, 'Cancelled');
  assert.throws(() => runtime.restart(), /kill switch/);
});

test('store rejects any authority expansion', () => {
  const { store } = setup();
  assert.throws(
    () => store.setControl(DEFAULT_CONFIG.runId, { externalActionsEnabled: true }),
    /external actions/,
  );
  assert.throws(
    () => store.setControl(DEFAULT_CONFIG.runId, { spendingAuthorityCents: 1 }),
    /spending authority/,
  );
});

test('malformed handoffs are rejected and queued for review', async () => {
  const { runtime, store } = setup();
  const malformed = withKey('11111111');
  delete malformed.handoff.producer_agent_id;
  const result = await runtime.execute(malformed);
  assert.equal(result.status, 'Rejected');
  assert.equal(store.reviews.length, 1);
  assert.equal(result.externalActions, 0);
});
