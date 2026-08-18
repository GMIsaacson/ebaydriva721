const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const runtime = require('../runtime/runtime.cjs');

const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, '../../run-006/fixtures/synthetic-baseline.json'), 'utf8'));

test('deterministic idempotency keys are stable and payload-sensitive', () => {
  const input = { producerId:'P', eventType:'E', subjectId:'S', sourceId:'SRC', naturalKey:'N', payload:{b:2,a:1} };
  const a = runtime.deterministicIdempotencyKey(input);
  const b = runtime.deterministicIdempotencyKey({ ...input, payload:{a:1,b:2} });
  const c = runtime.deterministicIdempotencyKey({ ...input, payload:{a:1,b:3} });
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.match(a, /^idem:v1:[a-f0-9]{64}$/);
});

test('Run 006 synthetic evidence maps to a valid canonical event with zero authority', () => {
  const event = runtime.run006EvidenceToEvent(fixture.items[0]);
  const result = runtime.validateEventEnvelope(event);
  assert.equal(result.valid, true, result.errors.join(','));
  assert.equal(event.authorityContext.mode, 'OBSERVE');
  assert.equal(event.authorityContext.externalActionAuthorized, false);
  assert.equal(event.authorityContext.costCeilingCents, 0);
});

test('canonical event rejects payload tampering', () => {
  const event = runtime.run006EvidenceToEvent(fixture.items[0]);
  event.payload.amountCents += 1;
  const result = runtime.validateEventEnvelope(event);
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes('integrity:mismatch'));
});

test('all Run 006 synthetic evidence items can be emitted as canonical events', () => {
  const events = fixture.items.map((item) => runtime.run006EvidenceToEvent(item));
  assert.equal(events.length, fixture.items.length);
  assert.equal(new Set(events.map((e) => e.idempotencyKey)).size, events.length);
  for (const event of events) assert.equal(runtime.validateEventEnvelope(event).valid, true);
});

test('heartbeat is healthy inside cadence and stale after cadence plus tolerance', () => {
  const healthy = runtime.heartbeatStatus({ emittedAt:'2026-08-16T19:00:00.000Z', expectedCadenceSeconds:300, toleranceSeconds:60, asOf:'2026-08-16T19:05:00.000Z' });
  assert.equal(healthy.status, 'HEALTHY');
  const stale = runtime.heartbeatStatus({ emittedAt:'2026-08-16T19:00:00.000Z', expectedCadenceSeconds:300, toleranceSeconds:60, asOf:'2026-08-16T19:06:01.000Z' });
  assert.equal(stale.status, 'STALE');
});

test('heartbeat fails closed on invalid input', () => {
  const result = runtime.heartbeatStatus({ emittedAt:'bad-date', expectedCadenceSeconds:0, asOf:'2026-08-16T19:00:00.000Z' });
  assert.equal(result.status, 'FAILED');
});

test('connected source with fresh non-secret health metadata is healthy', () => {
  const result = runtime.sourceHealthStatus({
    sourceId:'github',
    connectionState:'CONNECTED',
    credentialRef:'secret-store://github/app',
    metadata:{
      healthCheckedAt:'2026-08-18T14:00:00.000Z',
      credentialReviewAt:'2026-08-18T14:00:00.000Z',
      credentialExpiresAt:'2026-10-18T14:00:00.000Z'
    }
  }, { asOf:'2026-08-18T15:00:00.000Z' });
  assert.deepEqual(result, { status:'HEALTHY', reasons:[] });
  assert.equal(JSON.stringify(result).includes('secret-store://github/app'), false);
});

test('degraded or stale source is attention without leaking credential reference', () => {
  const result = runtime.sourceHealthStatus({
    connectionState:'DEGRADED',
    credentialRef:'secret-store://provider/token',
    metadata:{ healthCheckedAt:'2026-08-16T12:00:00.000Z', credentialReviewAt:'2026-08-18T12:00:00.000Z' }
  }, { asOf:'2026-08-18T15:00:00.000Z', maxHealthAgeHours:24 });
  assert.equal(result.status, 'ATTENTION');
  assert.ok(result.reasons.includes('SOURCE_DEGRADED'));
  assert.ok(result.reasons.includes('HEALTH_CHECK_STALE'));
  assert.equal(JSON.stringify(result).includes('secret-store://provider/token'), false);
});

test('credential reference without review metadata needs attention', () => {
  const result = runtime.sourceHealthStatus({
    connectionState:'CONNECTED',
    credentialRef:'secret-store://provider/token',
    metadata:{ healthCheckedAt:'2026-08-18T14:00:00.000Z' }
  }, { asOf:'2026-08-18T15:00:00.000Z' });
  assert.equal(result.status, 'ATTENTION');
  assert.ok(result.reasons.includes('CREDENTIAL_REVIEW_MISSING_OR_INVALID'));
});

test('expired credential metadata is critical', () => {
  const result = runtime.sourceHealthStatus({
    connectionState:'CONNECTED',
    credentialRef:'secret-store://provider/token',
    metadata:{
      healthCheckedAt:'2026-08-18T14:00:00.000Z',
      credentialReviewAt:'2026-08-18T14:00:00.000Z',
      credentialExpiresAt:'2026-08-18T14:30:00.000Z'
    }
  }, { asOf:'2026-08-18T15:00:00.000Z' });
  assert.equal(result.status, 'CRITICAL');
  assert.ok(result.reasons.includes('CREDENTIAL_EXPIRED'));
});

test('credential nearing expiry is attention', () => {
  const result = runtime.sourceHealthStatus({
    connectionState:'CONNECTED',
    credentialRef:'secret-store://provider/token',
    metadata:{
      healthCheckedAt:'2026-08-18T14:00:00.000Z',
      credentialReviewAt:'2026-08-18T14:00:00.000Z',
      credentialExpiresAt:'2026-08-25T15:00:00.000Z'
    }
  }, { asOf:'2026-08-18T15:00:00.000Z', credentialWarningDays:14 });
  assert.equal(result.status, 'ATTENTION');
  assert.ok(result.reasons.includes('CREDENTIAL_EXPIRING_SOON'));
});

test('external action preflight denies missing approval', () => {
  const result = runtime.preflightAction({ actionId:'sms-1', idempotencyKey:'idem-1', estimatedCostCents:1, external:true, authorityContext:{ mode:'EXTERNAL_WRITE_GATED', externalActionAuthorized:false, approvalRef:null, costCeilingCents:5 } });
  assert.equal(result.allowed, false);
  assert.ok(result.reasons.includes('EXTERNAL_ACTION_NOT_AUTHORIZED'));
  assert.ok(result.reasons.includes('MISSING_APPROVAL_REF'));
});

test('external action preflight denies cost above approved ceiling', () => {
  const result = runtime.preflightAction({ actionId:'sms-2', idempotencyKey:'idem-2', estimatedCostCents:6, external:true, authorityContext:{ mode:'EXTERNAL_WRITE_GATED', externalActionAuthorized:true, approvalRef:'APPROVAL-1', costCeilingCents:5 } });
  assert.equal(result.allowed, false);
  assert.ok(result.reasons.includes('COST_CEILING_EXCEEDED'));
});

test('external action preflight permits only fully gated bounded action', () => {
  const result = runtime.preflightAction({ actionId:'sms-3', idempotencyKey:'idem-3', estimatedCostCents:2, external:true, authorityContext:{ mode:'EXTERNAL_WRITE_GATED', externalActionAuthorized:true, approvalRef:'APPROVAL-1', costCeilingCents:5 } });
  assert.deepEqual(result, { allowed:true, reasons:[] });
});
