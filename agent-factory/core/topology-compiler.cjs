'use strict';

const COMPONENT_TYPES = Object.freeze([
  'software',
  'workflow',
  'agent',
  'decision-support',
  'data-store',
  'service',
  'human-gate',
]);

const EXECUTION_CLASS = Object.freeze({
  software: 'deterministic',
  workflow: 'deterministic',
  agent: 'reasoning',
  'decision-support': 'reasoning',
  'data-store': 'state',
  service: 'external-or-shared',
  'human-gate': 'human',
});

const HYBRID_ROLES = Object.freeze(['orchestrator', 'capability', 'assurance', 'approval']);

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateHybridDefinition(capabilities, handoffs) {
  const errors = [];
  for (const [index, component] of capabilities.entries()) {
    if (!COMPONENT_TYPES.includes(component.componentType)) {
      errors.push(`capabilities[${index}].componentType must be one of ${COMPONENT_TYPES.join(', ')}`);
    }
    if (!HYBRID_ROLES.includes(component.role)) {
      errors.push(`capabilities[${index}].role must be one of ${HYBRID_ROLES.join(', ')}`);
    }
    if (component.canSelfApprove === true) errors.push(`capabilities[${index}] cannot self-approve`);
  }

  const orchestrators = capabilities.filter((component) => component.role === 'orchestrator');
  if (orchestrators.length !== 1) errors.push('hybrid topology requires exactly one orchestrator component');
  const assurance = capabilities.filter((component) => component.role === 'assurance' && component.independentAssurance === true);
  if (assurance.length < 1) errors.push('hybrid topology requires at least one independent assurance component');
  if (!Array.isArray(handoffs) || handoffs.length < 1) errors.push('hybrid topology requires explicit handoffs');

  if (errors.length) throw new Error(errors.join('; '));
}

function validateGraph(capabilities, handoffs) {
  const ids = new Set(capabilities.map((component) => component.id));
  const seenEdges = new Set();
  const incoming = new Map(capabilities.map((component) => [component.id, 0]));
  const outgoing = new Map(capabilities.map((component) => [component.id, []]));

  for (const [index, handoff] of handoffs.entries()) {
    if (!handoff || typeof handoff !== 'object') throw new Error(`handoffs[${index}] must be an object`);
    if (!ids.has(handoff.from) || !ids.has(handoff.to)) throw new Error(`handoffs[${index}] references an unknown component`);
    if (handoff.from === handoff.to) throw new Error(`handoffs[${index}] cannot self-route`);
    if (!nonEmpty(handoff.contract)) throw new Error(`handoffs[${index}].contract is required`);
    const edge = `${handoff.from}->${handoff.to}`;
    if (seenEdges.has(edge)) throw new Error(`duplicate handoff: ${edge}`);
    seenEdges.add(edge);
    incoming.set(handoff.to, incoming.get(handoff.to) + 1);
    outgoing.get(handoff.from).push(handoff.to);
  }

  const orchestrator = capabilities.find((component) => component.role === 'orchestrator');
  for (const component of capabilities) {
    if (component.id !== orchestrator.id && incoming.get(component.id) === 0) {
      throw new Error(`component ${component.id} is unreachable: an incoming handoff is required`);
    }
  }

  const visiting = new Set();
  const visited = new Set();
  function visit(id) {
    if (visiting.has(id)) throw new Error('hybrid topology handoffs must be acyclic');
    if (visited.has(id)) return;
    visiting.add(id);
    for (const next of outgoing.get(id)) visit(next);
    visiting.delete(id);
    visited.add(id);
  }
  for (const component of capabilities) visit(component.id);

  const reachable = new Set([orchestrator.id]);
  const queue = [orchestrator.id];
  while (queue.length) {
    const current = queue.shift();
    for (const next of outgoing.get(current)) {
      if (!reachable.has(next)) { reachable.add(next); queue.push(next); }
    }
  }
  if (reachable.size !== capabilities.length) throw new Error('every hybrid component must be reachable from the orchestrator');
}

function compileHybridTopology({ capabilities, handoffs, domainSlug, identityLabel }) {
  validateHybridDefinition(capabilities, handoffs);
  validateGraph(capabilities, handoffs);
  const suffix = identityLabel.toLowerCase();
  const idMap = new Map(capabilities.map((component) => [component.id, `${domainSlug}-${component.id}-${suffix}`]));
  const components = capabilities.map((component) => ({
    id: idMap.get(component.id),
    name: component.name,
    role: component.role,
    componentType: component.componentType,
    executionClass: EXECUTION_CLASS[component.componentType],
    capabilityId: component.id,
    responsibility: component.responsibility,
    check: component.check,
    independentAssurance: component.independentAssurance === true,
    canSelfApprove: false,
  }));
  return {
    components,
    agents: components.filter((component) => component.componentType === 'agent'),
    handoffs: handoffs.map((handoff) => ({
      from: idMap.get(handoff.from),
      to: idMap.get(handoff.to),
      contract: handoff.contract.trim(),
    })),
  };
}

module.exports = { COMPONENT_TYPES, EXECUTION_CLASS, HYBRID_ROLES, validateHybridDefinition, validateGraph, compileHybridTopology };
