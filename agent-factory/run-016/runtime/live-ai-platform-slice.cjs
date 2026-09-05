'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { evaluateEvent } = require('./intelligence-gate.cjs');
const sliceConfig = require('../config/live-ai-platform-sources.json');

const DEFAULT_SOURCES = sliceConfig.sources;
const DAILY_FRESHNESS_HOURS = Number(sliceConfig.freshnessHours || 168);
const MODEL_ENDPOINT = 'https://models.github.ai/inference/chat/completions';
const SPECIALIST_MODEL = process.env.RUN016_SPECIALIST_MODEL || 'openai/gpt-4.1';
const REVIEWER_MODEL = process.env.RUN016_REVIEWER_MODEL || 'openai/gpt-4.1';
const MAX_RELEASES_PER_SOURCE = Number(process.env.RUN016_MAX_RELEASES_PER_SOURCE || 2);
const MAX_TOTAL_CANDIDATES = Number(process.env.RUN016_MAX_TOTAL_CANDIDATES || 6);

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function hoursOld(timestamp, now) {
  const t = new Date(timestamp).getTime();
  const n = new Date(now).getTime();
  if (!Number.isFinite(t) || !Number.isFinite(n)) return Infinity;
  return (n - t) / 3600000;
}

function clip(text, max = 7000) {
  const value = String(text || '');
  return value.length > max ? `${value.slice(0, max)}\n[truncated]` : value;
}

function safeJsonParse(text) {
  const value = String(text || '').trim();
  try { return JSON.parse(value); } catch (_) {}
  const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) return JSON.parse(fenced[1]);
  const start = value.indexOf('{');
  const end = value.lastIndexOf('}');
  if (start !== -1 && end > start) return JSON.parse(value.slice(start, end + 1));
  throw new Error('MODEL_RETURNED_INVALID_JSON');
}

async function fetchJson(url, token) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'aberdeen-run016-live-slice',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`SOURCE_FETCH_FAILED:${response.status}:${url}:${clip(body, 500)}`);
  }
  return response.json();
}

async function callModel({ token, model, role, payload }) {
  if (!token) throw new Error('GITHUB_TOKEN_REQUIRED_FOR_MODEL_INFERENCE');
  const system = role === 'specialist'
    ? [
        'You are WTI-A-016-GENERAL, the General Technology Systems Analyst for Run 016.',
        'Analyze only the supplied first-party release evidence. Never invent product capabilities, availability, pricing, benchmark results, dates, or causal claims.',
        'A release in an official vendor SDK repository is primary evidence that the SDK/API surface changed as stated; it is not proof of wider adoption or real-world performance.',
        'Return strict JSON only. Keep the summary concise and useful to a technology executive.',
        'Score novelty, consequence, confidence, immediacy, adoptionReadiness, and watchPriority from 0-100. Confidence should reflect evidence support, not enthusiasm.',
      ].join(' ')
    : [
        'You are the Independent Intelligence Quality Gate for Factory Run 016.',
        'You did not perform the specialist analysis. Re-evaluate the supplied first-party evidence and specialist packet independently.',
        'Reject unsupported inference, exaggerated significance, stale claims, wrong actors/objects, or scores that materially overstate the evidence.',
        'PASS only if an excellent technology-intelligence practitioner could defend every factual statement from the supplied evidence and the item is useful enough for the claimed gate decision.',
        'Return strict JSON only. Do not rewrite policy or authorize external notification.',
      ].join(' ');

  const schemaInstruction = role === 'specialist'
    ? {
        summary: '2-4 sentences, factual and decision-useful',
        action: 'short verb phrase describing what the actor did',
        object: 'specific released capability or SDK/API change',
        significance: 'why this may matter, explicitly bounded by evidence',
        signals: {
          novelty: '0-100 number', consequence: '0-100 number', confidence: '0-100 number',
          immediacy: '0-100 number', adoptionReadiness: '0-100 number', watchPriority: '0-100 number'
        },
        alertEligible: 'boolean; true only for unusually consequential fresh changes'
      }
    : {
        verdict: 'PASS or FAIL',
        factuality: '0-100 number',
        evidenceSufficiency: '0-100 number',
        practitionerQuality: '0-100 number',
        reasons: ['short reasons'],
        unsupportedClaims: ['specific unsupported claims, empty if none'],
        sameExecutionAsSpecialist: false
      };

  const response = await fetch(MODEL_ENDPOINT, {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2026-03-10',
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      max_tokens: role === 'specialist' ? 1200 : 900,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: JSON.stringify({ expectedSchema: schemaInstruction, payload }) },
      ],
    }),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`MODEL_INFERENCE_FAILED:${role}:${model}:${response.status}:${clip(body, 700)}`);
  }
  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error(`MODEL_EMPTY_RESPONSE:${role}:${model}`);
  return { output: safeJsonParse(content), usage: data.usage || null, model };
}

