const test = require('node:test');
const assert = require('node:assert/strict');
const fixture = require('../fixtures/approved-self-email.json');
const {
  InMemoryIdempotencyStore,
  classifyExecutorOutcome,
  prepareDispatch,
  validatePacket,
} = require('../runtime/pilot.cjs');

test('approved fixed self-email becomes one executor handoff', () => {
  const result = prepareDispatch(structuredClone(fixture));
  assert.equal(result.status, 'ReadyForApprovedExecutor');
  assert.equal(result.executorHandoff.action, 'gmail.send_email');
  assert.equal(result.executorHandoff.recipient, 'me');
  assert.equal(result.externalActionLimit, 1);
  assert.equal(result.spendingCents, 0);
  assert.equal(result.retryAllowed, false);
});

test('duplicate event is suppressed before a second handoff', () => {
  const store = new InMemoryIdempotencyStore();
  assert.equal(prepareDispatch(structuredClone(fixture), store).status, 'ReadyForApprovedExecutor');
  const duplicate = prepareDispatch(structuredClone(fixture), store);
  assert.equal(duplicate.status, 'DuplicateSuppressed');
  assert.equal(duplicate.externalActionsPerformed, 0);
});

for (const [name, mutate, expected] of [
  ['alternate recipient', (x) => { x.recipient.to = 'someone@example.com'; }, 'recipient is not authenticated self'],
  ['cc recipient', (x) => { x.recipient.cc = ['someone@example.com']; }, 'cc or bcc added'],
  ['attachment', (x) => { x.message.attachments = ['file.txt']; }, 'attachments added'],
  ['link', (x) => { x.message.body = `${x.message.body} https://example.com`; }, 'message content changed'],
  ['spending', (x) => { x.control.spendingAuthorityCents = 1; }, 'spending authority changed'],
  ['schedule', (x) => { x.control.scheduleEnabled = true; }, 'trigger expansion'],
  ['unsafe retry', (x) => { x.control.retryOnUnknownOutcome = true; }, 'unsafe retry enabled'],
  ['approval change', (x) => { x.approvalRef = 'UNAPPROVED'; }, 'approval missing or changed'],
]) {
  test(`authority guard rejects ${name}`, () => {
    const changed = structuredClone(fixture);
    mutate(changed);
    assert.ok(validatePacket(changed).includes(expected));
    assert.equal(prepareDispatch(changed).status, 'Review');
  });
}

test('confirmed send is a one-action pass', () => {
  const preflight = prepareDispatch(structuredClone(fixture));
  const result = classifyExecutorOutcome(preflight, { status: 'Sent', messageId: 'provider-message-id' });
  assert.equal(result.status, 'Pass');
  assert.equal(result.externalActionsPerformed, 1);
  assert.equal(result.messageEvidencePresent, true);
});

test('unknown executor outcome never retries automatically', () => {
  const preflight = prepareDispatch(structuredClone(fixture));
  const result = classifyExecutorOutcome(preflight, { status: 'Unknown' });
  assert.equal(result.status, 'Review');
  assert.equal(result.retryAllowed, false);
  assert.equal(result.externalActionsPerformed, 'Unknown');
});

