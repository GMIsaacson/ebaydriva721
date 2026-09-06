'use strict';

const CRITICALITIES = Object.freeze(['advisory', 'material', 'gating']);
const QUALIFICATION_STATES = Object.freeze(['QUALIFIED', 'PROVISIONAL', 'UNPROVEN', 'SUSPENDED']);
const PROFESSIONAL_STATES = Object.freeze(['READY', 'CONDITIONAL', 'BLOCKED']);
const PE_RESULTS = Object.freeze(['PE_PASS', 'PE_PASS_WITH_LIMITATION', 'PE_RETURN', 'PE_ESCALATE', 'PE_FAIL']);

function nonEmpty(value) { return typeof value === 'string' && value.trim().length > 0; }
function array(value) { return Array.isArray(value) ? value : []; }

function validateSpecialistRegistry(registry) {
  if (!Array.isArray(registry) || registry.length === 0) throw new Error('specialist registry must be a non-empty array');
  const ids = new Set();
  for (const [index, record] of registry.entries()) {
    if (!record || typeof record !== 'object') throw new Error(`registry[${index}] must be an object`);
    for (const field of ['specialistId', 'discipline', 'subdiscipline', 'qualificationState']) {
      if (!nonEmpty(record[field])) throw new Error(`registry[${index}].${field} is required`);
    }
    if (ids.has(record.specialistId)) throw new Error(`duplicate specialistId: ${record.specialistId}`);
    ids.add(record.specialistId);
    if (!QUALIFICATION_STATES.includes(record.qualificationState)) throw new Error(`invalid qualificationState for ${record.specialistId}`);
    if (!Array.isArray(record.allowedTaskClasses)) throw new Error(`allowedTaskClasses required for ${record.specialistId}`);
    if (!Array.isArray(record.excludedTaskClasses)) throw new Error(`excludedTaskClasses required for ${record.specialistId}`);
  }
  return registry;
}

function validatePCM(pcm, registry = null) {
  if (!pcm || typeof pcm !== 'object') throw new Error('professionalCapabilityManifest is required');
  for (const field of ['jobId', 'deliverableType', 'businessOutcome']) {
    if (!nonEmpty(pcm[field])) throw new Error(`professionalCapabilityManifest.${field} is required`);
  }
  if (!Array.isArray(pcm.materialDecisions) || pcm.materialDecisions.length === 0) throw new Error('professionalCapabilityManifest.materialDecisions must be non-empty');
  if (!Array.isArray(pcm.requiredDisciplines) || pcm.requiredDisciplines.length === 0) throw new Error('professionalCapabilityManifest.requiredDisciplines must be non-empty');
  if (registry) validateSpecialistRegistry(registry);
  const registryById = new Map(array(registry).map((x) => [x.specialistId, x]));
  const seen = new Set();
  for (const [index, requirement] of pcm.requiredDisciplines.entries()) {
    if (!requirement || typeof requirement !== 'object') throw new Error(`requiredDisciplines[${index}] must be an object`);
    for (const field of ['discipline', 'criticality', 'scopeBoundary', 'evidenceStandard', 'professionalAcceptanceStandard']) {
      if (!nonEmpty(requirement[field])) throw new Error(`requiredDisciplines[${index}].${field} is required`);
    }
    if (!CRITICALITIES.includes(requirement.criticality)) throw new Error(`requiredDisciplines[${index}].criticality invalid`);
    const key = `${requirement.discipline}::${requirement.subdiscipline || ''}`;
    if (seen.has(key)) throw new Error(`duplicate professional discipline requirement: ${key}`);
    seen.add(key);
    if (requirement.assignedSpecialistId && registry) {
      const specialist = registryById.get(requirement.assignedSpecialistId);
      if (!specialist) throw new Error(`unknown assignedSpecialistId: ${requirement.assignedSpecialistId}`);
      if (specialist.discipline !== requirement.discipline) throw new Error(`specialist discipline mismatch: ${requirement.assignedSpecialistId}`);
    }
  }
  return pcm;
}

