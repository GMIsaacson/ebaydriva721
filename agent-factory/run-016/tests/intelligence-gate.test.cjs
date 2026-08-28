'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const gate = require('../runtime/intelligence-gate.cjs');
const taxonomy = require('../config/technology-taxonomy.json');

const AS_OF = '2026-08-28T12:00:00Z';

function source(overrides = {}) {
  return {
    url: 'https://example.org/evidence/1',
    publisher: 'Example Robotics',
    tier: 'primary',
    independentKey: 'example-robotics',
    publishedAt: '2026-08-28T08:00:00Z',
    ...overrides,
  };
}

function event(overrides = {}) {
  return {
    eventId: 'EV-001',
    title: 'Commercial robot system becomes orderable',
    domain: 'robotics-autonomy',
    actor: 'Example Robotics',
    action: 'released',
    object: 'commercial robot system',
    location: 'United States',
    publishedAt: '2026-08-28T08:00:00Z',
    observedAt: AS_OF,
    summary: 'The company opened orders for a new commercial robot system.',
    claimMode: 'VERIFIED_FACT',
    sources: [source()],
    priceMentioned: true,
    price: { amount: 24999, currency: 'USD', basis: 'one base unit', region: 'United States', observedAt: AS_OF, availability: 'orderable', sourceUrl: 'https://example.org/evidence/1' },
    signals: { novelty: 92, consequence: 88, confidence: 90, immediacy: 90, adoptionReadiness: 90, watchPriority: 95 },
    alertEligible: true,
    ...overrides,
  };
}

test('priced orderable robotics development qualifies for urgent alert', () => {
  assert.equal(gate.evaluateEvent(event(), { asOf: AS_OF }).decision, 'URGENT_ALERT');
});

test('direct Emad-style statement is attributed without being mislabeled externally verified', () => {
  const result = gate.evaluateEvent(event({
    eventId: 'EV-EMAD', claimMode: 'FIRSTHAND_STATEMENT', priceMentioned: false,
    sources: [source({ publisher: 'Host channel', independentKey: 'host-channel', directStatement: true })],
    signals: { novelty: 95, consequence: 94, confidence: 72, immediacy: 92, adoptionReadiness: 88, watchPriority: 100 },
  }), { asOf: AS_OF });
  assert.equal(result.decision, 'URGENT_ALERT');
  assert.equal(result.evidenceStatus, 'ATTRIBUTED');
  assert.ok(result.labels.includes('FIRSTHAND_ATTRIBUTION_NOT_EXTERNAL_VERIFICATION'));
});

test('firsthand claim without direct primary attribution is rejected', () => {
  const result = gate.evaluateEvent(event({ claimMode: 'FIRSTHAND_STATEMENT', sources: [source({ tier: 'lead-only' })] }), { asOf: AS_OF });
  assert.equal(result.decision, 'REJECT');
});

test('duplicate coverage without material delta is rejected', () => {
  assert.equal(gate.evaluateEvent(event({ duplicateOf: 'EV-OLD', materialDelta: false }), { asOf: AS_OF }).decision, 'REJECT');
});

test('duplicate story with evidenced material delta can proceed', () => {
  assert.equal(gate.evaluateEvent(event({ duplicateOf: 'EV-OLD', materialDelta: true }), { asOf: AS_OF }).decision, 'URGENT_ALERT');
});

test('stale event is rejected', () => {
  const result = gate.evaluateEvent(event({ publishedAt: '2026-08-01T00:00:00Z' }), { asOf: AS_OF });
  assert.match(result.rejectReasons.join(' '), /stale/);
});

test('missing source is rejected', () => {
  assert.equal(gate.evaluateEvent(event({ sources: [] }), { asOf: AS_OF }).decision, 'REJECT');
});

test('two independent secondary sources can verify an external fact', () => {
  const result = gate.evaluateEvent(event({
    priceMentioned: false,
    sources: [
      source({ tier: 'authoritative-secondary', publisher: 'Newsroom A', independentKey: 'newsroom-a' }),
      source({ url: 'https://example.net/report', tier: 'specialist-secondary', publisher: 'Trade B', independentKey: 'trade-b' }),
    ],
  }), { asOf: AS_OF });
  assert.equal(result.evidenceStatus, 'VERIFIED');
});

