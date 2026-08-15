const { createHash } = require('node:crypto');

const FIXED = Object.freeze({
  runId: 'FACT-NOTIFY-005',
  gate: 'G6',
  workflowId: 'WF-FACT-NOTIFY-005-G6-001',
  approvalRef: 'CHATGPT-OWNER-APPROVAL-2026-08-15-RUN005',
  idempotencyKey: 'FACT-NOTIFY-005:G6:SELF-EMAIL:2026-08-15',
  subject: 'Agent Team Factory Run 005 — Controlled Live Pilot',
  body: 'This is the single owner-approved, zero-cost notification for Factory Run FACT-NOTIFY-005. No reply or action is required.',
});

class InMemoryIdempotencyStore {
  constructor() {
    this.keys = new Set();
  }

  claim(key) {
    if (this.keys.has(key)) return false;
    this.keys.add(key);
    return true;
  }
}

function hash(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function validatePacket(packet) {
  const violations = [];
  if (packet.runId !== FIXED.runId || packet.gate !== FIXED.gate) violations.push('wrong run or gate');
  if (packet.workflowId !== FIXED.workflowId) violations.push('wrong workflow');
  if (packet.approvalRef !== FIXED.approvalRef) violations.push('approval missing or changed');
  if (packet.idempotencyKey !== FIXED.idempotencyKey) violations.push('idempotency key changed');
  if (packet.recipient?.selector !== 'authenticated_self' || packet.recipient?.to !== 'me') violations.push('recipient is not authenticated self');
  if ((packet.recipient?.cc || []).length || (packet.recipient?.bcc || []).length) violations.push('cc or bcc added');
  if (packet.message?.subject !== FIXED.subject || packet.message?.body !== FIXED.body) violations.push('message content changed');
  if (packet.message?.mimeType !== 'text/plain') violations.push('message must be plain text');
  if ((packet.message?.attachments || []).length) violations.push('attachments added');
  if (/https?:\/\/|www\./i.test(packet.message?.body || '')) violations.push('link added');
  if (packet.control?.manualOnly !== true) violations.push('manual-only control removed');
  if (packet.control?.scheduleEnabled !== false || packet.control?.webhookEnabled !== false) violations.push('trigger expansion');
  if (packet.control?.maxExternalActions !== 1) violations.push('external-action limit changed');
  if (packet.control?.spendingAuthorityCents !== 0) violations.push('spending authority changed');
  if (packet.control?.maxAiCalls !== 0) violations.push('AI authority changed');
  if (packet.control?.retryOnUnknownOutcome !== false) violations.push('unsafe retry enabled');
  return violations;
}

function prepareDispatch(packet, store = new InMemoryIdempotencyStore()) {
  const violations = validatePacket(packet);
  if (violations.length) {
    return {
      runId: packet.runId,
      gate: packet.gate,
      status: 'Review',
      humanReviewRequired: true,
      retryAllowed: false,
      violations,
      externalActionsPerformed: 0,
      spendingCents: 0,
    };
  }
  if (!store.claim(packet.idempotencyKey)) {
    return {
      runId: packet.runId,
      gate: packet.gate,
      status: 'DuplicateSuppressed',
      humanReviewRequired: false,
      retryAllowed: false,
      idempotencyKey: packet.idempotencyKey,
      externalActionsPerformed: 0,
      spendingCents: 0,
    };
  }
  return {
    runId: packet.runId,
    gate: packet.gate,
    workflowId: packet.workflowId,
    traceId: packet.traceId,
    status: 'ReadyForApprovedExecutor',
    humanReviewRequired: false,
    retryAllowed: false,
    idempotencyKey: packet.idempotencyKey,
    approvalRef: packet.approvalRef,
    packetHash: hash(packet),
    executorHandoff: {
      action: 'gmail.send_email',
      recipient: 'me',
      subject: packet.message.subject,
      body: packet.message.body,
      mimeType: packet.message.mimeType,
      cc: [],
      bcc: [],
      attachments: [],
    },
    externalActionsPerformed: 0,
    externalActionLimit: 1,
    spendingCents: 0,
  };
}

function classifyExecutorOutcome(preflight, outcome) {
  if (preflight.status !== 'ReadyForApprovedExecutor') return preflight;
  if (outcome?.status === 'Sent' && typeof outcome.messageId === 'string' && outcome.messageId.length > 0) {
    return {
      ...preflight,
      status: 'Pass',
      humanReviewRequired: false,
      retryAllowed: false,
      externalActionsPerformed: 1,
      messageEvidencePresent: true,
    };
  }
  return {
    ...preflight,
    status: 'Review',
    humanReviewRequired: true,
    retryAllowed: false,
    externalActionsPerformed: outcome?.status === 'ConfirmedNotSent' ? 0 : 'Unknown',
    messageEvidencePresent: false,
    failureReason: 'Executor outcome is not a confirmed single send; do not retry automatically.',
  };
}

module.exports = { FIXED, InMemoryIdempotencyStore, classifyExecutorOutcome, hash, prepareDispatch, validatePacket };

