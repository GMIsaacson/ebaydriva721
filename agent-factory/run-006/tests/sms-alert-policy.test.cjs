'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const policy = JSON.parse(fs.readFileSync(path.join(root, 'alerts/sms-alert-policy.json'), 'utf8'));
const workflow = JSON.parse(fs.readFileSync(path.join(root, 'n8n/run-006-g6-sms-urgent-dry-run.workflow.json'), 'utf8'));

test('SMS channel is dry-run only and inactive', () => {
  assert.equal(policy.status, 'DRY_RUN_ONLY');
  assert.equal(policy.activation.enabled, false);
  assert.equal(policy.activation.liveSendAuthorized, false);
  assert.equal(policy.activation.scheduleAuthorized, false);
  assert.equal(workflow.active, false);
  assert.equal(workflow.meta.dryRunOnly, true);
  assert.equal(workflow.meta.externalActions, 0);
  assert.equal(workflow.meta.spendCents, 0);
});

test('recipient is fixed-owner runtime secret only', () => {
  assert.equal(policy.recipient.mode, 'FIXED_OWNER_NUMBER_ONLY');
  assert.equal(policy.recipient.allowDynamicRecipients, false);
  assert.equal(policy.recipient.allowMultipleRecipients, false);
  assert.equal(policy.recipient.storeNumberInSourceControl, false);
  const text = JSON.stringify(workflow);
  assert.doesNotMatch(text, /\+1\d{10}/);
});

test('only approved urgent rules can enter SMS path', () => {
  assert.deepEqual(policy.allowedEvents.sort(), [
    'ACCOUNT_SECURITY_ANOMALY',
    'CANCELLATION_DEADLINE_3D',
    'PAYMENT_FAILED',
    'RENEWAL_3D_HIGH_RISK',
    'UNEXPECTED_HIGH_CHARGE'
  ].sort());
  const formatter = workflow.nodes.find(n => n.name === 'Validate And Format Urgent SMS');
  assert.ok(formatter);
  for (const event of policy.allowedEvents) assert.match(formatter.parameters.jsCode, new RegExp(event));
  assert.match(formatter.parameters.jsCode, /severity !== 'URGENT'/);
});

test('source-controlled workflow cannot send Twilio messages', () => {
  assert.equal(workflow.meta.twilioNodePresent, false);
  assert.equal(workflow.nodes.some(n => /twilio/i.test(n.type)), false);
  assert.equal(workflow.nodes.some(n => Object.prototype.hasOwnProperty.call(n, 'credentials')), false);
  assert.equal(workflow.nodes.some(n => /cron|schedule|webhook/i.test(n.type)), false);
});

test('message privacy and anti-spam controls are bounded', () => {
  assert.equal(policy.messagePolicy.maxMessagesPerIncidentPer24Hours, 1);
  assert.ok(policy.messagePolicy.maxCharacters <= 320);
  assert.equal(policy.messagePolicy.includeSensitiveCredentials, false);
  assert.equal(policy.messagePolicy.includeFullCardNumber, false);
  assert.equal(policy.messagePolicy.includeRawEmailBody, false);
  assert.equal(policy.authority.mayReplyToSms, false);
  assert.equal(policy.authority.mayReceiveCommandsBySms, false);
});

test('first live send remains separately owner-gated', () => {
  assert.equal(policy.activation.requiresG6ManualE2EPass, true);
  assert.equal(policy.activation.requiresSeparateOwnerApprovalForFirstLiveSend, true);
  assert.equal(policy.costControl.maxLiveMessagesPerRun, 1);
  assert.equal(policy.costControl.failClosedIfCostUnknown, true);
});
