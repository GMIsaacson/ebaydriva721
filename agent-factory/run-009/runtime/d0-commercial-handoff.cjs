const {
  deterministicIdempotencyKey,
  integrityKey,
  validateEventEnvelope,
} = require('../../run-008/runtime/runtime.cjs');

const PRODUCER_ID = 'MUNI-INTEL-009';
const CONTRACT_VERSION = 'CCLC-001-v1.0';
const RECEIVER = 'COMM-CONV-001-v1.0';

function requireActionableProject(project) {
  if (!project || typeof project !== 'object' || Array.isArray(project)) throw new Error('project_required');
  if (!project.opportunityId) throw new Error('missing_opportunity_id');
  if (!project.projectName) throw new Error('missing_project_name');
  if (!project.municipality) throw new Error('missing_municipality');
  if (!project.location) throw new Error('missing_location');
  if (!project.projectStage) throw new Error('missing_project_stage');
  if (!project.electricalThesis) throw new Error('missing_electrical_thesis');
  if (!Array.isArray(project.evidence) || project.evidence.length === 0) throw new Error('authoritative_evidence_required');
  if (project.qa?.status !== 'PASS') throw new Error('qa_pass_required');
  if (!Number.isFinite(Number(project.confidence)) || Number(project.confidence) < 0.75) throw new Error('confidence_below_floor');
  return project;
}

function normalizeIso(value, fallback) {
  const parsed = value && Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : fallback;
}

function projectToOpsCoreEvent(project, { observedAt = new Date().toISOString() } = {}) {
  const p = requireActionableProject(project);
  const occurredAt = normalizeIso(p.freshness?.lastVerifiedAt || p.freshness?.firstObservedAt, observedAt);
  const payload = {
    schema: 'canonical_project_package_v1',
    opportunityId: p.opportunityId,
    projectName: p.projectName,
    municipality: p.municipality,
    location: p.location,
    projectType: p.projectType || 'other_commercial',
    projectStage: p.projectStage,
    scale: p.scale || {},
    entities: p.entities || {},
    electricalThesis: p.electricalThesis,
    likelyElectricalScopes: p.likelyElectricalScopes || [],
    timingWindow: p.timingWindow || null,
    recommendedNextAction: p.recommendedNextAction || null,
    confidence: Number(p.confidence),
    evidence: p.evidence,
    freshness: p.freshness || {},
    qa: p.qa,
  };
  const subjectId = `municipal-project:${p.opportunityId}`;
  const idempotencyKey = deterministicIdempotencyKey({
    producerId: PRODUCER_ID,
    eventType: 'municipal.project.intelligence.ready',
    subjectId,
    naturalKey: p.opportunityId,
    payload,
  });
  const event = {
    eventId: `evt:${PRODUCER_ID}:${p.opportunityId}:${idempotencyKey.slice(-12)}`,
    eventType: 'municipal.project.intelligence.ready',
    producerId: PRODUCER_ID,
    subjectId,
    sourceId: null,
    occurredAt,
    observedAt: normalizeIso(observedAt, new Date().toISOString()),
    provenance: 'DERIVED',
    payloadClass: 'STANDARD',
    integrityKey: integrityKey(payload),
    idempotencyKey,
    correlationId: `run009:${p.opportunityId}`,
    causationId: null,
    authorityContext: {
      mode: 'OBSERVE',
      externalActionAuthorized: false,
      approvalRef: null,
      costCeilingCents: 0,
    },
    payload,
  };
  const verdict = validateEventEnvelope(event);
  if (!verdict.valid) throw new Error(`invalid_ops_core_event:${verdict.errors.join(',')}`);
  return event;
}

function eventToPersistenceRow(event) {
  const verdict = validateEventEnvelope(event);
  if (!verdict.valid) throw new Error(`invalid_ops_core_event:${verdict.errors.join(',')}`);
  return {
    event_id: event.eventId,
    event_type: event.eventType,
    producer_id: event.producerId,
    subject_id: event.subjectId,
    source_id: event.sourceId,
    occurred_at: event.occurredAt,
    observed_at: event.observedAt,
    provenance: event.provenance,
    payload_class: event.payloadClass,
    integrity_key: event.integrityKey,
    idempotency_key: event.idempotencyKey,
    correlation_id: event.correlationId,
    causation_id: event.causationId,
    payload: event.payload,
  };
}

function projectToQualifiedOpportunityV1(project, event, { asOf = new Date().toISOString() } = {}) {
  const p = requireActionableProject(project);
  const validated = validateEventEnvelope(event);
  if (!validated.valid) throw new Error('valid_durable_event_required');
  if (event.subjectId !== `municipal-project:${p.opportunityId}`) throw new Error('project_event_mismatch');
  return {
    handoff_type: 'qualified_opportunity_v1',
    contract_version: CONTRACT_VERSION,
    receiver: RECEIVER,
    record_mode: 'SIMULATION',
    lifecycle_state: 'QUALIFIED_OPPORTUNITY',
    opportunity_id: `commercial:${p.opportunityId}:electrical`,
    source_opportunity_id: p.opportunityId,
    source_event_id: event.eventId,
    source_producer: PRODUCER_ID,
    organization_segment: 'Twin Cities commercial electrical contractors',
    need: `Early commercial project intelligence for ${p.projectName} in ${p.municipality}`,
    expected_value: p.scale?.estimatedValue || null,
    stage: p.projectStage,
    decision_maker: null,
    fit_urgency: {
      confidence: Number(p.confidence),
      timingWindow: p.timingWindow || null,
      thesis: p.electricalThesis,
    },
    evidence: p.evidence,
    owner: 'Run 009 / Aberdeen',
    next_action: 'Commercial receiver evaluates product-market validation eligibility; no contact is authorized.',
    next_action_owner: RECEIVER,
    next_action_due_at: null,
    created_at: asOf,
    updated_at: asOf,
    provenance_refs: [event.eventId, ...p.evidence.map((e) => e.sourceUrl).filter(Boolean)],
    correlation_id: event.correlationId,
    idempotency_key: `qopp:${event.idempotencyKey}`,
    blocked: true,
    blocked_reason: 'C0 external validation requires explicit owner approval; no-send/no-money D0 mode.',
    data_sensitivity_class: 'PUBLIC',
    authority: {
      external_actions: false,
      payment_actions: false,
      spend_cents: 0,
    },
  };
}

function buildD0Handoff(project, options = {}) {
  const event = projectToOpsCoreEvent(project, options);
  const persistenceRow = eventToPersistenceRow(event);
  const commercialHandoff = projectToQualifiedOpportunityV1(project, event, { asOf: options.observedAt || event.observedAt });
  return {
    gate: 'D0',
    mode: 'NO_SEND_NO_MONEY',
    externalActions: 0,
    spendCents: 0,
    paymentActions: 0,
    event,
    persistenceRow,
    commercialHandoff,
  };
}

module.exports = {
  requireActionableProject,
  projectToOpsCoreEvent,
  eventToPersistenceRow,
  projectToQualifiedOpportunityV1,
  buildD0Handoff,
};
