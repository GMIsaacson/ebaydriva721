'use strict';

const fs = require('fs');
const crypto = require('crypto');
const territoryConfig = require('../config/opportunity-territories.json');

const REPOSITORY = 'GMIsaacson/ebaydriva721';
const WORK_ORDER_ISSUE = 110;
const BRIDGE_URL = process.env.RUN011_INFERENCE_BRIDGE_URL || 'https://datascout-live-sourcing-preview.vercel.app/api/run011-inference';
const ANALYST_MODEL = 'inclusionai/ling-3.0-flash-fin-free';
const REVIEWER_MODEL = 'inclusionai/ling-3.0-flash-sante-free';
const MAX_BRIDGE_ATTEMPTS = Number(process.env.RUN011_BRIDGE_ATTEMPTS || 8);
const TERRITORIES_PER_RUN = Math.max(1, Math.min(10, Number(process.env.RUN011_TERRITORIES_PER_RUN || 4)));
const MAX_EVIDENCE_ITEMS = 18;
const ALLOWED_DECISIONS = new Set(['ADVANCE','WATCH','DEFER','KILL','BLOCKED_EVIDENCE']);

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function safeJsonParse(text) {
  const raw = String(text || '').trim();
  const fenced = raw.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const candidate = fenced ? fenced[1] : raw;
  try { return JSON.parse(candidate); } catch (_) {}
  const firstObject = candidate.indexOf('{');
  const lastObject = candidate.lastIndexOf('}');
  if (firstObject >= 0 && lastObject > firstObject) {
    return JSON.parse(candidate.slice(firstObject, lastObject + 1));
  }
  throw new Error('INFERENCE_INVALID_JSON');
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 16000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function cleanText(value, max = 1400) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/<[^>]*>/g, ' ')
    .trim()
    .slice(0, max);
}

function uniqueByUrl(items) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    if (!item || !item.url || seen.has(item.url)) continue;
    seen.add(item.url);
    out.push(item);
  }
  return out;
}

async function collectReddit(territory) {
  const receipts = [];
  const items = [];
  const subreddits = Array.isArray(territory.subreddits) ? territory.subreddits.slice(0, 3) : [];
  const query = territory.queries?.[0] || territory.label;
  for (const subreddit of subreddits) {
    const url = `https://www.reddit.com/r/${encodeURIComponent(subreddit)}/search.json?q=${encodeURIComponent(query)}&restrict_sr=1&sort=relevance&t=year&limit=6&raw_json=1`;
    try {
      const response = await fetchWithTimeout(url, {
        headers: {
          'User-Agent': 'Aberdeen-Opportunity-Census/1.0 (+https://github.com/GMIsaacson/ebaydriva721)',
          Accept: 'application/json',
        },
      });
      if (!response.ok) {
        receipts.push({ source: 'reddit', subreddit, status: 'ERROR', httpStatus: response.status, url });
        continue;
      }
      const json = await response.json();
      const children = json?.data?.children || [];
      for (const child of children) {
        const post = child?.data || {};
        if (!post.permalink) continue;
        items.push({
          sourceClass: 'community-discussion',
          source: 'reddit',
          title: cleanText(post.title, 350),
          text: cleanText(post.selftext, 1800),
          score: Number(post.score || 0),
          comments: Number(post.num_comments || 0),
          createdUtc: Number(post.created_utc || 0),
          url: `https://www.reddit.com${post.permalink}`,
          subreddit,
        });
      }
      receipts.push({ source: 'reddit', subreddit, status: 'OK', itemCount: children.length, url });
    } catch (error) {
      receipts.push({ source: 'reddit', subreddit, status: 'ERROR', error: error.message, url });
    }
  }
  return { items, receipts };
}

