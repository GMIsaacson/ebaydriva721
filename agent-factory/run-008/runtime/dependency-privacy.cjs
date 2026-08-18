const DATA_CLASSES = new Set(['PUBLIC','INTERNAL','SENSITIVE','SECRET']);
const DEP_STATES = new Set(['OPEN','BLOCKED','SATISFIED','WAIVED']);

function retentionDecision({ dataClass, observedAt, asOf = new Date().toISOString(), explicitRetentionDays = null }) {
  const defaults = { PUBLIC:3650, INTERNAL:730, SENSITIVE:90, SECRET:0 };
  if (!DATA_CLASSES.has(dataClass)) return { valid:false, reason:'INVALID_DATA_CLASS' };
  const base = defaults[dataClass];
  const retentionDays = Number.isInteger(explicitRetentionDays) && explicitRetentionDays >= 0 ? explicitRetentionDays : base;
  const observed = Date.parse(observedAt || '');
  const now = Date.parse(asOf || '');
  if (Number.isNaN(observed) || Number.isNaN(now)) return { valid:false, reason:'INVALID_DATE' };
  const ageDays = Math.floor((now-observed)/86400000);
  return { valid:true, dataClass, retentionDays, ageDays, expired: ageDays > retentionDays, rawRetentionAllowed: dataClass === 'PUBLIC' || dataClass === 'INTERNAL' };
}

function normalizeDependency(input) {
  if (!input || !input.dependencyId || !input.subjectId || !input.dependsOnId || !DEP_STATES.has(input.state)) {
    return { valid:false, reason:'INVALID_DEPENDENCY' };
  }
  return { valid:true, dependency:{
    dependencyId: input.dependencyId,
    subjectId: input.subjectId,
    dependsOnId: input.dependsOnId,
    state: input.state,
    reason: input.reason || null,
    owner: input.owner || null,
    expectedBy: input.expectedBy || null,
    updatedAt: input.updatedAt || new Date().toISOString()
  }};
}

function dependencyHealth(dependencies, { now = new Date().toISOString(), staleHours = 72 } = {}) {
  const nowMs = Date.parse(now);
  const items = dependencies.map(d => {
    const updated = Date.parse(d.updatedAt || 0);
    const stale = d.state !== 'SATISFIED' && d.state !== 'WAIVED' && Number.isFinite(updated) && nowMs - updated > staleHours * 3600000;
    const overdue = !!d.expectedBy && Date.parse(d.expectedBy) < nowMs && d.state !== 'SATISFIED' && d.state !== 'WAIVED';
    const severity = overdue ? 'URGENT' : stale || d.state === 'BLOCKED' ? 'ATTENTION' : 'INFO';
    return {...d, stale, overdue, severity};
  });
  return {
    items,
    blocked: items.filter(x => x.state === 'BLOCKED'),
    overdue: items.filter(x => x.overdue),
    stale: items.filter(x => x.stale)
  };
}

module.exports = { retentionDecision, normalizeDependency, dependencyHealth };