function validateSignals(signals) {
  const fields = ['novelty', 'consequence', 'confidence', 'immediacy', 'adoptionReadiness', 'watchPriority'];
  if (!signals || typeof signals !== 'object') return false;
  return fields.every((field) => Number.isFinite(Number(signals[field])) && Number(signals[field]) >= 0 && Number(signals[field]) <= 100);
}

function specialistToEvent({ source, release, specialist, observedAt }) {
  if (!specialist || typeof specialist !== 'object') throw new Error('SPECIALIST_PACKET_REQUIRED');
  if (!validateSignals(specialist.signals)) throw new Error('SPECIALIST_INVALID_SIGNALS');
  const releaseUrl = release.html_url;
  const eventId = `run016:${source.repo}:release:${release.id}`;
  return {
    eventId,
    title: `${source.actor}: ${release.name || release.tag_name}`,
    actor: source.actor,
    action: String(specialist.action || 'released an AI developer-platform update'),
    object: String(specialist.object || `${source.product} ${release.tag_name}`),
    location: 'Global / online',
    publishedAt: release.published_at,
    observedAt,
    summary: String(specialist.summary || ''),
    domain: 'ai-software',
    claimMode: 'VERIFIED_FACT',
    sources: [{
      url: releaseUrl,
      publisher: source.actor,
      tier: 'primary',
      independentKey: `${source.actor}:${source.repo}`,
      directStatement: false,
      publishedAt: release.published_at,
    }],
    signals: Object.fromEntries(Object.entries(specialist.signals).map(([k, v]) => [k, Number(v)])),
    alertEligible: specialist.alertEligible === true,
    promotionalOnly: false,
    priceMentioned: false,
    untrustedDirectiveDetected: false,
    materialDelta: true,
    sourceFetchStatus: 'AVAILABLE',
    analysis: {
      specialistAgentId: 'WTI-A-016-GENERAL',
      specialistModel: SPECIALIST_MODEL,
      significance: String(specialist.significance || ''),
    },
  };
}

function reviewerPass(review) {
  if (!review || review.verdict !== 'PASS') return false;
  const factuality = Number(review.factuality);
  const evidence = Number(review.evidenceSufficiency);
  const quality = Number(review.practitionerQuality);
  return factuality >= 90 && evidence >= 90 && quality >= 82 && Array.isArray(review.unsupportedClaims) && review.unsupportedClaims.length === 0;
}

function makeBrief(accepted) {
  const urgent = accepted.filter((x) => x.gate.decision === 'URGENT_ALERT');
  const daily = accepted.filter((x) => x.gate.decision === 'DAILY_BRIEF');
  const watch = accepted.filter((x) => x.gate.decision === 'WATCHLIST');
  return {
    schemaVersion: '1.0',
    urgentAlerts: urgent.map((x) => ({ eventId: x.event.eventId, title: x.event.title, summary: x.event.summary, score: x.gate.score, sourceUrl: x.event.sources[0].url })),
    dailyBrief: daily.map((x) => ({ eventId: x.event.eventId, title: x.event.title, summary: x.event.summary, score: x.gate.score, significance: x.event.analysis.significance, sourceUrl: x.event.sources[0].url })),
    watchlist: watch.map((x) => ({ eventId: x.event.eventId, title: x.event.title, summary: x.event.summary, score: x.gate.score, sourceUrl: x.event.sources[0].url })),
    notificationAuthorized: false,
    publicationAuthorized: false,
  };
}

