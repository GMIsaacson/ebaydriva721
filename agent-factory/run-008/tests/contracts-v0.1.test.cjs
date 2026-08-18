const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.join(process.cwd(), 'agent-factory', 'run-008');
const contracts = JSON.parse(fs.readFileSync(path.join(root, 'contracts', 'core-contracts.v0.1.json'), 'utf8'));
const envelope = JSON.parse(fs.readFileSync(path.join(root, 'contracts', 'event-envelope.v0.1.schema.json'), 'utf8'));
const mapping = JSON.parse(fs.readFileSync(path.join(root, 'compatibility', 'run-006-mapping.v0.1.json'), 'utf8'));
const sql = fs.readFileSync(path.join(root, 'postgres', 'operations-core-v0.1.sql'), 'utf8');

test('global authority defaults remain closed', () => {
  assert.equal(contracts.globalRules.externalActionsDefault, 0);
  assert.equal(contracts.globalRules.productionScheduleAuthorized, false);
  assert.equal(contracts.globalRules.credentialsInSourceControl, false);
  assert.equal(contracts.globalRules.failClosedOnMissingAuthority, true);
});

test('canonical event requires provenance, integrity and idempotency', () => {
  for (const field of ['provenance','integrityKey','idempotencyKey','producerId','subjectId']) {
    assert.ok(envelope.required.includes(field), `${field} must be required`);
  }
});

test('storage enforces producer-scoped idempotency and action idempotency', () => {
  assert.match(sql, /UNIQUE \(producer_id, idempotency_key\)/);
  assert.match(sql, /idempotency_key text NOT NULL UNIQUE/);
});

test('cost and authority are represented before external execution', () => {
  assert.match(sql, /approved_ceiling_cents/);
  assert.match(sql, /approval_state/);
  assert.match(sql, /authority_required/);
});

test('watchers have a durable heartbeat model', () => {
  assert.match(sql, /CREATE TABLE IF NOT EXISTS ops_core_heartbeats/);
  assert.deepEqual(contracts.contracts.heartbeat.status, ['HEALTHY','STALE','DEGRADED','FAILED']);
});

test('Run 006 maps incrementally without authorizing new external actions', () => {
  assert.equal(mapping.compatibilityConclusion.breakingRefactorRequiredNow, false);
  assert.equal(mapping.compatibilityConclusion.canAdoptIncrementally, true);
  assert.equal(mapping.compatibilityConclusion.preserveRun006Gate, true);
  assert.equal(mapping.compatibilityConclusion.externalActionsAuthorizedByThisMapping, false);
});
