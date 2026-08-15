'use strict';

const FIXED = Object.freeze({
  runId: 'SUB-OPS-006',
  gate: 'G4',
  workflowId: 'WF-SUB-OPS-006-G4-001',
  workflowVersion: '1.0.0',
  maxItems: 100,
});

const PROHIBITED_ACTIONS = new Set([
  'purchase',
  'cancel',
  'upgrade',
  'downgrade',
  'refund',
  'dispute',
  'change_payment',
  'change_credentials',
  'delete_account',
  'contact_vendor',
  'send_message',
  'activate_schedule',
]);

const SENSITIVE_KEY = /(password|passwd|recovery.?code|api.?key|access.?token|refresh.?token|client.?secret|bank.?account|routing.?number|full.?card)/i;
const SENSITIVE_VALUE = /(password|passwd|recovery code|api key|access token|refresh token|client secret|bank account|routing number)\s*[:=]\s*\S+/i;
const FULL_CARD = /(?:\d[ -]*?){13,19}/;

function walk(value, path, findings) {
  if (value === null || value === undefined) return;
  if (Array.isArray(value)) {
    value.forEach((entry, index) => walk(entry, path.concat(String(index)), findings));
    return;
  }
  if (typeof value === 'object') {
    for (const [key, entry] of Object.entries(value)) {
      const nextPath = path.concat(key);
      if (SENSITIVE_KEY.test(key)) findings.push('sensitive key at ' + nextPath.join('.'));
      walk(entry, nextPath, findings);
    }
    return;
  }
  if (typeof value !== 'string') return;
  if (SENSITIVE_VALUE.test(value)) findings.push('secret-like value at ' + path.join('.'));
  if (FULL_CARD.test(value)) findings.push('full payment-card-like value at ' + path.join('.'));
}

function findSensitiveData(value) {
  const findings = [];
  walk(value, [], findings);
  return [...new Set(findings)];
}

function validateEnvelope(packet) {
  const violations = [];
  if (!packet || typeof packet !== 'object') return ['packet must be an object'];
  if (packet.runId !== FIXED.runId || packet.gate !== FIXED.gate) violations.push('wrong run or gate');
  if (packet.workflowId !== FIXED.workflowId || packet.workflowVersion !== FIXED.workflowVersion) violations.push('wrong workflow contract');
  if (typeof packet.eventId !== 'string' || packet.eventId.length < 8) violations.push('eventId missing');
  if (typeof packet.traceId !== 'string' || packet.traceId.length < 8) violations.push('traceId missing');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(packet.asOfDate || '')) violations.push('asOfDate must be YYYY-MM-DD');

  const control = packet.control || {};
  if (control.manualOnly !== true) violations.push('manual-only control removed');
  if (control.scheduleEnabled !== false || control.webhookEnabled !== false) violations.push('trigger expansion');
  if (control.maxExternalActions !== 0) violations.push('external actions enabled');
  if (control.maxNotionWrites !== 0) violations.push('live Notion writes enabled');
  if (control.spendingAuthorityCents !== 0) violations.push('spending authority enabled');
  if (control.maxAiCalls !== 0) violations.push('AI calls enabled at G4');
  if (control.retryOnUnknownOutcome !== false) violations.push('unsafe retry enabled');

  if (!Array.isArray(packet.items)) violations.push('items must be an array');
  else if (packet.items.length > FIXED.maxItems) violations.push('item limit exceeded');

  const requested = Array.isArray(packet.requestedActions) ? packet.requestedActions : [];
  for (const action of requested) {
    if (PROHIBITED_ACTIONS.has(String(action).toLowerCase())) violations.push('prohibited action requested: ' + action);
    else violations.push('G4 requestedActions must be empty');
  }

  violations.push(...findSensitiveData(packet));
  return [...new Set(violations)];
}

module.exports = {
  FIXED,
  PROHIBITED_ACTIONS,
  findSensitiveData,
  validateEnvelope,
};
