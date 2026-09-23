'use strict';

const {
  deterministicIdempotencyKey,
  integrityKey,
} = require('./runtime.cjs');

const OPERATORS = new Set([
  'EXISTS',
  'NOT_EXISTS',
  'EQ',
  'NEQ',
  'IN',
  'NOT_IN',
  'GTE',
  'LTE',
  'GT',
  'LT',
  'TRUE',
  'FALSE',
]);

const AUTHORITY_MODES = new Set([
  'OBSERVE',
  'INTERNAL_WRITE',
  'EXTERNAL_WRITE_GATED',
]);

const READINESS_STATES = Object.freeze([
  'READY',
  'WAITING',
  'BLOCKED',
  'INVALID',
]);

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function hasOwnPath(root, dottedPath) {
  if (!isPlainObject(root) || typeof dottedPath !== 'string' || !dottedPath.trim()) {
    return { exists: false, value: undefined };
  }

  const parts = dottedPath.split('.').filter(Boolean);
  let cursor = root;

  for (const part of parts) {
    if (cursor === null || cursor === undefined || (typeof cursor !== 'object' && !Array.isArray(cursor))) {
      return { exists: false, value: undefined };
    }
    if (!Object.prototype.hasOwnProperty.call(cursor, part)) {
      return { exists: false, value: undefined };
    }
    cursor = cursor[part];
  }

  return { exists: true, value: cursor };
}

function validatePredicate(rule, { blockRule = false } = {}) {
  const errors = [];
  if (!isPlainObject(rule)) return ['predicate must be an object'];
  if (typeof rule.fact !== 'string' || !rule.fact.trim()) errors.push('predicate.fact required');
  if (!OPERATORS.has(rule.operator)) errors.push('predicate.operator invalid');

  const needsValue = new Set(['EQ','NEQ','IN','NOT_IN','GTE','LTE','GT','LT']);
  if (needsValue.has(rule.operator) && !Object.prototype.hasOwnProperty.call(rule, 'value')) {
    errors.push('predicate.value required for operator');
  }
  if (['IN','NOT_IN'].includes(rule.operator) && !Array.isArray(rule.value)) {
    errors.push('predicate.value must be an array for IN/NOT_IN');
  }
  if (blockRule && (typeof rule.reason !== 'string' || !rule.reason.trim())) {
    errors.push('block predicate reason required');
  }
  return errors;
}

function validateContract(contract) {
  const errors = [];
  if (!isPlainObject(contract)) return { valid:false, errors:['contract must be an object'] };

  if (typeof contract.workflowId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{2,119}$/.test(contract.workflowId)) {
    errors.push('workflowId invalid');
  }
  if (typeof contract.version !== 'string' || !contract.version.trim() || contract.version.length > 40) {
    errors.push('version invalid');
  }
  if (typeof contract.owner !== 'string' || contract.owner.trim().length < 2 || contract.owner.length > 160) {
    errors.push('owner invalid');
  }
  if (!Number.isInteger(contract.priority) || contract.priority < 0 || contract.priority > 100) {
    errors.push('priority invalid');
  }
  if (!Array.isArray(contract.requires) || contract.requires.length > 64) {
    errors.push('requires invalid');
  } else {
    contract.requires.forEach((rule, index) => {
      for (const error of validatePredicate(rule)) errors.push(`requires[${index}]: ${error}`);
    });
  }
  if (!Array.isArray(contract.blocksIf) || contract.blocksIf.length > 64) {
    errors.push('blocksIf invalid');
  } else {
    contract.blocksIf.forEach((rule, index) => {
      for (const error of validatePredicate(rule, { blockRule:true })) errors.push(`blocksIf[${index}]: ${error}`);
    });
  }
  if (!Array.isArray(contract.produces) || contract.produces.length < 1 || contract.produces.length > 64) {
    errors.push('produces invalid');
  } else {
    const seen = new Set();
    contract.produces.forEach((key, index) => {
      if (typeof key !== 'string' || !key.trim()) errors.push(`produces[${index}] invalid`);
      else if (seen.has(key)) errors.push(`produces[${index}] duplicate`);
      else seen.add(key);
    });
  }

  const authority = contract.authority;
  if (!isPlainObject(authority)) {
    errors.push('authority invalid');
  } else {
    if (!AUTHORITY_MODES.has(authority.mode)) errors.push('authority.mode invalid');
    if (typeof authority.externalActionAuthorized !== 'boolean') errors.push('authority.externalActionAuthorized invalid');
    if (!Number.isInteger(authority.costCeilingCents) || authority.costCeilingCents < 0) errors.push('authority.costCeilingCents invalid');

    if (authority.mode !== 'EXTERNAL_WRITE_GATED' && authority.externalActionAuthorized === true) {
      errors.push('external action authorization requires EXTERNAL_WRITE_GATED mode');
    }
  }

  if (contract.dispatchTarget !== undefined && contract.dispatchTarget !== null) {
    const target = contract.dispatchTarget;
    const kinds = new Set(['WORK_CONTROL_WORKER','N8N_WORKFLOW','INTERNAL_SERVICE','NONE']);
    if (!isPlainObject(target) || !kinds.has(target.kind) || typeof target.id !== 'string' || !target.id.trim()) {
      errors.push('dispatchTarget invalid');
    }
  }

  return { valid: errors.length === 0, errors };
}

