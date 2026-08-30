'use strict';

const { routeSpecialists } = require('./domain-specialist-router.cjs');

function requireProvider(provider) {
  if (typeof provider !== 'function') {
    const error = new Error('WTI_SPECIALIST_PROVIDER_NOT_CONFIGURED');
    error.code = 'WTI_SPECIALIST_PROVIDER_NOT_CONFIGURED';
    throw error;
  }
  return provider;
}

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateExecutionResult(result, expectedId, kind) {
  if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error(`${kind.toUpperCase()}_RESULT_REQUIRED:${expectedId}`);
  if (result.actorId !== expectedId) throw new Error(`${kind.toUpperCase()}_ACTOR_MISMATCH:${expectedId}`);
  if (!nonEmpty(result.provider) || !nonEmpty(result.model) || !nonEmpty(result.output)) throw new Error(`${kind.toUpperCase()}_PROVENANCE_INCOMPLETE:${expectedId}`);
  if (!Array.isArray(result.evidenceRefs) || result.evidenceRefs.length === 0) throw new Error(`${kind.toUpperCase()}_EVIDENCE_REFS_MISSING:${expectedId}`);
  if (!nonEmpty(result.executionId)) throw new Error(`${kind.toUpperCase()}_EXECUTION_ID_MISSING:${expectedId}`);
  return {
    actorId: result.actorId,
    provider: result.provider,
    model: result.model,
    output: result.output,
    evidenceRefs: [...new Set(result.evidenceRefs.map(String).filter(Boolean))],
    confidence: Number.isFinite(Number(result.confidence)) ? Number(result.confidence) : null,
    executionId: result.executionId,
    estimatedCostCents: Number.isFinite(Number(result.estimatedCostCents)) ? Number(result.estimatedCostCents) : 0,
  };
}

async function executeSpecialistCase(caseInput, options = {}) {
  if (!caseInput || typeof caseInput !== 'object' || Array.isArray(caseInput)) throw new Error('CASE_REQUIRED');
  if (!Array.isArray(caseInput.evidenceRefs) || caseInput.evidenceRefs.length === 0) throw new Error('CASE_EVIDENCE_REQUIRED');
  if (!Array.isArray(caseInput.domains) || caseInput.domains.length === 0) throw new Error('CASE_DOMAINS_REQUIRED');

  const provider = requireProvider(options.provider);
  const route = routeSpecialists({ domains: caseInput.domains, priceMentioned: caseInput.priceMentioned === true });
  if (route.status !== 'ROUTED') throw new Error(`SPECIALIST_ROUTING_BLOCKED:${route.blockers.join('|')}`);

  const specialistExecutions = [];
  for (const specialistId of route.specialistPools) {
    const raw = await provider({
      kind: 'specialist', actorId: specialistId, caseId: caseInput.caseId || null, title: caseInput.title || null,
      domains: caseInput.domains, evidenceRefs: caseInput.evidenceRefs, evidencePayload: caseInput.evidencePayload || null,
      instructions: 'Interpret only the supplied evidence within the declared professional discipline. Separate observed facts, inference, uncertainty, and implications. Do not invent missing evidence.'
    });
    specialistExecutions.push(validateExecutionResult(raw, specialistId, 'specialist'));
  }

  const reviewExecutions = [];
  for (const reviewerId of route.independentReviewPools) {
    const raw = await provider({
      kind: 'reviewer', actorId: reviewerId, caseId: caseInput.caseId || null, title: caseInput.title || null,
      domains: caseInput.domains, evidenceRefs: caseInput.evidenceRefs, specialistOutputs: specialistExecutions,
      instructions: 'Independently review the specialist outputs against the supplied evidence and professional standards. Reject unsupported, overconfident, unsafe, or materially incomplete interpretation.'
    });
    reviewExecutions.push(validateExecutionResult(raw, reviewerId, 'reviewer'));
  }

  const actorIds = new Set();
  for (const execution of [...specialistExecutions, ...reviewExecutions]) {
    if (actorIds.has(execution.actorId)) throw new Error(`NON_INDEPENDENT_EXECUTION:${execution.actorId}`);
    actorIds.add(execution.actorId);
  }

  const spendCents = [...specialistExecutions, ...reviewExecutions].reduce((sum, item) => sum + Number(item.estimatedCostCents || 0), 0);
  return {
    schemaVersion: '1.1', caseId: caseInput.caseId || null, route, specialistExecutions, reviewExecutions,
    externalActionsPerformed: 0, spendCents, status: 'EXECUTED_PENDING_PROFESSIONAL_SCORING'
  };
}

module.exports = { requireProvider, validateExecutionResult, executeSpecialistCase };