function evaluateProfessionalReadiness(pcm, registry) {
  validatePCM(pcm, registry);
  const registryById = new Map(registry.map((x) => [x.specialistId, x]));
  const unfilled = [];
  const provisional = [];
  const conflicts = [];

  for (const requirement of pcm.requiredDisciplines) {
    const specialist = requirement.assignedSpecialistId ? registryById.get(requirement.assignedSpecialistId) : null;
    if (!specialist || specialist.qualificationState === 'UNPROVEN' || specialist.qualificationState === 'SUSPENDED') {
      unfilled.push({ discipline: requirement.discipline, subdiscipline: requirement.subdiscipline || null, criticality: requirement.criticality, assignedSpecialistId: requirement.assignedSpecialistId || null });
      continue;
    }
    if (specialist.qualificationState === 'PROVISIONAL') provisional.push({ discipline: requirement.discipline, specialistId: specialist.specialistId, criticality: requirement.criticality });
    if (requirement.independentReviewerId && requirement.independentReviewerId === requirement.assignedSpecialistId) conflicts.push({ discipline: requirement.discipline, reason: 'reviewer-self-review' });
    if (requirement.independentReviewerId) {
      const reviewer = registryById.get(requirement.independentReviewerId);
      if (!reviewer || reviewer.qualificationState !== 'QUALIFIED' || reviewer.eligibleAsReviewer !== true) conflicts.push({ discipline: requirement.discipline, reason: 'reviewer-not-qualified-or-ineligible' });
    } else if (requirement.criticality !== 'advisory') {
      conflicts.push({ discipline: requirement.discipline, reason: 'missing-independent-reviewer' });
    }
  }

  const gatingMissing = unfilled.some((x) => x.criticality === 'gating');
  const materialMissing = unfilled.some((x) => x.criticality === 'material');
  const gatingProvisional = provisional.some((x) => x.criticality === 'gating');
  let professionalReadiness = 'READY';
  if (gatingMissing || conflicts.length || gatingProvisional) professionalReadiness = 'BLOCKED';
  else if (materialMissing || provisional.length) professionalReadiness = 'CONDITIONAL';

  return { professionalReadiness, unfilledCapabilities: unfilled, provisionalCapabilities: provisional, independenceDefects: conflicts };
}

function validateProfessionalReview(review, pcm) {
  if (!review || typeof review !== 'object') throw new Error('professionalReview is required');
  if (!PE_RESULTS.includes(review.result)) throw new Error('professionalReview.result invalid');
  if (!nonEmpty(review.reviewerId)) throw new Error('professionalReview.reviewerId is required');
  if (!Array.isArray(review.disciplinesReviewed) || review.disciplinesReviewed.length === 0) throw new Error('professionalReview.disciplinesReviewed must be non-empty');
  const required = new Set(pcm.requiredDisciplines.filter((x) => x.criticality !== 'advisory').map((x) => x.discipline));
  const reviewed = new Set(review.disciplinesReviewed);
  const missing = [...required].filter((x) => !reviewed.has(x));
  if (missing.length) throw new Error(`professionalReview missing material disciplines: ${missing.join(', ')}`);
  return review;
}

function completionAttestation({ operationalReady, evidenceReady, pcm, registry, professionalReview, acceptedLimitations = [] }) {
  const readiness = evaluateProfessionalReadiness(pcm, registry);
  let professionalPass = false;
  if (readiness.professionalReadiness === 'READY') {
    validateProfessionalReview(professionalReview, pcm);
    professionalPass = professionalReview.result === 'PE_PASS' || professionalReview.result === 'PE_PASS_WITH_LIMITATION';
  } else if (readiness.professionalReadiness === 'CONDITIONAL' && acceptedLimitations.length > 0) {
    validateProfessionalReview(professionalReview, pcm);
    professionalPass = professionalReview.result === 'PE_PASS_WITH_LIMITATION';
  }
  const ready = operationalReady === true && evidenceReady === true && professionalPass === true;
  return {
    operationalReadiness: operationalReady === true ? 'READY' : 'BLOCKED',
    evidenceReadiness: evidenceReady === true ? 'READY' : 'BLOCKED',
    professionalReadiness: readiness.professionalReadiness,
    overallReadiness: ready ? 'READY' : 'BLOCKED',
    acceptedLimitations,
    ...readiness,
  };
}

module.exports = {
  CRITICALITIES,
  QUALIFICATION_STATES,
  PROFESSIONAL_STATES,
  PE_RESULTS,
  validateSpecialistRegistry,
  validatePCM,
  evaluateProfessionalReadiness,
  validateProfessionalReview,
  completionAttestation,
};
