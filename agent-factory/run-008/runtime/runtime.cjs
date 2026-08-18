const crypto = require('node:crypto');

const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const PROVENANCE = new Set(['DIRECT', 'DERIVED', 'HUMAN_SUPPLIED']);
const PAYLOAD_CLASSES = new Set(['MINIMAL', 'STANDARD', 'SENSITIVE']);
const AUTHORITY_MODES = new Set(['OBSERVE', 'INTERNAL_WRITE', 'EXTERNAL_WRITE_GATED']);

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function deterministicIdempotencyKey({ producerId, eventType, subjectId, sourceId = '', naturalKey = '', payload = {} }) {
  const canonical = stableStringify({ producerId, eventType, subjectId, sourceId, naturalKey, payload });
  return `idem:v1:${sha256(canonical)}`;
}

function integrityKey(payload) {
  return `sha256:${sha256(stableStringify(payload))}`;
}

function validateEventEnvelope(event) {
  const errors = [];
  const required = ['eventId','eventType','producerId','subjectId','occurredAt','observedAt','provenance','payloadClass','integrityKey','idempotencyKey','payload'];
  for (const field of required) {
    if (event?.[field] === undefined || event?.[field] === null || event?.[field] === '') errors.push(`missing:${field}`);
  }
  for (const field of ['eventId','eventType','producerId','subjectId','integrityKey','idempotencyKey']) {
    if (event?.[field] !== undefined && typeof event[field] !== 'string') errors.push(`type:${field}`);
  }
  for (const field of ['occurredAt','observedAt']) {
    if (event?.[field] && (typeof event[field] !== 'string' || !ISO_DATE_TIME.test(event[field]) || Number.isNaN(Date.parse(event[field])))) errors.push(`datetime:${field}`);
  }
  if (event?.provenance && !PROVENANCE.has(event.provenance)) errors.push('enum:provenance');
  if (event?.payloadClass && !PAYLOAD_CLASSES.has(event.payloadClass)) errors.push('enum:payloadClass');
  if (event?.payload !== undefined && (event.payload === null || Array.isArray(event.payload) || typeof event.payload !== 'object')) errors.push('type:payload');
  if (event?.authorityContext !== undefined) {
    const a = event.authorityContext;
    if (!a || typeof a !== 'object' || Array.isArray(a)) errors.push('type:authorityContext');
    else {
      if (!AUTHORITY_MODES.has(a.mode)) errors.push('enum:authorityContext.mode');
      if (typeof a.externalActionAuthorized !== 'boolean') errors.push('type:authorityContext.externalActionAuthorized');
      if (!Number.isInteger(a.costCeilingCents) || a.costCeilingCents < 0) errors.push('type:authorityContext.costCeilingCents');
    }
  }
  if (event?.payload && event.integrityKey && event.integrityKey !== integrityKey(event.payload)) errors.push('integrity:mismatch');
  return { valid: errors.length === 0, errors };
}

function heartbeatStatus({ emittedAt, expectedCadenceSeconds, toleranceSeconds = 0, asOf = new Date().toISOString(), reportedStatus = 'HEALTHY' }) {
  if (!ISO_DATE_TIME.test(emittedAt || '') || !ISO_DATE_TIME.test(asOf || '') || !Number.isFinite(expectedCadenceSeconds) || expectedCadenceSeconds <= 0 || !Number.isFinite(toleranceSeconds) || toleranceSeconds < 0) {
    return { status: 'FAILED', ageSeconds: null, staleAfterSeconds: null, reason: 'INVALID_HEARTBEAT_INPUT' };
  }
  if (reportedStatus === 'FAILED') return { status: 'FAILED', ageSeconds: Math.max(0, (Date.parse(asOf)-Date.parse(emittedAt))/1000), staleAfterSeconds: expectedCadenceSeconds+toleranceSeconds, reason: 'WATCHER_REPORTED_FAILED' };
  if (reportedStatus === 'DEGRADED') return { status: 'DEGRADED', ageSeconds: Math.max(0, (Date.parse(asOf)-Date.parse(emittedAt))/1000), staleAfterSeconds: expectedCadenceSeconds+toleranceSeconds, reason: 'WATCHER_REPORTED_DEGRADED' };
  const ageSeconds = Math.max(0, (Date.parse(asOf) - Date.parse(emittedAt)) / 1000);
  const staleAfterSeconds = expectedCadenceSeconds + toleranceSeconds;
  return ageSeconds > staleAfterSeconds
    ? { status: 'STALE', ageSeconds, staleAfterSeconds, reason: 'MISSED_EXPECTED_CADENCE' }
    : { status: 'HEALTHY', ageSeconds, staleAfterSeconds, reason: 'WITHIN_EXPECTED_CADENCE' };
}