async function collectHackerNews(territory) {
  const query = territory.queries?.[1] || territory.queries?.[0] || territory.label;
  const url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&tags=story&hitsPerPage=8`;
  try {
    const response = await fetchWithTimeout(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) return { items: [], receipts: [{ source: 'hacker-news', status: 'ERROR', httpStatus: response.status, url }] };
    const json = await response.json();
    const hits = json?.hits || [];
    const items = hits.map((hit) => ({
      sourceClass: 'public-discussion',
      source: 'hacker-news',
      title: cleanText(hit.title, 350),
      text: cleanText(hit.story_text, 1500),
      score: Number(hit.points || 0),
      comments: Number(hit.num_comments || 0),
      createdAt: hit.created_at || null,
      url: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
    })).filter((item) => item.url);
    return { items, receipts: [{ source: 'hacker-news', status: 'OK', itemCount: items.length, url }] };
  } catch (error) {
    return { items: [], receipts: [{ source: 'hacker-news', status: 'ERROR', error: error.message, url }] };
  }
}

function decodeXml(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');
}

async function collectGoogleNews(territory) {
  const query = territory.queries?.[0] || territory.label;
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
  try {
    const response = await fetchWithTimeout(url, {
      headers: { 'User-Agent': 'Aberdeen-Opportunity-Census/1.0', Accept: 'application/rss+xml, application/xml, text/xml' },
    });
    if (!response.ok) return { items: [], receipts: [{ source: 'google-news-rss', status: 'ERROR', httpStatus: response.status, url }] };
    const xml = await response.text();
    const blocks = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 8).map((m) => m[1]);
    const items = blocks.map((block) => {
      const pick = (tag) => {
        const m = block.match(new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, 'i'));
        return m ? decodeXml(m[1]).trim() : '';
      };
      return {
        sourceClass: 'news',
        source: 'google-news-rss',
        title: cleanText(pick('title'), 350),
        text: cleanText(pick('description'), 1200),
        publishedAt: cleanText(pick('pubDate'), 120),
        url: cleanText(pick('link'), 1200),
      };
    }).filter((item) => /^https:\/\//.test(item.url));
    return { items, receipts: [{ source: 'google-news-rss', status: 'OK', itemCount: items.length, url }] };
  } catch (error) {
    return { items: [], receipts: [{ source: 'google-news-rss', status: 'ERROR', error: error.message, url }] };
  }
}

async function collectEvidence(territory) {
  const [reddit, hn, news] = await Promise.all([
    collectReddit(territory),
    collectHackerNews(territory),
    collectGoogleNews(territory),
  ]);
  const combined = uniqueByUrl([...reddit.items, ...hn.items, ...news.items])
    .sort((a, b) => (Number(b.score || 0) + Number(b.comments || 0)) - (Number(a.score || 0) + Number(a.comments || 0)))
    .slice(0, MAX_EVIDENCE_ITEMS);
  return {
    items: combined,
    receipts: [...reddit.receipts, ...hn.receipts, ...news.receipts],
  };
}

async function fetchWorkOrder(token) {
  const url = `https://api.github.com/repos/${REPOSITORY}/issues/${WORK_ORDER_ISSUE}`;
  const response = await fetchWithTimeout(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'Aberdeen-Opportunity-Census/1.0',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!response.ok) throw new Error(`WORK_ORDER_FETCH_FAILED:${response.status}`);
  const issue = await response.json();
  return {
    number: issue.number,
    title: issue.title,
    body: cleanText(issue.body, 10000),
    htmlUrl: issue.html_url,
    state: issue.state,
  };
}

function analystSystem() {
  return [
    'You are the Opportunity Research Analyst for Factory Run 011 / OUCS.',
    'Your job is to extract website or web-app business opportunity clusters from supplied public evidence, not to brainstorm unsupported startup ideas.',
    'Every material claim must be grounded in one or more supplied evidence URLs.',
    'Do not fabricate TAM, search volume, willingness-to-pay, revenue, customer counts, competitor pricing, laws, or market size.',
    'Unknown stays unknown. A complaint alone is not proof of a business.',
    'Use the terminal decisions ADVANCE, WATCH, DEFER, KILL, or BLOCKED_EVIDENCE.',
    'Prefer narrow customers and concrete workflows. Kill cosmetic or generic ideas.',
    'Return strict JSON only and at most five clusters.',
  ].join(' ');
}

