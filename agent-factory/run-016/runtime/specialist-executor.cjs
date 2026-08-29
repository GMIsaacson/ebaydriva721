'use strict';

const routing = require('../config/domain-specialist-routing.json');
const { routeSpecialists } = require('./specialist-router.cjs');

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
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    throw new Error(`${kind.toUpperCase()}_RESULT_REQUIRED:${expectedId}`);
  }
  if (result.actorId !== expectedId) {
    throw new Error(`${kind.toUpperCase()}_ACTOR_MISMATCH:${expectedId}`);
  }
  if (!nonEmpty(result.provider) || !nonEmpty(result.model) || !nonEmpty(result.output)) {
    throw new Error(`${kind.toUpperCase()}_PROVENANCE_INCOMPLETE:${expectedId}`);
  }
  if (!Array.isArray(result.evidenceRefs) || result.evidenceRefs.length === 0) {
    throw new Error(`${kind.toUpperCase()}_EVIDENCE_REFS_MISSING:${expectedId}`);
  }
  return {
    actorId: result.actorId,
    provider: result.provider,
    model: result.model,
    output: result.output,
    evidenceRefs: [...new Set(result.evidenceRefs.map(String).filter(Boolean))],
    confidence: Number.isFinite(Number(result.confidence)) ? Number(result.confidence) : null,
    executionId: nonEmpty(result.executionId) ? result.executionId : null,
  };
}

async function executeSpecialistCase(caseInput, options = {}) {
  if (!caseInput || typeof caseInput !== 'object' || Array.isArray(caseInput)) throw new Error('CASE_REQUIRED');
  if (!Array.isArray(caseInput.evidenceRefs) || caseInput.evidenceRefs.length === 0) throw new Error('CASE_EVIDENCE_REQUIRED');
  if (!Array.isArray(caseInput.domains) || caseInput.domains.length === 0) throw new Error('CASE_DOMAINS_REQUIRED');

  const provider = requireProvider(options.provider);
  const route = routeSpecialists({
    domains: caseInput.domains,
    priceMentioned: caseInput.priceMentioned === true,
  });

  if (route.status !== 'PASS') throw new Error(`SPECIALIST_ROUTING_BLOCKED:${route.reason}`);

  const specialistExecutions = [];
  for (const specialistId of route.specialists) {
    const raw = await provider({
      kind: 'specialist',
      actorId: specialistId,
      caseId: caseInput.caseId || null,
      title: caseInput.title || null,
      domains: caseInput.domains,
      evidenceRefs: caseInput.evidenceRefs,
      evidencePayload: caseInput.evidencePayload || null,
      instructions: 'Interpret only the supplied evidence within the declared professional discipline. Separate observed facts, inference, uncertainty, and implications. Do not invent missing evidence.',
    });
    specialistExecutions.push(validateExecutionResult(raw, specialistId, 'specialist'));
  }

  const reviewExecutions = [];
  for (const reviewerId of route.reviewers) {
    const raw = await provider({
      kind: 'reviewer',
      actorId: reviewerId,
      caseId: caseInput.caseId || null,
      title: caseInput.title || null,
      domains: caseInput.domains,
      evidenceRefs: caseInput.evidenceRefs,
      specialistOutputs: specialistExecutions,
      instructions: 'Independently review the specialist outputs against the supplied evidence and professional standards. Reject unsupported, overconfident, unsafe, or materially incomplete interpretation.',
    });
    reviewExecutions.push(validateExecutionResult(raw, reviewerId, 'reviewer'));
  }

  const actorIds = new Set();
  for (const execution of [...specialistExecutions, ...reviewExecutions]) {
    if (actorIds.has(execution.actorId)) throw new Error(`NON_INDEPENDENT_EXECUTION:${execution.actorId}`);
    actorIds.add(execution.actorId);
  }

  return {
    schemaVersion: '1.0',
    caseId: caseInput.caseId || null,
    route,
    specialistExecutions,
    reviewExecutions,
    externalActionsPerformed: 0,
    spendCents: Number(options.spendCents || 0),
    status: 'EXECUTED_PENDING_PROFESSIONAL_SCORING',
  };
}

module.exports = {
  requireProvider,
  validateExecutionResult,
  executeSpecialistCase,
};