function preflightAction(action) {
  const reasons = [];
  if (!action || typeof action !== 'object') return { allowed: false, reasons: ['INVALID_ACTION'] };
  if (!action.actionId) reasons.push('MISSING_ACTION_ID');
  if (!action.idempotencyKey) reasons.push('MISSING_IDEMPOTENCY_KEY');
  if (!Number.isInteger(action.estimatedCostCents) || action.estimatedCostCents < 0) reasons.push('INVALID_ESTIMATED_COST');
  const authority = action.authorityContext;
  if (!authority || typeof authority !== 'object') reasons.push('MISSING_AUTHORITY_CONTEXT');
  else {
    if (!AUTHORITY_MODES.has(authority.mode)) reasons.push('INVALID_AUTHORITY_MODE');
    if (!Number.isInteger(authority.costCeilingCents) || authority.costCeilingCents < 0) reasons.push('INVALID_COST_CEILING');
    if (Number.isInteger(action.estimatedCostCents) && Number.isInteger(authority.costCeilingCents) && action.estimatedCostCents > authority.costCeilingCents) reasons.push('COST_CEILING_EXCEEDED');
    if (action.external === true) {
      if (authority.mode !== 'EXTERNAL_WRITE_GATED') reasons.push('EXTERNAL_MODE_NOT_GATED');
      if (authority.externalActionAuthorized !== true) reasons.push('EXTERNAL_ACTION_NOT_AUTHORIZED');
      if (!authority.approvalRef) reasons.push('MISSING_APPROVAL_REF');
    }
  }
  return { allowed: reasons.length === 0, reasons };
}

function run006EvidenceToEvent(item, { producerId = 'SUB-OPS-006', sourceId = 'run006:synthetic', observedAt = item.observedAt } = {}) {
  const payload = {
    evidenceId: item.evidenceId,
    sourceType: item.sourceType,
    sourceRef: item.sourceRef,
    vendor: item.vendor,
    productPlan: item.productPlan,
    amountCents: item.amountCents,
    currency: item.currency,
    billingCycle: item.billingCycle,
    renewalDate: item.renewalDate,
    cancellationDeadline: item.cancellationDeadline,
    autoRenew: item.autoRenew,
    usageState: item.usageState,
    trustLevel: item.trustLevel
  };
  const subjectId = `subscription:${String(item.vendor).toLowerCase().replace(/[^a-z0-9]+/g,'-')}:${String(item.productPlan).toLowerCase().replace(/[^a-z0-9]+/g,'-')}`;
  return {
    eventId: `evt:${producerId}:${item.evidenceId}`,
    eventType: 'subscription.evidence.observed',
    producerId,
    subjectId,
    sourceId,
    occurredAt: item.observedAt,
    observedAt,
    provenance: 'DIRECT',
    payloadClass: 'STANDARD',
    integrityKey: integrityKey(payload),
    idempotencyKey: deterministicIdempotencyKey({ producerId, eventType: 'subscription.evidence.observed', subjectId, sourceId, naturalKey: item.evidenceId, payload }),
    correlationId: null,
    causationId: null,
    authorityContext: { mode: 'OBSERVE', externalActionAuthorized: false, approvalRef: null, costCeilingCents: 0 },
    payload
  };
}

module.exports = { stableStringify, sha256, deterministicIdempotencyKey, integrityKey, validateEventEnvelope, heartbeatStatus, preflightAction, run006EvidenceToEvent };