function reviewerSystem() {
  return [
    'You are the Independent Opportunity Evidence Reviewer for Factory Run 011.',
    'You did not perform the analyst work and must independently check it against the supplied evidence.',
    'Reject unsupported pain, spend, recurrence, customer-universe, regulatory, competitor, or willingness-to-pay claims.',
    'A candidate may remain WATCH, DEFER, KILL, or BLOCKED_EVIDENCE without being a failure.',
    'ADVANCE requires specific evidence, a clear buyer, a plausible web-solvable workflow, and a plausible distribution path.',
    'Never upgrade weak evidence just to produce winners.',
    'Return strict JSON only.',
  ].join(' ');
}

function schemaFor(role) {
  if (role === 'analyst') {
    return {
      clusters: [{
        niche: 'specific niche',
        customer: 'specific buyer/operator',
        geography: 'US or narrower if evidence requires',
        problem: 'specific recurring workflow/pain',
        painEvidence: ['short source-grounded observations'],
        frequency: 'observed signal or unknown',
        currentWorkaround: 'observed workaround or unknown',
        incumbentSolutions: 'observed incumbents or unknown',
        spendOrLossEvidence: 'observed evidence or unknown',
        proposedWebSolution: 'smallest plausible website/web-app solution',
        businessModel: 'plausible model or unknown',
        reachability: 'plausible reachable channel based on evidence, or unknown',
        distributionPath: 'how the buyer could plausibly be reached',
        estimatedCustomerUniverse: 'unknown unless directly evidenced',
        competitiveDifficulty: 'LOW/MEDIUM/HIGH/UNKNOWN',
        buildComplexity: 'LOW/MEDIUM/HIGH',
        regulatoryRisk: 'LOW/MEDIUM/HIGH/UNKNOWN',
        evidenceRefs: ['only URLs from supplied evidence'],
        confidence: '0-100 number',
        decision: 'ADVANCE/WATCH/DEFER/KILL/BLOCKED_EVIDENCE',
        killReason: 'required when KILL, otherwise null',
        nextAction: 'specific next research action'
      }]
    };
  }
  return {
    verdict: 'PASS or FAIL',
    practitionerQuality: '0-100 number',
    acceptedCandidateIds: ['candidate ids whose claims are supportable'],
    rejectedCandidateIds: ['candidate ids that overclaim or lack evidence'],
    overrides: [{ candidateId: 'id', decision: 'ADVANCE/WATCH/DEFER/KILL/BLOCKED_EVIDENCE', reason: 'why' }],
    unsupportedClaims: ['specific unsupported claims'],
    reasons: ['short review reasons']
  };
}

async function callBridge({ role, payload }) {
  const oidcToken = process.env.RUN011_BRIDGE_OIDC_TOKEN;
  if (!oidcToken) throw new Error('RUN011_BRIDGE_OIDC_TOKEN_REQUIRED');
  let lastError = null;
  for (let attempt = 1; attempt <= MAX_BRIDGE_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetchWithTimeout(BRIDGE_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${oidcToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          role,
          system: role === 'analyst' ? analystSystem() : reviewerSystem(),
          schemaInstruction: schemaFor(role),
          payload,
        }),
      }, 60000);
      const text = await response.text();
      if (!response.ok) {
        lastError = new Error(`INFERENCE_BRIDGE_FAILED:${role}:${response.status}:${text.slice(0, 700)}`);
        if ([404,408,425,429,500,502,503,504].includes(response.status) && attempt < MAX_BRIDGE_ATTEMPTS) {
          await sleep(Math.min(15000, 2500 * attempt));
          continue;
        }
        throw lastError;
      }
      const data = JSON.parse(text);
      if (!data.ok || typeof data.content !== 'string') throw new Error(`INFERENCE_BRIDGE_EMPTY:${role}`);
      if (Number(data.pricingReceipt?.inputPricePerToken) !== 0 || Number(data.pricingReceipt?.outputPricePerToken) !== 0 || data.pricingReceipt?.freeTag !== true) {
        throw new Error(`INFERENCE_BRIDGE_NONZERO_SPEND:${role}`);
      }
      const expectedModel = role === 'analyst' ? ANALYST_MODEL : REVIEWER_MODEL;
      if (data.requestedModel !== expectedModel) throw new Error(`INFERENCE_BRIDGE_MODEL_MISMATCH:${role}`);
      return {
        output: safeJsonParse(data.content),
        receipt: {
          role,
          provider: 'vercel-ai-gateway-oidc',
          model: data.model || data.requestedModel,
          requestedModel: data.requestedModel,
          usage: data.usage || null,
          pricingReceipt: data.pricingReceipt,
          callerReceipt: data.callerReceipt || null,
        },
      };
    } catch (error) {
      lastError = error;
      if (attempt < MAX_BRIDGE_ATTEMPTS && /fetch failed|ECONN|ENOTFOUND|ETIMEDOUT|AbortError/i.test(error.message)) {
        await sleep(Math.min(15000, 2500 * attempt));
        continue;
      }
      throw error;
    }
  }
  throw lastError || new Error(`INFERENCE_BRIDGE_FAILED:${role}:unknown`);
}

