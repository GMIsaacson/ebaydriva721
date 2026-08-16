const test = require('node:test');
const assert = require('node:assert/strict');
const fixture = require('../fixtures/g5-shadow-two-sku.json');
const { buildEnvelope, executeShadow } = require('../scripts/run-g5-shadow.cjs');

const CLOCK = () => new Date(fixture.shadowExecutedAt);

test('G5 fixture is bounded, real, fresh, and credential-free', () => {
  assert.equal(fixture.gate, 'G5');
  assert.equal(fixture.candidates.length, 2);
  assert.equal(fixture.authority.candidateLimit, 2);
  assert.equal(fixture.authority.sourceRequestLimit, 7);
  assert.equal(fixture.authority.externalActionsEnabled, false);
  assert.equal(fixture.authority.spendingAuthorityCents, 0);
  assert.equal(fixture.authority.maxAiCalls, 0);
  assert.equal(fixture.authority.credentialMode, 'none');
  assert.ok(fixture.candidates.every((candidate) => candidate.source.sourceUrl.startsWith('https://www.uline.com/')));
  assert.ok(
    fixture.candidates.every((candidate) =>
      candidate.marketplaceComparables.every((item) => item.sourceUrl.startsWith('https://www.ebay.com/')),
    ),
  );
});

test('typed handoffs retain exact identity and sold evidence', () => {
  for (const candidate of fixture.candidates) {
    const envelope = buildEnvelope(candidate, fixture, CLOCK());
    assert.deepEqual(envelope.handoff.candidate_ids, [candidate.candidateId]);
    assert.equal(envelope.request.exactIdentity, true);
    assert.equal(envelope.request.hasSoldEvidence, true);
    assert.equal(envelope.request.spendingRequestedCents, 0);
    assert.ok(envelope.handoff.evidence_refs.length >= 3);
  }
});

test('real inputs stop safely at incomplete economics without external action', async () => {
  const output = await executeShadow(fixture, CLOCK);
  assert.equal(output.gateResult, 'Pass');
  assert.equal(output.businessDecision, 'Incomplete');
  assert.equal(output.authority.externalActions, 0);
  assert.equal(output.authority.spendingCents, 0);
  assert.equal(output.authority.credentials, 0);
  assert.equal(output.results.length, 2);
  assert.ok(output.results.every((result) => result.actualStatus === 'Incomplete'));
  assert.ok(output.results.every((result) => result.humanReviewRequired === true));
  assert.ok(output.results.every((result) => result.missingEconomics.includes('inboundFreightCents')));
  assert.ok(output.results.every((result) => result.missingEconomics.includes('outboundShippingCents')));
});

test('shadow configuration rejects any authority expansion', async () => {
  const expanded = structuredClone(fixture);
  expanded.authority.spendingAuthorityCents = 1;
  await assert.rejects(() => executeShadow(expanded, CLOCK), /spending authority/);
});
