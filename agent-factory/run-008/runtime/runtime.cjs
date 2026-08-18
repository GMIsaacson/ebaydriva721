const crypto = require('node:crypto');

const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const PROVENANCE = new Set(['DIRECT', 'DERIVED', 'HUMAN_SUPPLIED']);
const PAYLOAD_CLASSES = new Set(['MINIMAL', 'STANDARD', 'SENSITIVE']);
const AUTHORITY_MODES = new Set(['OBSERVE', 'INTERNAL_WRITE', 'EXTERNAL_WRITE_GATED']);
const SOURCE_CONNECTION_STATES = new Set(['PENDING', 'CONNECTED', 'DEGRADED', 'DISCONNECTED', 'RETIRED']);

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

function sourceHealthStatus(source, { asOf = new Date().toISOString(), maxHealthAgeHours = 24, credentialWarningDays = 14 } = {}) {
  const reasons = [];
  if (!source || typeof source !== 'object' || Array.isArray(source)) return { status:'CRITICAL', reasons:['INVALID_SOURCE'] };
  const connectionState = source.connectionState || source.connection_state;
  if (!SOURCE_CONNECTION_STATES.has(connectionState)) reasons.push('INVALID_CONNECTION_STATE');
  if (!ISO_DATE_TIME.test(asOf || '') || !Number.isFinite(maxHealthAgeHours) || maxHealthAgeHours <= 0 || !Number.isFinite(credentialWarningDays) || credentialWarningDays < 0) reasons.push('INVALID_HEALTH_POLICY');

  if (connectionState === 'DISCONNECTED') reasons.push('SOURCE_DISCONNECTED');
  if (connectionState === 'DEGRADED') reasons.push('SOURCE_DEGRADED');
  if (connectionState === 'PENDING') reasons.push('SOURCE_PENDING');
  if (connectionState === 'RETIRED') return { status:'RETIRED', reasons:[] };

  const metadata = source.metadata && typeof source.metadata === 'object' && !Array.isArray(source.metadata) ? source.metadata : {};
  const healthCheckedAt = metadata.healthCheckedAt;
  if (!healthCheckedAt || !ISO_DATE_TIME.test(healthCheckedAt) || Number.isNaN(Date.parse(healthCheckedAt))) reasons.push('HEALTH_CHECK_MISSING_OR_INVALID');
  else if (ISO_DATE_TIME.test(asOf || '') && (Date.parse(asOf) - Date.parse(healthCheckedAt)) > maxHealthAgeHours * 3600000) reasons.push('HEALTH_CHECK_STALE');

  if (source.credentialRef || source.credential_ref) {
    const credentialReviewAt = metadata.credentialReviewAt;
    if (!credentialReviewAt || !ISO_DATE_TIME.test(credentialReviewAt) || Number.isNaN(Date.parse(credentialReviewAt))) reasons.push('CREDENTIAL_REVIEW_MISSING_OR_INVALID');
  }

  const credentialExpiresAt = metadata.credentialExpiresAt;
  if (credentialExpiresAt !== undefined && credentialExpiresAt !== null && credentialExpiresAt !== '') {
    if (!ISO_DATE_TIME.test(credentialExpiresAt) || Number.isNaN(Date.parse(credentialExpiresAt))) reasons.push('CREDENTIAL_EXPIRY_INVALID');
    else if (ISO_DATE_TIME.test(asOf || '')) {
      const remainingMs = Date.parse(credentialExpiresAt) - Date.parse(asOf);
      if (remainingMs <= 0) reasons.push('CREDENTIAL_EXPIRED');
      else if (remainingMs <= credentialWarningDays * 86400000) reasons.push('CREDENTIAL_EXPIRING_SOON');
    }
  }

  const criticalReasons = new Set(['INVALID_CONNECTION_STATE','INVALID_HEALTH_POLICY','SOURCE_DISCONNECTED','CREDENTIAL_EXPIRED','CREDENTIAL_EXPIRY_INVALID']);
  const status = reasons.some((reason) => criticalReasons.has(reason)) ? 'CRITICAL' : reasons.length ? 'ATTENTION' : 'HEALTHY';
  return { status, reasons };
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

module.exports = { stableStringify, sha256, deterministicIdempotencyKey, integrityKey, validateEventEnvelope, heartbeatStatus, sourceHealthStatus, preflightAction, run006EvidenceToEvent };
