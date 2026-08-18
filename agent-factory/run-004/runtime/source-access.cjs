'use strict';

const MACHINE_ACCESS_MODES = Object.freeze(new Set(['official_api', 'licensed_feed', 'public_download']));
const ALL_ACCESS_MODES = Object.freeze(new Set(['owner_upload', 'manual_verification', 'official_api', 'licensed_feed', 'public_download']));

function parseIso(value, fieldName) {
  const time = Date.parse(value);
  if (!Number.isFinite(time)) {
    const error = new Error(`${fieldName} must be a valid ISO date-time`);
    error.code = 'SOURCE_ACCESS_REGISTRY_INVALID';
    throw error;
  }
  return time;
}

function validateRegistry(registry) {
  const errors = [];
  if (!registry || typeof registry !== 'object') errors.push('registry is required');
  else {
    if (registry.schemaVersion !== '1.0.0') errors.push('schemaVersion must be 1.0.0');
    if (registry.registryId !== 'DS-S2M-004-SOURCE-ACCESS') errors.push('registryId mismatch');
    if (registry.defaultDecision !== 'DENY') errors.push('defaultDecision must be DENY');
    if (!Array.isArray(registry.sources)) errors.push('sources must be an array');
  }

  const ids = new Set();
  for (const source of registry?.sources || []) {
    if (!source || typeof source !== 'object') {
      errors.push('each source must be an object');
      continue;
    }
    if (!source.sourceId) errors.push('sourceId is required');
    if (ids.has(source.sourceId)) errors.push(`duplicate sourceId: ${source.sourceId}`);
    ids.add(source.sourceId);
    if (!['GREEN', 'YELLOW', 'RED'].includes(source.classification)) errors.push(`invalid classification for ${source.sourceId || 'unknown source'}`);
    if (typeof source.killSwitch !== 'boolean') errors.push(`killSwitch must be boolean for ${source.sourceId}`);
    if (typeof source.machineFetchAllowed !== 'boolean') errors.push(`machineFetchAllowed must be boolean for ${source.sourceId}`);
    if (!Array.isArray(source.allowedAccessModes)) errors.push(`allowedAccessModes must be an array for ${source.sourceId}`);
    else for (const mode of source.allowedAccessModes) if (!ALL_ACCESS_MODES.has(mode)) errors.push(`unknown access mode ${mode} for ${source.sourceId}`);
    if (!source.rightsEvidence?.ref || !source.rightsEvidence?.type || !source.rightsEvidence?.reviewedBy) errors.push(`rightsEvidence is incomplete for ${source.sourceId}`);
    try {
      parseIso(source.lastReviewedAt, `lastReviewedAt for ${source.sourceId}`);
      parseIso(source.nextReviewAt, `nextReviewAt for ${source.sourceId}`);
    } catch (error) {
      errors.push(error.message);
    }
    if (source.classification !== 'GREEN' && source.machineFetchAllowed) errors.push(`machineFetchAllowed requires GREEN classification for ${source.sourceId}`);
    if (source.machineFetchAllowed) {
      const machineModes = (source.allowedAccessModes || []).filter((mode) => MACHINE_ACCESS_MODES.has(mode));
      if (!machineModes.length) errors.push(`machineFetchAllowed requires a machine access mode for ${source.sourceId}`);
    }
  }

  if (errors.length) {
    const error = new Error(`Invalid Source Access Registry: ${errors.join('; ')}`);
    error.code = 'SOURCE_ACCESS_REGISTRY_INVALID';
    error.details = errors;
    throw error;
  }
  return registry;
}

function accessDecision(allowed, reason, source = null, extras = {}) {
  return Object.freeze({
    allowed,
    reason,
    sourceId: source?.sourceId || null,
    classification: source?.classification || null,
    machineFetchAllowed: source?.machineFetchAllowed || false,
    killSwitch: source?.killSwitch ?? null,
    externalActions: 0,
    spendingCents: 0,
    ...extras,
  });
}

function evaluateSourceAccess({ registry, sourceId, accessMode, automated = false, at = new Date().toISOString() }) {
  validateRegistry(registry);
  if (!sourceId) return accessDecision(false, 'sourceId is required');
  if (!ALL_ACCESS_MODES.has(accessMode)) return accessDecision(false, 'access mode is unknown');

  const source = registry.sources.find((candidate) => candidate.sourceId === sourceId);
  if (!source) return accessDecision(false, 'source is not registered');
  if (source.killSwitch) return accessDecision(false, 'source kill switch is active', source);
  if (source.classification === 'RED') return accessDecision(false, 'RED sources are blocked', source);
  if (!source.allowedAccessModes.includes(accessMode)) return accessDecision(false, 'requested access mode is not authorized for source', source);

  const now = parseIso(at, 'access evaluation time');
  const nextReview = parseIso(source.nextReviewAt, `nextReviewAt for ${source.sourceId}`);
  if (now >= nextReview) return accessDecision(false, 'source rights review is expired', source);
  if (!source.rightsEvidence?.ref || source.rightsEvidence.ref === 'not-reviewed') return accessDecision(false, 'source rights evidence is not verified', source);

  const isMachineMode = MACHINE_ACCESS_MODES.has(accessMode);
  if (automated || isMachineMode) {
    if (source.classification !== 'GREEN') return accessDecision(false, 'automated retrieval requires GREEN classification', source);
    if (!source.machineFetchAllowed) return accessDecision(false, 'machine retrieval is disabled for this source', source);
    if (!isMachineMode) return accessDecision(false, 'automated retrieval requires an approved machine access mode', source);
  }

  if (source.classification === 'YELLOW' && accessMode !== 'manual_verification') return accessDecision(false, 'YELLOW sources are manual-verification only', source);

  return accessDecision(true, 'source access permitted within registered mode', source, {
    accessMode,
    rightsEvidenceRef: source.rightsEvidence.ref,
    nextReviewAt: source.nextReviewAt,
  });
}

function assertSourceAccess(input) {
  const result = evaluateSourceAccess(input);
  if (!result.allowed) {
    const error = new Error(`Source access denied: ${result.reason}`);
    error.code = 'SOURCE_ACCESS_DENIED';
    error.decision = result;
    throw error;
  }
  return result;
}

module.exports = { ALL_ACCESS_MODES, MACHINE_ACCESS_MODES, assertSourceAccess, evaluateSourceAccess, validateRegistry };
