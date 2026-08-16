'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const policy = JSON.parse(fs.readFileSync(path.join(root, 'alerts/owner-briefing-policy.json'), 'utf8'));

function rule(ids, id) {
  return ids.find((entry) => entry.ruleId === id);
}

test('default behavior is silent and no vendor authority is granted', () => {
  assert.equal(policy.defaultBehavior, 'SILENT');
  assert.equal(policy.authority.mayNotifyOwner, true);
  assert.equal(policy.authority.mayRecommend, true);
  assert.equal(policy.authority.mayTakeVendorAction, false);
  assert.equal(policy.authority.mayChangeSubscription, false);
  assert.equal(policy.authority.mayChangePaymentMethod, false);
  assert.equal(policy.authority.maySpend, false);
});

test('payment failure and security anomaly are immediate urgent alerts', () => {
  for (const id of ['PAYMENT_FAILED', 'ACCOUNT_SECURITY_ANOMALY']) {
    const found = rule(policy.immediateAlerts, id);
    assert.ok(found, id + ' missing');
    assert.equal(found.severity, 'URGENT');
  }
});

test('three-day cancellation deadline is immediate and never auto-cancels', () => {
  const found = rule(policy.immediateAlerts, 'CANCELLATION_DEADLINE_3D');
  assert.ok(found);
  assert.match(found.when, /within 3 calendar days|has passed/i);
  assert.match(found.ownerAction, /No cancellation is automatic/i);
});

test('renewals only interrupt immediately when both close and risky', () => {
  const found = rule(policy.immediateAlerts, 'RENEWAL_3D_HIGH_RISK');
  assert.ok(found);
  assert.match(found.when, /within 3 calendar days/i);
  assert.match(found.when, /AND/i);
  assert.match(found.when, /low|unused|price-changed|unverified|disputed|human-review-needed/i);
});

test('routine successful renewal and duplicate evidence stay silent', () => {
  assert.ok(rule(policy.silentRules, 'NORMAL_SUCCESSFUL_RENEWAL'));
  assert.ok(rule(policy.silentRules, 'DUPLICATE_RECEIPT'));
  assert.ok(rule(policy.silentRules, 'NO_MEANINGFUL_CHANGE'));
});

test('daily brief is exception-only and capped', () => {
  assert.equal(policy.briefSuppression.sendDailyBriefOnlyWhenItemsExist, true);
  assert.equal(policy.dailyBriefFormat.maxItems, 10);
  assert.ok(policy.dailyBriefFormat.requiredHeader.includes('items_needing_owner_attention'));
  assert.match(policy.dailyBriefFormat.footer, /No vendor, subscription, payment, credential, or spending action was taken/i);
});

test('unresolved items carry forward daily until resolved', () => {
  assert.equal(policy.briefSuppression.carryForwardUnresolvedItems, true);
  assert.match(policy.briefSuppression.carryForwardCadence, /daily brief/i);
  assert.equal(policy.briefSuppression.resolvedItemsDisappearFromBrief, true);
});

test('same event is deduplicated for 24 hours unless material facts change', () => {
  assert.equal(policy.deduplication.sameEventWindowHours, 24);
  assert.ok(policy.deduplication.repeatImmediateOnlyWhen.includes('severity_increased'));
  assert.ok(policy.deduplication.repeatImmediateOnlyWhen.includes('new_authoritative_evidence_changes_status'));
});