function candidateIdFor(candidate) {
  const key = [candidate.niche, candidate.customer, candidate.problem].map((x) => cleanText(x, 800).toLowerCase()).join('|');
  return `OPP-${sha256(key).slice(0, 12).toUpperCase()}`;
}

function normalizeCandidate(raw, territory, allowedEvidenceUrls, now) {
  const decision = ALLOWED_DECISIONS.has(raw?.decision) ? raw.decision : 'BLOCKED_EVIDENCE';
  const refs = Array.isArray(raw?.evidenceRefs)
    ? [...new Set(raw.evidenceRefs.filter((url) => allowedEvidenceUrls.has(url)))]
    : [];
  const base = {
    candidateId: null,
    territoryId: territory.id,
    territoryLabel: territory.label,
    niche: cleanText(raw?.niche, 300) || territory.label,
    customer: cleanText(raw?.customer, 400) || 'unknown',
    geography: cleanText(raw?.geography, 200) || 'United States',
    problem: cleanText(raw?.problem, 900) || 'unknown',
    painEvidence: Array.isArray(raw?.painEvidence) ? raw.painEvidence.map((x) => cleanText(x, 500)).filter(Boolean).slice(0, 6) : [],
    frequency: cleanText(raw?.frequency, 300) || 'unknown',
    currentWorkaround: cleanText(raw?.currentWorkaround, 500) || 'unknown',
    incumbentSolutions: cleanText(raw?.incumbentSolutions, 500) || 'unknown',
    spendOrLossEvidence: cleanText(raw?.spendOrLossEvidence, 500) || 'unknown',
    proposedWebSolution: cleanText(raw?.proposedWebSolution, 700) || 'unknown',
    businessModel: cleanText(raw?.businessModel, 300) || 'unknown',
    reachability: cleanText(raw?.reachability, 400) || 'unknown',
    distributionPath: cleanText(raw?.distributionPath, 500) || 'unknown',
    estimatedCustomerUniverse: cleanText(raw?.estimatedCustomerUniverse, 300) || 'unknown',
    competitiveDifficulty: ['LOW','MEDIUM','HIGH','UNKNOWN'].includes(raw?.competitiveDifficulty) ? raw.competitiveDifficulty : 'UNKNOWN',
    buildComplexity: ['LOW','MEDIUM','HIGH'].includes(raw?.buildComplexity) ? raw.buildComplexity : 'MEDIUM',
    regulatoryRisk: ['LOW','MEDIUM','HIGH','UNKNOWN'].includes(raw?.regulatoryRisk) ? raw.regulatoryRisk : 'UNKNOWN',
    evidenceRefs: refs,
    confidence: Math.max(0, Math.min(100, Number(raw?.confidence || 0))),
    decision: refs.length ? decision : 'BLOCKED_EVIDENCE',
    killReason: cleanText(raw?.killReason, 600) || null,
    nextAction: cleanText(raw?.nextAction, 700) || 'Gather stronger evidence.',
    checkedAt: now,
    reviewerStatus: 'PENDING',
  };
  base.candidateId = candidateIdFor(base);
  return base;
}

