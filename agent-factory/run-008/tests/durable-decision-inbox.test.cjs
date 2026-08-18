const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { run006ExceptionToDecision } = require('../compatibility/run006-decision-adapter.cjs');
const { routeDecision } = require('../runtime/decision-notification.cjs');

const sql = fs.readFileSync(path.join(__dirname,'..','postgres','decision-inbox-v0.2.sql'),'utf8');

test('durable inbox migration exposes four owner buckets and unique decision key', () => {
  for (const bucket of ['OVERDUE','URGENT_NOW','NEEDS_MY_APPROVAL','CAN_WAIT']) assert.match(sql, new RegExp(bucket));
  assert.match(sql, /UNIQUE INDEX IF NOT EXISTS ux_ops_core_decisions_decision_key/i);
  assert.match(sql, /ops_core_owner_open_decisions/i);
});

test('Run 006 high severity owner exception becomes urgent approval decision', () => {
  const result = run006ExceptionToDecision({
    code:'PAYMENT_FAILED', vendor:'Demo Vendor', severity:'High', humanApproval:true,
    evidenceId:'EV-006-1', reason:'Payment failed and owner review is required.',
    recommendation:'Verify payment status before any vendor action.', estimatedCostCents:2900
  });
  assert.equal(result.valid, true);
  assert.equal(result.decision.producerId, 'SUB-OPS-006');
  assert.equal(result.decision.authorityRequired, 'OWNER_APPROVAL');
  assert.equal(result.decision.severity, 'URGENT');
  assert.deepEqual(result.decision.evidenceRefs, ['EV-006-1']);
  const route = routeDecision(result.decision, { now:'2026-08-16T19:45:00.000Z' });
  assert.equal(route.channelClass, 'IMMEDIATE');
  assert.equal(route.shouldNotify, true);
});

test('Run 006 informational exception with no authority stays silent', () => {
  const result = run006ExceptionToDecision({ code:'EXPECTED_RENEWAL', vendor:'Demo', severity:'Low', humanApproval:false });
  assert.equal(result.valid, true);
  const route = routeDecision(result.decision, { now:'2026-08-16T19:45:00.000Z' });
  assert.equal(route.channelClass, 'SILENT');
  assert.equal(route.shouldNotify, false);
});