function predicateMatches(rule, facts) {
  const observed = hasOwnPath(facts, rule.fact);
  const actual = observed.value;
  const exists = observed.exists && actual !== undefined && actual !== null;

  switch (rule.operator) {
    case 'EXISTS': return exists;
    case 'NOT_EXISTS': return !exists;
    case 'EQ': return exists && actual === rule.value;
    case 'NEQ': return exists && actual !== rule.value;
    case 'IN': return exists && rule.value.includes(actual);
    case 'NOT_IN': return exists && !rule.value.includes(actual);
    case 'GTE': return exists && typeof actual === 'number' && typeof rule.value === 'number' && actual >= rule.value;
    case 'LTE': return exists && typeof actual === 'number' && typeof rule.value === 'number' && actual <= rule.value;
    case 'GT': return exists && typeof actual === 'number' && typeof rule.value === 'number' && actual > rule.value;
    case 'LT': return exists && typeof actual === 'number' && typeof rule.value === 'number' && actual < rule.value;
    case 'TRUE': return exists && actual === true;
    case 'FALSE': return exists && actual === false;
    default: return false;
  }
}

function snapshotDigest(snapshot) {
  return integrityKey({
    subjectId: snapshot.subjectId,
    inputVersion: snapshot.inputVersion || null,
    facts: snapshot.facts,
  });
}

function evaluateReadiness(contract, snapshot) {
  const contractCheck = validateContract(contract);
  if (!contractCheck.valid) {
    return {
      workflowId: contract?.workflowId || null,
      workflowVersion: contract?.version || null,
      subjectId: snapshot?.subjectId || null,
      state: 'INVALID',
      ready: false,
      dispatchAuthorized: false,
      errors: contractCheck.errors,
      missing: [],
      blockedBy: [],
      satisfied: [],
      proposedWorkKey: null,
      inputDigest: null,
    };
  }

  if (!isPlainObject(snapshot) || typeof snapshot.subjectId !== 'string' || !snapshot.subjectId.trim() || !isPlainObject(snapshot.facts)) {
    return {
      workflowId: contract.workflowId,
      workflowVersion: contract.version,
      subjectId: snapshot?.subjectId || null,
      state: 'INVALID',
      ready: false,
      dispatchAuthorized: false,
      errors: ['snapshot requires subjectId and facts object'],
      missing: [],
      blockedBy: [],
      satisfied: [],
      proposedWorkKey: null,
      inputDigest: null,
    };
  }

  const blockedBy = contract.blocksIf
    .filter((rule) => predicateMatches(rule, snapshot.facts))
    .map((rule) => ({
      fact: rule.fact,
      operator: rule.operator,
      value: Object.prototype.hasOwnProperty.call(rule, 'value') ? rule.value : null,
      reason: rule.reason,
    }));

  const satisfied = [];
  const missing = [];

  for (const rule of contract.requires) {
    if (predicateMatches(rule, snapshot.facts)) {
      satisfied.push({
        fact: rule.fact,
        operator: rule.operator,
        value: Object.prototype.hasOwnProperty.call(rule, 'value') ? rule.value : null,
      });
    } else {
      missing.push({
        fact: rule.fact,
        operator: rule.operator,
        value: Object.prototype.hasOwnProperty.call(rule, 'value') ? rule.value : null,
      });
    }
  }

  const inputDigest = snapshotDigest(snapshot);
  const state = blockedBy.length > 0 ? 'BLOCKED' : missing.length > 0 ? 'WAITING' : 'READY';

  const proposedWorkKey = state === 'READY'
    ? deterministicIdempotencyKey({
        producerId: 'OPS-CORE-008-READINESS',
        eventType: 'factory.micro-workflow.ready',
        subjectId: snapshot.subjectId,
        sourceId: contract.workflowId,
        naturalKey: `${contract.version}:${snapshot.inputVersion || inputDigest}`,
        payload: {
          workflowId: contract.workflowId,
          workflowVersion: contract.version,
          inputDigest,
        },
      })
    : null;

  return {
    workflowId: contract.workflowId,
    workflowVersion: contract.version,
    subjectId: snapshot.subjectId,
    state,
    ready: state === 'READY',
    priority: contract.priority,
    dispatchTarget: contract.dispatchTarget || { kind:'NONE', id:'none' },
    dispatchAuthorized: false,
    authority: contract.authority,
    produces: [...contract.produces],
    errors: [],
    missing,
    blockedBy,
    satisfied,
    proposedWorkKey,
    inputDigest,
  };
}

function evaluateReadinessBatch(items) {
  if (!Array.isArray(items)) throw new TypeError('items array required');

  const decisions = items.map((item) => evaluateReadiness(item.contract, item.snapshot));
  const counts = READINESS_STATES.reduce((acc, state) => {
    acc[state] = decisions.filter((decision) => decision.state === state).length;
    return acc;
  }, {});

  const ready = decisions
    .filter((decision) => decision.state === 'READY')
    .sort((a,b) => (b.priority || 0) - (a.priority || 0) || a.workflowId.localeCompare(b.workflowId));

  return {
    generatedAt: new Date().toISOString(),
    executionAuthority: 'NONE_PHASE_0_1',
    counts,
    ready,
    waiting: decisions.filter((decision) => decision.state === 'WAITING'),
    blocked: decisions.filter((decision) => decision.state === 'BLOCKED'),
    invalid: decisions.filter((decision) => decision.state === 'INVALID'),
    decisions,
  };
}

module.exports = {
  OPERATORS,
  READINESS_STATES,
  hasOwnPath,
  validatePredicate,
  validateContract,
  predicateMatches,
  snapshotDigest,
  evaluateReadiness,
  evaluateReadinessBatch,
};
