const crypto = require('node:crypto');

const SCHEMA_VERSION = '1.0';
const DEFAULT_MAX_AGE_HOURS = 24;
const STATUSES = new Set(['CONSISTENT', 'STALE', 'CONFLICT', 'BLOCKED']);

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

function sha256(value) {
  return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

function parseTime(value) {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function freshness(asOf, nowMs, maxAgeHours) {
  const asOfMs = parseTime(asOf);
  if (asOfMs === null) return { asOf: asOf ?? null, ageHours: null, status: 'STALE' };
  const ageHours = (nowMs - asOfMs) / 36e5;
  return {
    asOf,
    ageHours: Math.max(0, Math.round(ageHours * 100) / 100),
    status: ageHours < 0 || ageHours > maxAgeHours ? 'STALE' : 'FRESH',
  };
}

function pushConflict(conflicts, field, values) {
  const defined = Object.entries(values).filter(([, value]) => value !== undefined && value !== null && value !== '');
  if (defined.length < 2) return;
  const unique = new Set(defined.map(([, value]) => JSON.stringify(value)));
  if (unique.size > 1) conflicts.push({ field, values: Object.fromEntries(defined) });
}

function mergeBlockers(...lists) {
  return [...new Set(lists.flatMap((value) => Array.isArray(value) ? value : []).filter(Boolean))];
}

function reconcileSourceMarginState(input) {
  if (!input || typeof input !== 'object') throw new TypeError('input object required');
  const { supabase = {}, workControl = {}, github = {} } = input;
  const nowMs = parseTime(input.now);
  if (nowMs === null) throw new Error('valid input.now is required for deterministic freshness checks');
  const maxAgeHours = Number.isFinite(input.maxAgeHours) ? input.maxAgeHours : DEFAULT_MAX_AGE_HOURS;
  if (maxAgeHours <= 0) throw new Error('maxAgeHours must be positive');

  const conflicts = [];
  pushConflict(conflicts, 'projectId', {
    supabase: supabase.projectId,
    workControl: workControl.projectId,
    github: github.projectId,
  });
  pushConflict(conflicts, 'milestoneId', {
    supabase: supabase.milestoneId,
    workControl: workControl.milestoneId,
    github: github.milestoneId,
  });
  pushConflict(conflicts, 'currentPhase', {
    supabase: supabase.currentPhase,
    github: github.currentPhase,
  });
  pushConflict(conflicts, 'stage2.frozen', {
    supabase: supabase.stage2?.frozen,
    github: github.stage2?.frozen,
  });
  pushConflict(conflicts, 'stage2.checkpointTarget', {
    supabase: supabase.stage2?.checkpointTarget,
    github: github.stage2?.checkpointTarget,
  });
  pushConflict(conflicts, 'census.creditedCoveragePct', {
    supabase: supabase.census?.creditedCoveragePct,
    github: github.census?.creditedCoveragePct,
  });

  const freshnessBySource = {
    supabase: freshness(supabase.asOf, nowMs, maxAgeHours),
    workControl: freshness(workControl.asOf, nowMs, maxAgeHours),
    github: freshness(github.asOf, nowMs, maxAgeHours),
  };

  const missingExecution = [];
  if (!workControl.owner) missingExecution.push('owner');
  if (!workControl.nextAction) missingExecution.push('nextAction');
  if (!workControl.activeWorkOrder) missingExecution.push('activeWorkOrder');

  let reconciliationStatus = 'CONSISTENT';
  if (conflicts.length) reconciliationStatus = 'CONFLICT';
  else if (missingExecution.length) reconciliationStatus = 'BLOCKED';
  else if (Object.values(freshnessBySource).some((entry) => entry.status === 'STALE')) reconciliationStatus = 'STALE';
  if (!STATUSES.has(reconciliationStatus)) throw new Error('invalid reconciliation status');

  const projectId = workControl.projectId || supabase.projectId || github.projectId || null;
  const milestoneId = workControl.milestoneId || supabase.milestoneId || github.milestoneId || null;
  const currentPhase = supabase.currentPhase || github.currentPhase || null;
  const stage2 = supabase.stage2 || github.stage2 || null;
  const census = supabase.census || github.census || null;

  const receipt = {
    schemaVersion: SCHEMA_VERSION,
    authority: 'Observe',
    projectId,
    milestoneId,
    generatedAt: input.now,
    reconciliationStatus,
    currentPhase,
    activeWorkOrder: workControl.activeWorkOrder || null,
    owner: workControl.owner || null,
    nextAction: workControl.nextAction || null,
    lifecycle: workControl.lifecycle || null,
    stage2Checkpoint: stage2 ? {
      frozen: stage2.frozen ?? null,
      checkpointTarget: stage2.checkpointTarget ?? null,
      cohortTarget: stage2.cohortTarget ?? null,
      sourceReady: stage2.sourceReady ?? null,
      sampleReady: stage2.sampleReady ?? null,
    } : null,
    censusCoverage: census ? {
      creditedCoveragePct: census.creditedCoveragePct ?? null,
      status: census.status ?? null,
    } : null,
    blockers: mergeBlockers(supabase.blockers, workControl.blockers, github.blockers),
    lastMaterialDecision: github.lastMaterialDecision || supabase.lastMaterialDecision || null,
    freshness: freshnessBySource,
    missingExecutionFields: missingExecution,
    conflicts,
    sourceRefs: [...new Set([
      ...(Array.isArray(supabase.sourceRefs) ? supabase.sourceRefs : []),
      ...(Array.isArray(workControl.sourceRefs) ? workControl.sourceRefs : []),
      ...(Array.isArray(github.sourceRefs) ? github.sourceRefs : []),
    ])],
  };

  receipt.receiptId = `SM-STATE-${sha256(receipt).slice(0, 16)}`;
  return Object.freeze(receipt);
}

module.exports = {
  DEFAULT_MAX_AGE_HOURS,
  reconcileSourceMarginState,
};
