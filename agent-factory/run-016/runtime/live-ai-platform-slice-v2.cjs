'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { evaluateEvent } = require('./intelligence-gate.cjs');
const base = require('./live-ai-platform-slice.cjs');
const sliceConfig = require('../config/live-ai-platform-sources.json');

const BRIDGE_URL = process.env.RUN016_INFERENCE_BRIDGE_URL || 'https://datascout-live-sourcing-preview.vercel.app/api/run016-inference';
const SPECIALIST_MODEL = 'inclusionai/ling-3.0-flash-fin-free';
const REVIEWER_MODEL = 'inclusionai/ling-3.0-flash-sante-free';
const MAX_BRIDGE_ATTEMPTS = Number(process.env.RUN016_BRIDGE_ATTEMPTS || 6);

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function specialistSystem() {
  return [
    'You are WTI-A-016-GENERAL, the General Technology Systems Analyst for Run 016.',
    'Operate as a professional technology-intelligence analyst, not as a marketing summarizer.',
    'Analyze only the supplied first-party release evidence. Never invent product capabilities, availability, pricing, benchmark results, dates, adoption, or causal claims.',
    'A release in an official vendor SDK repository is primary evidence that the SDK/API surface changed as stated; it is not proof of wider adoption or real-world performance.',
    'Separate observation from inference. If the evidence is thin, lower confidence and consequence rather than filling gaps.',
    'Return strict JSON only. Keep the summary concise and decision-useful.',
    'Score novelty, consequence, confidence, immediacy, adoptionReadiness, and watchPriority from 0-100. Confidence reflects evidentiary support, not enthusiasm.',
  ].join(' ');
}

function reviewerSystem() {
  return [
    'You are the Independent Intelligence Quality Gate for Factory Run 016.',
    'You did not perform the specialist analysis and must not defer to it.',
    'Re-evaluate the supplied first-party evidence and specialist packet independently as a demanding technology-intelligence editor.',
    'Reject unsupported inference, exaggerated significance, stale claims, wrong actors or objects, and scores that materially overstate the evidence.',
    'PASS only if every factual statement is defensible from the supplied evidence and the output meets the standard of an excellent technology-intelligence practitioner.',
    'A technically true but vague, promotional, or decision-useless packet should receive a low practitionerQuality score.',
    'Return strict JSON only. Never authorize publication or notification.',
  ].join(' ');
}

function schemaFor(role) {
  if (role === 'specialist') {
    return {
      summary: '2-4 sentences, factual and decision-useful',
      action: 'short verb phrase describing what the actor did',
      object: 'specific released capability or SDK/API change',
      significance: 'why this may matter, explicitly bounded by evidence',
      signals: {
        novelty: '0-100 number', consequence: '0-100 number', confidence: '0-100 number',
        immediacy: '0-100 number', adoptionReadiness: '0-100 number', watchPriority: '0-100 number'
      },
      alertEligible: 'boolean; true only for unusually consequential fresh changes'
    };
  }
  return {
    verdict: 'PASS or FAIL',
    factuality: '0-100 number',
    evidenceSufficiency: '0-100 number',
    practitionerQuality: '0-100 number',
    reasons: ['short reasons'],
    unsupportedClaims: ['specific unsupported claims, empty if none'],
    sameExecutionAsSpecialist: false
  };
}

async function callBridge({ role, payload }) {
  const oidcToken = process.env.RUN016_BRIDGE_OIDC_TOKEN;
  if (!oidcToken) throw new Error('RUN016_BRIDGE_OIDC_TOKEN_REQUIRED');
  const system = role === 'specialist' ? specialistSystem() : reviewerSystem();
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_BRIDGE_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(BRIDGE_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${oidcToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ role, system, schemaInstruction: schemaFor(role), payload }),
      });
      const text = await response.text();
      if (!response.ok) {
        const retryable = [404, 408, 425, 429, 500, 502, 503, 504].includes(response.status);
        lastError = new Error(`INFERENCE_BRIDGE_FAILED:${role}:${response.status}:${text.slice(0, 900)}`);
        if (retryable && attempt < MAX_BRIDGE_ATTEMPTS) {
          await sleep(Math.min(15000, 2000 * attempt));
          continue;
        }
        throw lastError;
      }
      let data;
      try { data = JSON.parse(text); } catch (_) { throw new Error(`INFERENCE_BRIDGE_INVALID_JSON:${role}`); }
      if (!data.ok || typeof data.content !== 'string') throw new Error(`INFERENCE_BRIDGE_EMPTY:${role}`);
      if (Number(data.pricingReceipt?.inputPricePerToken) !== 0 || Number(data.pricingReceipt?.outputPricePerToken) !== 0 || data.pricingReceipt?.freeTag !== true) {
        throw new Error(`INFERENCE_BRIDGE_NONZERO_SPEND:${role}`);
      }
      const expectedModel = role === 'specialist' ? SPECIALIST_MODEL : REVIEWER_MODEL;
      if (data.requestedModel !== expectedModel) throw new Error(`INFERENCE_BRIDGE_MODEL_MISMATCH:${role}`);
      return {
        output: base.safeJsonParse(data.content),
        usage: data.usage || null,
        model: data.model || data.requestedModel,
        requestedModel: data.requestedModel,
        pricingReceipt: data.pricingReceipt,
        callerReceipt: data.callerReceipt || null,
        provider: 'vercel-ai-gateway-oidc',
      };
    } catch (error) {
      lastError = error;
      if (attempt < MAX_BRIDGE_ATTEMPTS && /fetch failed|ECONN|ENOTFOUND|ETIMEDOUT/i.test(error.message)) {
        await sleep(Math.min(15000, 2000 * attempt));
        continue;
      }
      throw error;
    }
  }
  throw lastError || new Error(`INFERENCE_BRIDGE_FAILED:${role}:unknown`);
}

