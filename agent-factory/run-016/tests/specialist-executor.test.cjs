'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { executeSpecialistCase } = require('../runtime/specialist-executor.cjs');

const baseCase = {
  caseId: 'WTI-REAL-EVIDENCE-SHADOW-001',
  title: 'Cross-domain AI robotics hardware development',
  domains: ['ai-software', 'robotics-autonomy', 'computing-semiconductors'],
  evidenceRefs: ['https://example.com/primary', 'https://example.com/independent'],
  evidencePayload: { bounded: true },
};

test('specialist executor fails closed without provider', async () => {
  await assert.rejects(
    () => executeSpecialistCase(baseCase),
    /WTI_SPECIALIST_PROVIDER_NOT_CONFIGURED/,
  );
});

test('specialist executor binds routed specialists and independent reviewers', async () => {
  const calls = [];
  async function provider(request) {
    calls.push(request);
    return {
      actorId: request.actorId,
      provider: 'deterministic-test-provider',
      model: 'fixture-v1',
      output: `${request.kind}:${request.actorId}`,
      evidenceRefs: request.evidenceRefs,
      confidence: 95,
      executionId: `${request.kind}-${request.actorId}`,
    };
  }

  const receipt = await executeSpecialistCase(baseCase, { provider });
  assert.equal(receipt.status, 'EXECUTED_PENDING_PROFESSIONAL_SCORING');
  assert.equal(receipt.externalActionsPerformed, 0);
  assert.equal(receipt.spendCents, 0);
  assert.ok(receipt.specialistExecutions.length >= 3);
  assert.ok(receipt.reviewExecutions.length >= 1);
  assert.ok(receipt.specialistExecutions.some((x) => x.actorId === 'wti-ai-software-specialist'));
  assert.ok(receipt.specialistExecutions.some((x) => x.actorId === 'wti-robotics-autonomy-specialist'));
  assert.ok(receipt.specialistExecutions.some((x) => x.actorId === 'wti-compute-semiconductor-specialist'));
  assert.ok(receipt.reviewExecutions.some((x) => x.actorId === 'wti-technical-evidence-reviewer'));
  assert.equal(calls.length, receipt.specialistExecutions.length + receipt.reviewExecutions.length);
});

test('clinical and price case requires clinical and price review', async () => {
  async function provider(request) {
    return {
      actorId: request.actorId,
      provider: 'deterministic-test-provider',
      model: 'fixture-v1',
      output: `${request.kind}:${request.actorId}`,
      evidenceRefs: request.evidenceRefs,
      executionId: request.actorId,
    };
  }
  const receipt = await executeSpecialistCase({
    ...baseCase,
    caseId: 'WTI-REAL-EVIDENCE-SHADOW-CLINICAL',
    domains: ['medicine-healthcare', 'biotech-synthetic-biology'],
    priceMentioned: true,
  }, { provider });
  assert.ok(receipt.reviewExecutions.some((x) => x.actorId === 'wti-clinical-evidence-reviewer'));
  assert.ok(receipt.reviewExecutions.some((x) => x.actorId === 'wti-price-availability-reviewer'));
});