async function collectCandidates({ token, now, sources = DEFAULT_SOURCES, seenReleaseIds = new Set() }) {
  const candidates = [];
  const sourceReceipts = [];
  for (const source of sources) {
    try {
      const releases = await fetchJson(`https://api.github.com/repos/${source.repo}/releases?per_page=5`, token);
      const fresh = (Array.isArray(releases) ? releases : [])
        .filter((release) => !release.draft && release.published_at && hoursOld(release.published_at, now) >= -1 && hoursOld(release.published_at, now) <= DAILY_FRESHNESS_HOURS)
        .slice(0, MAX_RELEASES_PER_SOURCE);
      const unseen = fresh.filter((release) => !seenReleaseIds.has(`${source.repo}:${release.id}`));
      sourceReceipts.push({ source: source.repo, status: 'OK', fetched: Array.isArray(releases) ? releases.length : 0, fresh: fresh.length, unseen: unseen.length });
      for (const release of unseen) {
        candidates.push({ source, release });
        if (candidates.length >= MAX_TOTAL_CANDIDATES) break;
      }
    } catch (error) {
      sourceReceipts.push({ source: source.repo, status: 'ERROR', error: error.message });
    }
    if (candidates.length >= MAX_TOTAL_CANDIDATES) break;
  }
  return { candidates, sourceReceipts };
}

async function run(options = {}) {
  const token = options.token || process.env.GITHUB_TOKEN;
  const now = options.now || new Date().toISOString();
  const runId = options.runId || `WTI-LIVE-AI-${process.env.GITHUB_RUN_ID || Date.now()}`;
  const startedAt = new Date().toISOString();
  const seenReleaseIds = new Set(options.seenReleaseIds || []);
  const { candidates, sourceReceipts } = await collectCandidates({ token, now, sources: options.sources || DEFAULT_SOURCES, seenReleaseIds });
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
        body: clip(candidate.release.body || '', 6500),
      },
      observationBoundary: 'First-party GitHub release metadata only. Do not infer undocumented capabilities, adoption, pricing, benchmarks, or availability beyond the SDK/API change itself.',
    };

    try {
      const specialistCall = await callModel({ token, model: SPECIALIST_MODEL, role: 'specialist', payload: sourceEvidence });
      inferenceReceipts.push({ role: 'specialist', eventSourceId: candidate.release.id, model: specialistCall.model, usage: specialistCall.usage });
      const event = specialistToEvent({ source: candidate.source, release: candidate.release, specialist: specialistCall.output, observedAt: now });
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
        reviewerIndependence: 'This is a separate model inference call with a separate reviewer system role. It must not assume the specialist is correct.',
      };
      const reviewerCall = await callModel({ token, model: REVIEWER_MODEL, role: 'reviewer', payload: reviewPayload });
      inferenceReceipts.push({ role: 'reviewer', eventId: event.eventId, model: reviewerCall.model, usage: reviewerCall.usage });
      const review = reviewerCall.output;
      if (!reviewerPass(review)) {
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
  const brief = makeBrief(accepted);
  const terminalState = sourceFailures === sourceReceipts.length || (candidates.length > 0 && executionErrors === candidates.length) ? 'BLOCKED' : 'DELIVERED';
  const qaStatus = terminalState === 'DELIVERED' && accepted.every((x) => reviewerPass(x.review)) ? 'PASS' : 'FAIL';
  const packet = {
    schemaVersion: '1.0',
    runId,
    teamId: 'WORLD-TECHNOLOGY-INTELLIGENCE-016',
    sliceId: 'AI-DEVELOPER-PLATFORM-RELEASES-001',
    lifecycleStatus: 'Production-Slice',
    startedAt,
    completedAt: new Date().toISOString(),
    asOf: now,
    scope: {
      domain: 'ai-software',
      sources: DEFAULT_SOURCES,
      freshnessHours: DAILY_FRESHNESS_HOURS,
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
      separateInferenceCalls: true,
      inferenceReceipts,
      externalActionsPerformed: 0,
      spendCentsClaimed: null,
      notificationAuthorized: false,
      publicationAuthorized: false,
    },
    qa: {
      status: qaStatus,
      independentReviewRequired: true,
      acceptedItemsWithoutIndependentPass: accepted.filter((x) => !reviewerPass(x.review)).length,
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

module.exports = {
  DEFAULT_SOURCES,
  hoursOld,
  safeJsonParse,
  validateSignals,
  specialistToEvent,
  reviewerPass,
  makeBrief,
  collectCandidates,
  run,
};
