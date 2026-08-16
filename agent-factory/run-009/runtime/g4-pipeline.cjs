const crypto = require('crypto');

const PILOT_MUNICIPALITIES = new Set(['Bloomington', 'Minneapolis', 'Saint Paul', 'Maple Grove']);
const VALID_STATUS = new Set(['ACTIONABLE', 'WATCH', 'REJECTED']);

function stableKey(parts) {
  return crypto.createHash('sha256').update(parts.map(v => String(v || '').trim().toLowerCase()).join('|')).digest('hex');
}

function normalizeText(v) {
  return String(v || '').replace(/\s+/g, ' ').trim();
}

function canonicalizeCandidate(input) {
  if (!input || typeof input !== 'object') throw new Error('candidate_required');
  const municipality = normalizeText(input.municipality);
  const project = normalizeText(input.project);
  const signal = normalizeText(input.signal);
  const source = normalizeText(input.source);
  if (!PILOT_MUNICIPALITIES.has(municipality)) throw new Error('outside_pilot_geography');
  if (!project || !signal || !source) throw new Error('missing_core_evidence');
  const confidence = Number(input.confidence);
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) throw new Error('invalid_confidence');
  const status = normalizeText(input.status).toUpperCase();
  if (!VALID_STATUS.has(status)) throw new Error('invalid_status');
  return {
    ...input,
    municipality,
    project,
    signal,
    source,
    status,
    confidence,
    dedupeKey: stableKey([municipality, project.replace(/[^a-z0-9]/gi, '')]),
  };
}

function dedupeCandidates(candidates) {
  const byKey = new Map();
  const duplicateIds = [];
  for (const raw of candidates) {
    const c = canonicalizeCandidate(raw);
    const prior = byKey.get(c.dedupeKey);
    if (!prior) {
      byKey.set(c.dedupeKey, c);
      continue;
    }
    duplicateIds.push(c.id || c.project);
    const winner = c.confidence > prior.confidence ? c : prior;
    const loser = winner === c ? prior : c;
    winner.evidenceSources = Array.from(new Set([...(winner.evidenceSources || [winner.source]), ...(loser.evidenceSources || [loser.source])])) ;
    byKey.set(c.dedupeKey, winner);
  }
  return { candidates: [...byKey.values()], duplicateIds };
}

function enforceQuality(candidate) {
  const c = canonicalizeCandidate(candidate);
  if (c.status === 'ACTIONABLE') {
    if (c.confidence < 0.75) return { ...c, status: 'WATCH', qaReason: 'confidence_below_actionable_floor' };
    if (!normalizeText(c.electricalThesis)) return { ...c, status: 'REJECTED', qaReason: 'missing_electrical_thesis' };
  }
  if (c.status === 'REJECTED' && !normalizeText(c.rejectReason)) {
    return { ...c, rejectReason: 'Rejected by rule set; reason missing from upstream extraction.', qaReason: 'rejection_reason_repaired' };
  }
  return c;
}

function rankOpportunity(c) {
  const base = Math.round(c.confidence * 100);
  const statusBoost = c.status === 'ACTIONABLE' ? 20 : c.status === 'WATCH' ? 5 : -100;
  const signal = c.signal.toLowerCase();
  let scopeBoost = 0;
  if (/new|ground-up|multifamily|mixed-use|apartments|campus|hospital|construction|redevelopment|manufacturing/.test(signal)) scopeBoost += 10;
  if (/plat|subdivision|survey/.test(signal) && c.status !== 'ACTIONABLE') scopeBoost -= 20;
  return base + statusBoost + scopeBoost;
}

function buildInternalFeed(candidates) {
  return candidates
    .filter(c => c.status !== 'REJECTED')
    .map(c => ({ ...c, priorityScore: rankOpportunity(c) }))
    .sort((a, b) => b.priorityScore - a.priorityScore || b.confidence - a.confidence);
}

function runShadowPipeline(input) {
  const rawCandidates = Array.isArray(input) ? input : input?.candidates;
  if (!Array.isArray(rawCandidates)) throw new Error('candidate_array_required');
  const { candidates: unique, duplicateIds } = dedupeCandidates(rawCandidates);
  const reviewed = unique.map(enforceQuality);
  const counts = reviewed.reduce((acc, c) => {
    acc[c.status] = (acc[c.status] || 0) + 1;
    return acc;
  }, { ACTIONABLE: 0, WATCH: 0, REJECTED: 0 });
  return {
    authority: 'READ_ONLY_INTERNAL_ANALYSIS',
    summary: {
      inputCount: rawCandidates.length,
      uniqueCount: reviewed.length,
      duplicateSuppressed: duplicateIds.length,
      actionableCount: counts.ACTIONABLE,
      watchCount: counts.WATCH,
      rejectedCount: counts.REJECTED,
      externalActions: 0,
    },
    duplicateIds,
    reviewed,
    internalFeed: buildInternalFeed(reviewed),
  };
}

module.exports = {
  canonicalizeCandidate,
  dedupeCandidates,
  enforceQuality,
  rankOpportunity,
  buildInternalFeed,
  runShadowPipeline,
};