async function run(options = {}) {
  const token = options.token || process.env.GITHUB_TOKEN;
  const now = options.now || new Date().toISOString();
  const runId = options.runId || `WTI-LIVE-AI-${process.env.GITHUB_RUN_ID || Date.now()}`;
  const startedAt = new Date().toISOString();
  const seenReleaseIds = new Set(options.seenReleaseIds || []);
  const { candidates, sourceReceipts } = await base.collectCandidates({
    token,
    now,
    sources: options.sources || base.DEFAULT_SOURCES,
    seenReleaseIds,
  });
  const accepted = [];
  const rejected = [];
  const inferenceReceipts = [];
  const processedReleaseIds = [];

  for (const candidate of candidates) {
    const sourceEvidence = {
      actor: candidate.source.actor,
      product: candidate.source.product,
      repository: candidate.source.repo,
      release: {
        id: candidate.release.id,
        name: candidate.release.name,
        tag: candidate.release.tag_name,
        publishedAt: candidate.release.published_at,
        url: candidate.release.html_url,
        body: String(candidate.release.body || '').slice(0, 6500),
      },
      observationBoundary: 'First-party GitHub release metadata only. Do not infer undocumented capabilities, adoption, pricing, benchmarks, or availability beyond the SDK/API change itself.',
    };

    try {
      const specialistCall = await callBridge({ role: 'specialist', payload: sourceEvidence });
      inferenceReceipts.push({
        role: 'specialist',
        eventSourceId: candidate.release.id,
        provider: specialistCall.provider,
        model: specialistCall.model,
        requestedModel: specialistCall.requestedModel,
        usage: specialistCall.usage,
        pricingReceipt: specialistCall.pricingReceipt,
        callerReceipt: specialistCall.callerReceipt,
      });
      const event = base.specialistToEvent({
        source: candidate.source,
        release: candidate.release,
        specialist: specialistCall.output,
        observedAt: now,
      });
      event.analysis.specialistModel = specialistCall.model;
      event.analysis.inferenceProvider = specialistCall.provider;
      const gate = evaluateEvent(event, { asOf: now });
      if (gate.decision === 'REJECT') {
        rejected.push({ stage: 'deterministic-gate', sourceEvidence, event, gate });
        processedReleaseIds.push(`${candidate.source.repo}:${candidate.release.id}`);
        continue;
      }

      const reviewPayload = {
        sourceEvidence,
        specialistPacket: specialistCall.output,
        normalizedEvent: event,
        deterministicGate: gate,
        reviewerIndependence: 'Separate model inference call, separate reviewer role, separate zero-spend model. Do not assume the specialist is correct.',
      };
      const reviewerCall = await callBridge({ role: 'reviewer', payload: reviewPayload });
      inferenceReceipts.push({
        role: 'reviewer',
        eventId: event.eventId,
        provider: reviewerCall.provider,
        model: reviewerCall.model,
        requestedModel: reviewerCall.requestedModel,
        usage: reviewerCall.usage,
        pricingReceipt: reviewerCall.pricingReceipt,
        callerReceipt: reviewerCall.callerReceipt,
      });
      const review = reviewerCall.output;
      if (!base.reviewerPass(review)) {
        rejected.push({ stage: 'independent-review', sourceEvidence, event, gate, review });
        processedReleaseIds.push(`${candidate.source.repo}:${candidate.release.id}`);
        continue;
      }
      accepted.push({ sourceEvidence, event, gate, review });
      processedReleaseIds.push(`${candidate.source.repo}:${candidate.release.id}`);
    } catch (error) {
      rejected.push({ stage: 'execution-error', sourceEvidence, error: error.message });
    }
  }

  const sourceFailures = sourceReceipts.filter((x) => x.status !== 'OK').length;
  const executionErrors = rejected.filter((x) => x.stage === 'execution-error').length;
  const brief = base.makeBrief(accepted);
  const terminalState = sourceFailures === sourceReceipts.length || (candidates.length > 0 && executionErrors === candidates.length) ? 'BLOCKED' : 'DELIVERED';
  const zeroSpendReceipts = inferenceReceipts.every((x) => Number(x.pricingReceipt?.inputPricePerToken) === 0 && Number(x.pricingReceipt?.outputPricePerToken) === 0);
  const qaStatus = terminalState === 'DELIVERED' && accepted.every((x) => base.reviewerPass(x.review)) && zeroSpendReceipts ? 'PASS' : 'FAIL';
  const packet = {
    schemaVersion: '1.1',
    runId,
    teamId: 'WORLD-TECHNOLOGY-INTELLIGENCE-016',
    sliceId: 'AI-DEVELOPER-PLATFORM-RELEASES-001',
    lifecycleStatus: 'Production-Slice',
    startedAt,
    completedAt: new Date().toISOString(),
    asOf: now,
    scope: {
      domain: 'ai-software',
      sources: sliceConfig.sources,
      freshnessHours: Number(sliceConfig.freshnessHours || 168),
      completenessClaimed: false,
      expansionAuthorized: false,
    },
    sourceReceipts,
    candidateCount: candidates.length,
    acceptedCount: accepted.length,
    rejectedCount: rejected.length,
    accepted,
    rejected,
    brief,
    coverage: {
      monitoredSourceCount: sourceReceipts.length,
      healthySourceCount: sourceReceipts.length - sourceFailures,
      failedSourceCount: sourceFailures,
      blindSpots: ['This proof monitors only three official JavaScript/TypeScript SDK release feeds; it does not claim full AI/software coverage.'],
    },
    execution: {
      specialistAgentId: 'WTI-A-016-GENERAL',
      specialistModel: SPECIALIST_MODEL,
      reviewerRole: 'Independent Intelligence Quality Gate',
      reviewerModel: REVIEWER_MODEL,
      provider: 'vercel-ai-gateway-oidc',
      separateInferenceCalls: true,
      separateModels: SPECIALIST_MODEL !== REVIEWER_MODEL,
      inferenceReceipts,
      externalActionsPerformed: 0,
      spendAuthorized: false,
      zeroSpendModelGate: zeroSpendReceipts,
      spendCentsClaimed: zeroSpendReceipts ? 0 : null,
      notificationAuthorized: false,
      publicationAuthorized: false,
    },
    qa: {
      status: qaStatus,
      independentReviewRequired: true,
      acceptedItemsWithoutIndependentPass: accepted.filter((x) => !base.reviewerPass(x.review)).length,
      zeroSpendReceiptsVerified: zeroSpendReceipts,
      unsupportedSuccessClaims: 0,
    },
    terminalState,
    stateUpdate: {
      processedReleaseIds,
      seenReleaseIds: Array.from(new Set([...seenReleaseIds, ...processedReleaseIds])).slice(-200),
    },
  };
  packet.packetSha256 = sha256(JSON.stringify(packet));
  return packet;
}

