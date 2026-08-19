const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildD0Handoff,
  projectToOpsCoreEvent,
} = require('../runtime/d0-commercial-handoff.cjs');

const FIXTURE = {
  opportunityId: 'MPLS-PERMIT-DEMO-001',
  projectName: 'Commercial Permit Validation Fixture',
  municipality: 'Minneapolis',
  location: 'Minneapolis, MN',
  projectType: 'other_commercial',
  projectStage: 'permit',
  scale: { estimatedValue: 1250000 },
  entities: { owner: 'Evidence-only fixture owner' },
  electricalThesis: 'A material commercial permit can create electrical service, distribution, lighting, controls and low-voltage scope.',
  likelyElectricalScopes: ['service_and_distribution', 'lighting', 'controls'],
  timingWindow: 'permit-stage',
  recommendedNextAction: 'Validate project freshness before any commercial use.',
  confidence: 0.86,
  evidence: [{
    sourceType: 'permit',
    sourceUrl: 'https://www.minneapolismn.gov/',
    sourceDate: '2026-08-18',
    claimSupported: 'Synthetic fixture representing an authoritative municipal permit record for structural testing only.'
  }],
  freshness: {
    firstObservedAt: '2026-08-18T20:00:00.000Z',
    lastVerifiedAt: '2026-08-18T20:00:00.000Z'
  },
  qa: { duplicateChecked: true, unsupportedClaims: [], status: 'PASS' }
};

const OBSERVED_AT = '2026-08-18T20:05:00.000Z';

test('D0 produces a valid persistence row and qualified_opportunity_v1 with zero external authority', () => {
  const result = buildD0Handoff(FIXTURE, { observedAt: OBSERVED_AT });
  assert.equal(result.gate, 'D0');
  assert.equal(result.mode, 'NO_SEND_NO_MONEY');
  assert.equal(result.externalActions, 0);
  assert.equal(result.spendCents, 0);
  assert.equal(result.paymentActions, 0);
  assert.equal(result.persistenceRow.event_id, result.event.eventId);
  assert.equal(result.persistenceRow.producer_id, 'MUNI-INTEL-009');
  assert.equal(result.persistenceRow.provenance, 'DERIVED');
  assert.equal(result.commercialHandoff.handoff_type, 'qualified_opportunity_v1');
  assert.equal(result.commercialHandoff.receiver, 'COMM-CONV-001-v1.0');
  assert.equal(result.commercialHandoff.record_mode, 'SIMULATION');
  assert.equal(result.commercialHandoff.lifecycle_state, 'QUALIFIED_OPPORTUNITY');
  assert.equal(result.commercialHandoff.blocked, true);
  assert.equal(result.commercialHandoff.authority.external_actions, false);
  assert.equal(result.commercialHandoff.authority.payment_actions, false);
  assert.equal(result.commercialHandoff.authority.spend_cents, 0);
});

test('same project package is deterministic and idempotent', () => {
  const a = projectToOpsCoreEvent(FIXTURE, { observedAt: OBSERVED_AT });
  const b = projectToOpsCoreEvent(FIXTURE, { observedAt: OBSERVED_AT });
  assert.equal(a.idempotencyKey, b.idempotencyKey);
  assert.equal(a.integrityKey, b.integrityKey);
  assert.equal(a.eventId, b.eventId);
});

test('D0 fails closed on weak or unreviewed project intelligence', () => {
  assert.throws(() => buildD0Handoff({ ...FIXTURE, confidence: 0.60 }, { observedAt: OBSERVED_AT }), /confidence_below_floor/);
  assert.throws(() => buildD0Handoff({ ...FIXTURE, qa: { ...FIXTURE.qa, status: 'REVIEW' } }, { observedAt: OBSERVED_AT }), /qa_pass_required/);
  assert.throws(() => buildD0Handoff({ ...FIXTURE, evidence: [] }, { observedAt: OBSERVED_AT }), /authoritative_evidence_required/);
});

test('D0 rejects a mismatched project/event handoff', () => {
  const event = projectToOpsCoreEvent(FIXTURE, { observedAt: OBSERVED_AT });
  const other = { ...FIXTURE, opportunityId: 'OTHER-001' };
  const { projectToQualifiedOpportunityV1 } = require('../runtime/d0-commercial-handoff.cjs');
  assert.throws(() => projectToQualifiedOpportunityV1(other, event, { asOf: OBSERVED_AT }), /project_event_mismatch/);
});
