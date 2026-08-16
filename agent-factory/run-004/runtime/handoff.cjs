const { RUN_ID } = require('./config.cjs');

const REQUIRED_FIELDS = Object.freeze([
  'schema_version',
  'run_id',
  'handoff_id',
  'idempotency_key',
  'producer_agent_id',
  'consumer_agent_id',
  'opportunity_url',
  'candidate_ids',
  'evidence_refs',
  'decision_requested',
  'expires_at',
  'status',
]);

const HANDOFF_STATUSES = Object.freeze(['Accepted', 'Rejected', 'Incomplete', 'Review', 'Cancelled']);
const BUILDER_ID = 'AGT-OFFER-ASSET-BUILDER-001';

function validateHandoff(envelope, config, now = new Date()) {
  const errors = [];
  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) {
    return { valid: false, errors: ['handoff must be an object'] };
  }

  for (const field of REQUIRED_FIELDS) {
    if (envelope[field] === undefined || envelope[field] === null || envelope[field] === '') {
      errors.push(`${field} is required`);
    }
  }

  if (envelope.schema_version !== '1.0') errors.push('schema_version must be 1.0');
  if (envelope.run_id !== RUN_ID || envelope.run_id !== config.runId) errors.push(`run_id must be ${RUN_ID}`);
  if (!config.participants.includes(envelope.producer_agent_id)) errors.push('producer_agent_id is not registered');
  if (!config.participants.includes(envelope.consumer_agent_id)) errors.push('consumer_agent_id is not registered');
  if (!HANDOFF_STATUSES.includes(envelope.status)) errors.push('status is invalid');
  if (!Array.isArray(envelope.candidate_ids) || envelope.candidate_ids.length === 0) {
    errors.push('candidate_ids must be a non-empty array');
  } else if (envelope.candidate_ids.length > config.maxCandidates) {
    errors.push(`candidate_ids exceeds cap ${config.maxCandidates}`);
  }
  if (!Array.isArray(envelope.evidence_refs) || envelope.evidence_refs.length === 0) {
    errors.push('evidence_refs must be a non-empty array');
  }
  if (!new RegExp(`^${RUN_ID}:(H1|H2|H3|H4):[a-fA-F0-9]{8,64}$`).test(envelope.idempotency_key || '')) {
    errors.push('idempotency_key must be run_id + H1..H4 + normalized input hash');
  }

  const expiresAt = Date.parse(envelope.expires_at);
  if (!Number.isFinite(expiresAt)) errors.push('expires_at must be an ISO-8601 datetime');
  const expired = Number.isFinite(expiresAt) && expiresAt <= now.getTime();

  const touchesBuilder =
    envelope.producer_agent_id === BUILDER_ID || envelope.consumer_agent_id === BUILDER_ID;
  if (touchesBuilder && !envelope.approval_ref) errors.push('approval_ref is required for the Builder branch');

  if (['Rejected', 'Incomplete'].includes(envelope.status)) {
    if (!envelope.rejection_reason) errors.push('rejection_reason is required');
    if (!envelope.recovery_action) errors.push('recovery_action is required');
  }

  return {
    valid: errors.length === 0 && !expired,
    errors,
    expired,
    status: expired ? 'Review' : errors.length ? 'Rejected' : 'Accepted',
  };
}

module.exports = {
  BUILDER_ID,
  HANDOFF_STATUSES,
  REQUIRED_FIELDS,
  validateHandoff,
};
