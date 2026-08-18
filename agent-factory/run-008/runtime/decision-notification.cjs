const crypto = require('node:crypto');

const AUTHORITY = new Set(['NONE','INTERNAL_WRITE','OWNER_APPROVAL','COST_APPROVAL','EXTERNAL_ACTION_APPROVAL']);
const SEVERITY = new Set(['INFO','ATTENTION','URGENT']);
const STATUS = new Set(['OPEN','APPROVED','REJECTED','EXPIRED','RESOLVED']);

function hash(input) {
  return crypto.createHash('sha256').update(String(input)).digest('hex');
}

function makeDecisionKey({ producerId, subjectId, decisionType, naturalKey = '' }) {
  if (!producerId || !subjectId || !decisionType) throw new Error('MISSING_DECISION_KEY_FIELD');
  return `decision:v1:${hash([producerId, subjectId, decisionType, naturalKey].join('|'))}`;
}

function normalizeDecision(input) {
  const errors = [];
  if (!input || typeof input !== 'object') return { valid:false, errors:['INVALID_INPUT'] };
  if (!input.producerId) errors.push('MISSING_PRODUCER_ID');
  if (!input.subjectId) errors.push('MISSING_SUBJECT_ID');
  if (!input.decisionType) errors.push('MISSING_DECISION_TYPE');
  if (!input.subject) errors.push('MISSING_SUBJECT');
  if (!input.reason) errors.push('MISSING_REASON');
  if (!AUTHORITY.has(input.authorityRequired)) errors.push('INVALID_AUTHORITY_REQUIRED');
  if (!SEVERITY.has(input.severity)) errors.push('INVALID_SEVERITY');
  const status = input.status || 'OPEN';
  if (!STATUS.has(status)) errors.push('INVALID_STATUS');
  if (errors.length) return { valid:false, errors };

  const decisionKey = input.decisionKey || makeDecisionKey(input);
  return {
    valid:true,
    errors:[],
    decision:{
      decisionId: input.decisionId || `dec:${hash(decisionKey).slice(0,24)}`,
      decisionKey,
      producerId: input.producerId,
      subjectId: input.subjectId,
      decisionType: input.decisionType,
      subject: input.subject,
      reason: input.reason,
      recommendation: input.recommendation || null,
      authorityRequired: input.authorityRequired,
      severity: input.severity,
      status,
      deadlineAt: input.deadlineAt || null,
      estimatedCostCents: Number.isInteger(input.estimatedCostCents) ? input.estimatedCostCents : 0,
      evidenceRefs: Array.isArray(input.evidenceRefs) ? input.evidenceRefs : [],
      createdAt: input.createdAt || new Date().toISOString()
    }
  };
}

function routeDecision(decision, { now = new Date().toISOString(), priorNotifications = [] } = {}) {
  if (!decision || decision.status !== 'OPEN') return { channelClass:'SILENT', shouldNotify:false, reason:'NOT_OPEN', cooldownKey:null };

  let channelClass = 'BRIEF';
  if (decision.severity === 'URGENT') channelClass = 'IMMEDIATE';
  if (decision.severity === 'INFO' && decision.authorityRequired === 'NONE') channelClass = 'SILENT';

  const cooldownKey = `notify:${decision.decisionKey}:${channelClass}`;
  const cooldownHours = channelClass === 'IMMEDIATE' ? 24 : 20;
  const cutoff = Date.parse(now) - cooldownHours * 3600 * 1000;
  const duplicate = priorNotifications.some((n) => n.cooldownKey === cooldownKey && Date.parse(n.sentAt || n.createdAt || 0) >= cutoff);

  if (duplicate) return { channelClass:'SILENT', shouldNotify:false, reason:'COOLDOWN_SUPPRESSED', cooldownKey };

  return {
    channelClass,
    shouldNotify: channelClass !== 'SILENT',
    reason: channelClass === 'IMMEDIATE' ? 'URGENT_DECISION' : channelClass === 'BRIEF' ? 'DECISION_REQUIRES_ATTENTION' : 'NO_OWNER_ATTENTION_REQUIRED',
    cooldownKey,
    incidentKey: `incident:${decision.decisionKey}`,
    message:{
      title: decision.subject,
      reason: decision.reason,
      recommendation: decision.recommendation,
      authorityRequired: decision.authorityRequired,
      deadlineAt: decision.deadlineAt,
      estimatedCostCents: decision.estimatedCostCents
    }
  };
}

function rankOpenDecisions(decisions, now = new Date().toISOString()) {
  const severityRank = { URGENT:3, ATTENTION:2, INFO:1 };
  return decisions.filter(d => d.status === 'OPEN').sort((a,b) => {
    const s = severityRank[b.severity] - severityRank[a.severity];
    if (s) return s;
    const ad = a.deadlineAt ? Date.parse(a.deadlineAt) : Infinity;
    const bd = b.deadlineAt ? Date.parse(b.deadlineAt) : Infinity;
    if (ad !== bd) return ad - bd;
    return (b.estimatedCostCents || 0) - (a.estimatedCostCents || 0);
  }).map((d,index) => ({...d, rank:index+1, overdue: !!d.deadlineAt && Date.parse(d.deadlineAt) < Date.parse(now)}));
}

module.exports = { makeDecisionKey, normalizeDecision, routeDecision, rankOpenDecisions };