test('two stories from the same publisher are not independent corroboration', () => {
  const result = gate.evaluateEvent(event({
    priceMentioned: false,
    sources: [
      source({ tier: 'authoritative-secondary', independentKey: 'same-owner' }),
      source({ url: 'https://example.org/evidence/2', tier: 'specialist-secondary', independentKey: 'same-owner' }),
    ],
  }), { asOf: AS_OF });
  assert.equal(result.decision, 'REJECT');
});

test('preliminary medicine finding retains stage and regulatory labels', () => {
  const result = gate.evaluateEvent(event({
    domain: 'medicine-healthcare', claimMode: 'PRELIMINARY_FINDING', priceMentioned: false,
    clinicalStage: 'Phase 1', regulatoryStatus: 'investigational', highStakesClaim: true,
  }), { asOf: AS_OF });
  assert.notEqual(result.decision, 'REJECT');
  assert.ok(result.labels.includes('PRELIMINARY_NOT_CLINICAL_OR_COMMERCIAL_PROOF'));
});

test('medicine claim without stage and regulator status is rejected', () => {
  const result = gate.evaluateEvent(event({ domain: 'medicine-healthcare', priceMentioned: false, highStakesClaim: true }), { asOf: AS_OF });
  assert.match(result.rejectReasons.join(' '), /clinicalStage/);
});

test('public defense capability summary can enter the brief', () => {
  const result = gate.evaluateEvent(event({ domain: 'defense-dual-use', priceMentioned: false, contentSafety: 'public-capability-summary' }), { asOf: AS_OF });
  assert.notEqual(result.decision, 'REJECT');
});

test('tactical operational instruction is rejected', () => {
  const result = gate.evaluateEvent(event({ domain: 'defense-dual-use', priceMentioned: false, contentSafety: 'public-capability-summary', operationalInstruction: true }), { asOf: AS_OF });
  assert.match(result.rejectReasons.join(' '), /operational instruction/);
});

test('prompt-injection-like source directive is rejected and cannot alter policy', () => {
  const result = gate.evaluateEvent(event({ untrustedDirectiveDetected: true }), { asOf: AS_OF });
  assert.equal(result.decision, 'REJECT');
  assert.equal(result.notificationAuthorized, false);
});

test('price without basis and direct URL is rejected', () => {
  const result = gate.evaluateEvent(event({ price: { amount: 20000, currency: 'USD', region: 'US', observedAt: AS_OF, availability: 'announced' } }), { asOf: AS_OF });
  assert.match(result.rejectReasons.join(' '), /price.basis/);
});

test('low-significance material is rejected as garbage', () => {
  const result = gate.evaluateEvent(event({ signals: { novelty: 10, consequence: 10, confidence: 80, immediacy: 10, adoptionReadiness: 10, watchPriority: 10 } }), { asOf: AS_OF });
  assert.equal(result.decision, 'REJECT');
});

test('unknown new field routes to emerging-unclassified instead of disappearing', () => {
  const result = gate.evaluateEvent(event({ domain: 'neuromorphic-bio-compute' }), { asOf: AS_OF });
  assert.equal(result.domain, 'emerging-unclassified');
  assert.ok(result.labels.includes('ROUTED_UNCLASSIFIED'));
});

test('coverage audit includes every governed domain and never claims completeness', () => {
  const audit = gate.auditCoverage([event()]);
  assert.equal(audit.domainCount, taxonomy.domains.length);
  assert.equal(audit.completenessClaimed, false);
  assert.ok(audit.blindSpots.includes('medicine-healthcare'));
});

test('batch processing dead-letters unavailable sources and rejects duplicate event ids', () => {
  const batch = gate.evaluateBatch([event(), event(), event({ eventId: 'EV-OFF', sourceFetchStatus: 'UNAVAILABLE' })], { asOf: AS_OF });
  assert.equal(batch.terminalState, 'DELIVERED');
  assert.equal(batch.deadLetters.length, 1);
  assert.equal(batch.results[1].decision, 'REJECT');
  assert.equal(batch.externalActionsPerformed, 0);
});

test('volume or cost ceiling kills the batch before processing', () => {
  const batch = gate.evaluateBatch([event(), event({ eventId: 'EV-002' })], { asOf: AS_OF, maxItems: 1 });
  assert.equal(batch.terminalState, 'KILLED');
  assert.equal(batch.reason, 'cost-or-volume-limit-exhausted');
  assert.equal(batch.externalActionsPerformed, 0);
});