function applyReview(candidates, review) {
  const accepted = new Set(Array.isArray(review?.acceptedCandidateIds) ? review.acceptedCandidateIds : []);
  const rejected = new Set(Array.isArray(review?.rejectedCandidateIds) ? review.rejectedCandidateIds : []);
  const overrides = new Map(
    (Array.isArray(review?.overrides) ? review.overrides : [])
      .filter((x) => x?.candidateId)
      .map((x) => [x.candidateId, x])
  );
  return candidates.map((candidate) => {
    const override = overrides.get(candidate.candidateId);
    const out = { ...candidate };
    if (override && ALLOWED_DECISIONS.has(override.decision)) {
      out.decision = override.decision;
      if (override.reason) out.reviewReason = cleanText(override.reason, 700);
    }
    if (accepted.has(candidate.candidateId)) {
      out.reviewerStatus = 'PASS';
    } else if (rejected.has(candidate.candidateId)) {
      out.reviewerStatus = 'FAIL';
      if (out.decision === 'ADVANCE') out.decision = 'BLOCKED_EVIDENCE';
    } else {
      out.reviewerStatus = review?.verdict === 'PASS' ? 'UNRESOLVED' : 'FAIL';
      if (out.decision === 'ADVANCE') out.decision = 'BLOCKED_EVIDENCE';
    }
    return out;
  });
}

function loadState(path) {
  if (!path || !fs.existsSync(path)) {
    return { schemaVersion: '1.0', missionId: territoryConfig.missionId, runCount: 0, candidates: [], coverage: {}, updatedAt: null };
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(path, 'utf8'));
    return {
      schemaVersion: '1.0',
      missionId: territoryConfig.missionId,
      runCount: Number(parsed.runCount || 0),
      candidates: Array.isArray(parsed.candidates) ? parsed.candidates : [],
      coverage: parsed.coverage && typeof parsed.coverage === 'object' ? parsed.coverage : {},
      updatedAt: parsed.updatedAt || null,
    };
  } catch (_) {
    return { schemaVersion: '1.0', missionId: territoryConfig.missionId, runCount: 0, candidates: [], coverage: {}, updatedAt: null };
  }
}

function mergeCandidates(existing, incoming) {
  const map = new Map(existing.map((x) => [x.candidateId, x]));
  for (const candidate of incoming) {
    const prior = map.get(candidate.candidateId);
    if (!prior) {
      map.set(candidate.candidateId, candidate);
      continue;
    }
    map.set(candidate.candidateId, {
      ...prior,
      ...candidate,
      evidenceRefs: [...new Set([...(prior.evidenceRefs || []), ...(candidate.evidenceRefs || [])])],
      painEvidence: [...new Set([...(prior.painEvidence || []), ...(candidate.painEvidence || [])])].slice(0, 10),
      firstCheckedAt: prior.firstCheckedAt || prior.checkedAt,
    });
  }
  return [...map.values()];
}

function nextTerritories(state) {
  const ranked = territoryConfig.territories.filter((territory) => {
    const c = state.coverage[territory.id];
    if (!c) return true;
    if (c.status === 'PROCESSED') return false;
    return Number(c.attempts || 0) < 3;
  });
  return ranked.slice(0, TERRITORIES_PER_RUN);
}

function dispositionCounts(candidates) {
  const counts = { ADVANCE:0, WATCH:0, DEFER:0, KILL:0, BLOCKED_EVIDENCE:0 };
  for (const candidate of candidates) {
    if (candidate && counts[candidate.decision] !== undefined) counts[candidate.decision] += 1;
  }
  return counts;
}

