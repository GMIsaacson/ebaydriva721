const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { DEFAULT_CONFIG } = require('../runtime/config.cjs');
const { ControlledRuntime } = require('../runtime/runtime.cjs');
const { InMemoryRunStore } = require('../runtime/store.cjs');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_FIXTURE = path.join(ROOT, 'fixtures/g5-shadow-two-sku.json');
const REQUIRED_ECONOMICS = [
  'collectedRevenueCents',
  'sourceCostCents',
  'inboundFreightCents',
  'marketplaceFeesCents',
  'outboundShippingCents',
  'packagingCents',
  'riskReserveCents',
];

function stableHash(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function buildShadowConfig(fixture) {
  if (fixture.authority.externalActionsEnabled !== false) {
    throw new Error('fixture attempted to enable external actions');
  }
  if (fixture.authority.spendingAuthorityCents !== 0) {
    throw new Error('fixture attempted to add spending authority');
  }
  if (fixture.authority.maxAiCalls !== 0 || fixture.authority.credentialMode !== 'none') {
    throw new Error('fixture attempted to add AI calls or credentials');
  }
  const config = {
    ...DEFAULT_CONFIG,
    contractVersion: 'datascout-run-004-g5/1.0.0',
    mode: 'shadow',
    maxCandidates: fixture.authority.candidateLimit,
    maxSourceRequests: fixture.authority.sourceRequestLimit,
  };
  if (config.externalActionsEnabled !== false) throw new Error('shadow external actions must remain disabled');
  if (config.spendingAuthorityCents !== 0) throw new Error('shadow spending authority must remain $0');
  if (config.maxCandidates !== 2) throw new Error('G5 shadow is limited to two candidates');
  if (config.maxSourceRequests > 7) throw new Error('G5 shadow source-request cap exceeded');
  if (config.maxAiCalls !== 0 || config.credentialMode !== 'none') {
    throw new Error('G5 shadow must remain credential-free with zero AI calls');
  }
  return Object.freeze(config);
}

function evidenceRefs(candidate, fixture) {
  const records = [candidate.source, ...candidate.marketplaceComparables, ...fixture.sharedEvidence];
  return records.map((record) => ({
    source_url: record.sourceUrl,
    captured_at: record.capturedAt,
    evidence_type: record.evidenceType,
    confidence: record.confidence,
  }));
}

function buildEnvelope(candidate, fixture, now) {
  const refs = evidenceRefs(candidate, fixture);
  const keyHash = stableHash({ candidateId: candidate.candidateId, refs }).slice(0, 32);
  const capturedAt = Date.parse(fixture.capturedAt);
  const evidenceAgeDays = Math.max(0, (now.getTime() - capturedAt) / 86_400_000);
  return {
    handoff: {
      schema_version: '1.0',
      run_id: fixture.runId,
      handoff_id: `H2-G5-${candidate.candidateId}`,
      idempotency_key: `${fixture.runId}:H2:${keyHash}`,
      producer_agent_id: 'AGT-RESEARCH-VALIDATION-001',
      consumer_agent_id: 'OWNER-ABERDEEN',
      opportunity_url: 'https://app.notion.com/p/3bbe161eac8a81468d30d80f2bdfcf09',
      candidate_ids: [candidate.candidateId],
      evidence_refs: refs,
      decision_requested: 'Assess purchase readiness from fresh public evidence; owner retains all action authority.',
      approval_ref: null,
      expires_at: fixture.expiresAt,
      status: 'Accepted',
    },
    request: {
      requestedAction: 'recommend',
      candidateCount: 1,
      sourceRequestCount: refs.length,
      spendingRequestedCents: 0,
      exactIdentity: candidate.exactIdentity,
      hasSoldEvidence: candidate.marketplaceComparables.some((item) => item.soldCount > 0),
      evidenceAgeDays,
      conflictingEvidence: false,
      promptInjection: false,
      partialFailure: false,
      approvalRef: null,
      economics: Object.fromEntries(REQUIRED_ECONOMICS.map((field) => [field, candidate.economics[field]])),
    },
  };
}

async function executeShadow(fixture, clock = () => new Date(fixture.shadowExecutedAt)) {
  if (fixture.runId !== 'DS-S2M-004' || fixture.gate !== 'G5') throw new Error('wrong G5 fixture identity');
  if (fixture.candidates.length !== 2) throw new Error('G5 shadow requires exactly two candidates');
  const totalSources = new Set([
    ...fixture.sharedEvidence.map((item) => item.sourceUrl),
    ...fixture.candidates.flatMap((candidate) => [
      candidate.source.sourceUrl,
      ...candidate.marketplaceComparables.map((item) => item.sourceUrl),
    ]),
  ]).size;
  if (totalSources > fixture.authority.sourceRequestLimit) throw new Error('fixture exceeds source-request limit');

  const config = buildShadowConfig(fixture);
  const store = new InMemoryRunStore(clock);
  const runtime = new ControlledRuntime({ config, store, clock });
  runtime.start();

  const results = [];
  for (const candidate of fixture.candidates) {
    const result = await runtime.execute(buildEnvelope(candidate, fixture, clock()));
    results.push({
      candidateId: candidate.candidateId,
      expectedStatus: candidate.expectedStatus,
      actualStatus: result.status,
      match: result.status === candidate.expectedStatus,
      reason: result.reason,
      missingEconomics: result.economics?.missing || [],
      soldEvidenceCount: candidate.marketplaceComparables.reduce((sum, item) => sum + item.soldCount, 0),
      externalActions: result.externalActions,
      spendingCents: result.spendingCents,
      humanReviewRequired: result.humanReviewRequired,
      idempotencyKey: result.idempotencyKey,
    });
  }

  const allMatched = results.every((result) => result.match);
  const authorityPreserved = results.every(
    (result) => result.externalActions === 0 && result.spendingCents === 0,
  );
  const output = {
    runId: fixture.runId,
    gate: fixture.gate,
    workflowId: fixture.workflowId,
    contractVersion: config.contractVersion,
    mode: config.mode,
    capturedAt: fixture.capturedAt,
    executedAt: clock().toISOString(),
    candidateCount: fixture.candidates.length,
    sourceRequestCount: totalSources,
    gateResult: allMatched && authorityPreserved ? 'Pass' : 'Fail',
    businessDecision: 'Incomplete',
    recommendation: 'Do not purchase. Obtain a verified Uline freight quote and actual seller postage, packaging, fee, and risk inputs, then rerun the deterministic economics.',
    authority: {
      externalActions: 0,
      spendingCents: 0,
      credentials: 0,
      aiCalls: 0,
    },
    results,
    telemetry: {
      attempts: store.attempts.length,
      humanReviews: store.reviews.length,
      deadLetters: store.deadLetters.length,
      checkpoint: store.getControl(config.runId).checkpoint,
    },
  };
  if (output.gateResult !== 'Pass') throw new Error(`G5 shadow failed: ${JSON.stringify(output)}`);
  return output;
}

function loadFixture(file = DEFAULT_FIXTURE) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

if (require.main === module) {
  const fixture = loadFixture(process.argv[2]);
  executeShadow(fixture).then((output) => process.stdout.write(`${JSON.stringify(output, null, 2)}\n`));
}

module.exports = { buildEnvelope, buildShadowConfig, executeShadow, loadFixture, stableHash };