async function main() {
  const outputArg = process.argv.find((arg) => arg.startsWith('--output='));
  const stateArg = process.argv.find((arg) => arg.startsWith('--state='));
  const stateOutputArg = process.argv.find((arg) => arg.startsWith('--state-output='));
  const outputPath = outputArg ? outputArg.slice('--output='.length) : path.resolve(process.cwd(), 'run016-live-ai-platform.json');
  const statePath = stateArg ? stateArg.slice('--state='.length) : null;
  const stateOutputPath = stateOutputArg ? stateOutputArg.slice('--state-output='.length) : null;
  let priorState = { seenReleaseIds: [] };
  if (statePath && fs.existsSync(statePath)) {
    try { priorState = JSON.parse(fs.readFileSync(statePath, 'utf8')); }
    catch (error) { throw new Error(`INVALID_STATE_FILE:${statePath}:${error.message}`); }
  }
  const packet = await run({ seenReleaseIds: Array.isArray(priorState.seenReleaseIds) ? priorState.seenReleaseIds : [] });
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(packet, null, 2)}\n`);
  if (stateOutputPath) {
    fs.mkdirSync(path.dirname(stateOutputPath), { recursive: true });
    fs.writeFileSync(stateOutputPath, `${JSON.stringify({ schemaVersion: '1.0', updatedAt: packet.completedAt, seenReleaseIds: packet.stateUpdate.seenReleaseIds }, null, 2)}\n`);
  }
  console.log(JSON.stringify({
    runId: packet.runId,
    terminalState: packet.terminalState,
    qa: packet.qa.status,
    candidates: packet.candidateCount,
    accepted: packet.acceptedCount,
    rejected: packet.rejectedCount,
    urgent: packet.brief.urgentAlerts.length,
    daily: packet.brief.dailyBrief.length,
    watchlist: packet.brief.watchlist.length,
    zeroSpendModelGate: packet.execution.zeroSpendModelGate,
    outputPath,
    packetSha256: packet.packetSha256,
  }, null, 2));
  if (packet.terminalState !== 'DELIVERED' || packet.qa.status !== 'PASS') process.exitCode = 1;
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.stack || error.message || String(error));
    process.exitCode = 1;
  });
}

module.exports = { callBridge, run, specialistSystem, reviewerSystem, schemaFor };