async function run(options = {}) {
  const now = options.now || new Date().toISOString();
  const token = options.token || process.env.GITHUB_TOKEN;
  const state = loadState(options.statePath);
  const workOrder = await fetchWorkOrder(token);
  if (workOrder.state !== 'open') throw new Error('WORK_ORDER_NOT_OPEN');

  const selected = nextTerritories(state);
  const inferenceReceipts = [];
  const sourceReceipts = [];
  const runCandidates = [];
  const territoryResults = [];

  for (const territory of selected) {
    const priorCoverage = state.coverage[territory.id] || {};
    const attempts = Number(priorCoverage.attempts || 0) + 1;
    try {
      const evidence = await collectEvidence(territory);
      sourceReceipts.push(...evidence.receipts.map((x) => ({ territoryId: territory.id, ...x })));
      const allowedUrls = new Set(evidence.items.map((x) => x.url));
      if (evidence.items.length < 2) {
        state.coverage[territory.id] = {
          label: territory.label,
          status: attempts >= 3 ? 'BLOCKED_EVIDENCE' : 'RETRY_EVIDENCE',
          attempts,
          evidenceItems: evidence.items.length,
          lastCheckedAt: now,
        };
        territoryResults.push({ territoryId: territory.id, status: state.coverage[territory.id].status, candidateCount: 0 });
        continue;
      }

      const analystCall = await callBridge({
        role: 'analyst',
        payload: {
          workOrder,
          territory: { id: territory.id, label: territory.label, queries: territory.queries },
          evidence: evidence.items,
          evidenceBoundary: 'Use only supplied evidence URLs. Unknown claims must remain unknown.',
        },
      });
      inferenceReceipts.push({ territoryId: territory.id, ...analystCall.receipt });
      const rawClusters = Array.isArray(analystCall.output?.clusters) ? analystCall.output.clusters.slice(0, 5) : [];
      const normalized = rawClusters.map((raw) => normalizeCandidate(raw, territory, allowedUrls, now));

      if (!normalized.length) {
        state.coverage[territory.id] = {
          label: territory.label,
          status: 'PROCESSED',
          attempts,
          evidenceItems: evidence.items.length,
          candidateCount: 0,
          lastCheckedAt: now,
        };
        territoryResults.push({ territoryId: territory.id, status: 'PROCESSED', candidateCount: 0 });
        continue;
      }

      const reviewerCall = await callBridge({
        role: 'reviewer',
        payload: {
          territory: { id: territory.id, label: territory.label },
          evidence: evidence.items,
          candidates: normalized,
          reviewBoundary: 'A PASS means evidence discipline is acceptable, not that the business is proven.',
        },
      });
      inferenceReceipts.push({ territoryId: territory.id, ...reviewerCall.receipt });
      const reviewed = applyReview(normalized, reviewerCall.output);
      runCandidates.push(...reviewed);

      state.coverage[territory.id] = {
        label: territory.label,
        status: 'PROCESSED',
        attempts,
        evidenceItems: evidence.items.length,
        candidateCount: reviewed.length,
        reviewerVerdict: reviewerCall.output?.verdict || 'UNKNOWN',
        lastCheckedAt: now,
      };
      territoryResults.push({
        territoryId: territory.id,
        status: 'PROCESSED',
        candidateCount: reviewed.length,
        reviewerVerdict: reviewerCall.output?.verdict || 'UNKNOWN',
      });
    } catch (error) {
      state.coverage[territory.id] = {
        label: territory.label,
        status: attempts >= 3 ? 'BLOCKED_EXECUTION' : 'RETRY_EXECUTION',
        attempts,
        error: cleanText(error.message, 900),
        lastCheckedAt: now,
      };
      territoryResults.push({ territoryId: territory.id, status: state.coverage[territory.id].status, error: cleanText(error.message, 900), candidateCount: 0 });
    }
  }

  state.candidates = mergeCandidates(state.candidates, runCandidates);
  state.runCount += 1;
  state.updatedAt = now;

  const allTerritories = territoryConfig.territories.length;
  const processed = Object.values(state.coverage).filter((x) => x.status === 'PROCESSED').length;
  const blocked = Object.values(state.coverage).filter((x) => /^BLOCKED_/.test(x.status)).length;
  const remaining = allTerritories - processed - blocked;
  const zeroSpend = inferenceReceipts.every((r) => Number(r.pricingReceipt?.inputPricePerToken) === 0 && Number(r.pricingReceipt?.outputPricePerToken) === 0 && r.pricingReceipt?.freeTag === true);
  const separateModels = inferenceReceipts.filter((r) => r.role === 'analyst').every((a) => a.requestedModel === ANALYST_MODEL)
    && inferenceReceipts.filter((r) => r.role === 'reviewer').every((r) => r.requestedModel === REVIEWER_MODEL)
    && ANALYST_MODEL !== REVIEWER_MODEL;
  const badRefs = runCandidates.filter((candidate) => !Array.isArray(candidate.evidenceRefs) || candidate.evidenceRefs.some((url) => !/^https:\/\//.test(url))).length;
  const fatal = selected.length > 0 && territoryResults.every((x) => /^RETRY_EXECUTION|^BLOCKED_EXECUTION/.test(x.status));

  const packet = {
    schemaVersion: '1.0',
    runId: `OUCS-LIVE-${process.env.GITHUB_RUN_ID || Date.now()}`,
    teamId: 'OPPORTUNITY-INTELLIGENCE-011',
    missionId: territoryConfig.missionId,
    workOrder,
    startedAt: now,
    completedAt: new Date().toISOString(),
    terminalState: fatal ? 'BLOCKED' : 'DELIVERED',
    selectedTerritories: selected.map((x) => x.id),
    territoryResults,
    sourceReceipts,
    runCandidates,
    totals: {
      distinctCandidates: state.candidates.length,
      dispositions: dispositionCounts(state.candidates),
      territoriesTotal: allTerritories,
      territoriesProcessed: processed,
      territoriesBlocked: blocked,
      territoriesRemaining: Math.max(0, remaining),
    },
    coverage: state.coverage,
    execution: {
      provider: 'vercel-ai-gateway-oidc',
      inferenceReceipts,
      separateInferenceCalls: true,
      separateModels,
      analystModel: ANALYST_MODEL,
      reviewerModel: REVIEWER_MODEL,
      zeroSpendModelGate: zeroSpend,
      spendAuthorized: false,
      spendCentsClaimed: 0,
      outreachAuthorized: false,
      purchasingAuthorized: false,
      publicationAuthorized: false,
    },
    qa: {
      status: !fatal && zeroSpend && separateModels && badRefs === 0 ? 'PASS' : 'FAIL',
      evidenceUrlsInvalid: badRefs,
      zeroSpendReceiptsVerified: zeroSpend,
      independentReviewerModelDistinct: separateModels,
      candidatesPersistedIncludingRejects: true,
    },
    nextAction: remaining > 0
      ? 'Process the next unexamined or retry-eligible opportunity territories.'
      : 'Census territory pass complete; rank evidence-qualified survivors and begin deeper validation.',
  };

  if (options.stateOutput) fs.writeFileSync(options.stateOutput, JSON.stringify(state, null, 2) + '\n');
  if (options.output) fs.writeFileSync(options.output, JSON.stringify(packet, null, 2) + '\n');
  return { packet, state };
}

function parseArgs(argv) {
  const out = {};
  for (const arg of argv) {
    const m = String(arg).match(/^--([^=]+)=(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.output || !args['state-output']) {
    console.error('Usage: node live-opportunity-census.cjs --state=/tmp/prior.json --state-output=/tmp/state.json --output=/tmp/run.json');
    process.exit(2);
  }
  try {
    const { packet } = await run({ statePath: args.state, stateOutput: args['state-output'], output: args.output });
    console.log(JSON.stringify({
      status: packet.terminalState === 'DELIVERED' && packet.qa.status === 'PASS' ? 'PASS' : 'FAIL',
      terminalState: packet.terminalState,
      qa: packet.qa.status,
      distinctCandidates: packet.totals.distinctCandidates,
      territoriesProcessed: packet.totals.territoriesProcessed,
      territoriesRemaining: packet.totals.territoriesRemaining,
    }));
    process.exit(packet.terminalState === 'DELIVERED' && packet.qa.status === 'PASS' ? 0 : 1);
  } catch (error) {
    console.error(JSON.stringify({ status: 'BLOCKED', error: error.message }));
    process.exit(2);
  }
}

if (require.main === module) main();

module.exports = {
  cleanText,
  safeJsonParse,
  candidateIdFor,
  normalizeCandidate,
  applyReview,
  mergeCandidates,
  dispositionCounts,
  nextTerritories,
  run,
};
