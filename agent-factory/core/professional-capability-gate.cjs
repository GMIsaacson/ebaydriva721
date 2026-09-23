'use strict';

const PROFESSIONAL_GATE_VERSION = '1.0.0';
const GATE_ID = 'G2.5';
const VALID_QA_TYPES = new Set(['professional_excellence', 'dual']);
const VALID_DISPOSITIONS = new Set(['PASS', 'ACCEPTED_LIMITATION']);

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => String(item || '').trim()).filter(Boolean))];
}

function normalizeStage(stage, index) {
  if (!stage || typeof stage !== 'object' || Array.isArray(stage)) {
    throw new Error(`professionalCapabilities[${index}] must be an object`);
  }
  const stageId = String(stage.stageId || stage.id || '').trim();
  const workProduct = String(stage.workProduct || stage.output || '').trim();
  if (!stageId) throw new Error(`professionalCapabilities[${index}].stageId is required`);
  if (!workProduct) throw new Error(`professionalCapabilities[${index}].workProduct is required`);

  return {
    stageId,
    workProduct,
    material: stage.material !== false,
    requiredDisciplines: normalizeStringArray(stage.requiredDisciplines),
    assignedSpecialists: normalizeStringArray(stage.assignedSpecialists),
    evidenceStandards: normalizeStringArray(stage.evidenceStandards),
    qa: stage.qa && typeof stage.qa === 'object' ? {
      type: String(stage.qa.type || '').trim(),
      disciplines: normalizeStringArray(stage.qa.disciplines),
      acceptanceCriteria: normalizeStringArray(stage.qa.acceptanceCriteria),
      independent: stage.qa.independent === true,
    } : null,
    limitation: stage.limitation && typeof stage.limitation === 'object' ? {
      disposition: String(stage.limitation.disposition || '').trim().toUpperCase(),
      owner: String(stage.limitation.owner || '').trim(),
      rationale: String(stage.limitation.rationale || '').trim(),
    } : null,
  };
}

function stageDefects(stage) {
  if (!stage.material) return [];
  const defects = [];

  if (stage.requiredDisciplines.length === 0) defects.push('NO_REQUIRED_DISCIPLINES');
  if (stage.assignedSpecialists.length === 0) defects.push('NO_ASSIGNED_SPECIALISTS');
  if (stage.evidenceStandards.length === 0) defects.push('NO_EVIDENCE_STANDARDS');

  const missingSpecialistCoverage = stage.requiredDisciplines.filter(
    (discipline) => !stage.assignedSpecialists.includes(discipline),
  );
  if (missingSpecialistCoverage.length) {
    defects.push(`MISSING_SPECIALIST_COVERAGE:${missingSpecialistCoverage.join('|')}`);
  }

  if (!stage.qa) {
    defects.push('NO_DOMAIN_QA');
  } else {
    if (!VALID_QA_TYPES.has(stage.qa.type)) defects.push('QA_NOT_PROFESSIONAL_EXCELLENCE');
    if (!stage.qa.independent) defects.push('QA_NOT_INDEPENDENT');
    if (stage.qa.disciplines.length === 0) defects.push('QA_DISCIPLINE_UNSPECIFIED');
    if (stage.qa.acceptanceCriteria.length === 0) defects.push('QA_ACCEPTANCE_CRITERIA_MISSING');
    const missingQaCoverage = stage.requiredDisciplines.filter(
      (discipline) => !stage.qa.disciplines.includes(discipline),
    );
    if (missingQaCoverage.length) {
      defects.push(`QA_DISCIPLINE_GAP:${missingQaCoverage.join('|')}`);
    }
  }

  return defects;
}

function limitationAccepted(stage) {
  const limitation = stage.limitation;
  return Boolean(
    limitation &&
    VALID_DISPOSITIONS.has(limitation.disposition) &&
    limitation.disposition === 'ACCEPTED_LIMITATION' &&
    nonEmpty(limitation.owner) &&
    nonEmpty(limitation.rationale)
  );
}

function evaluateProfessionalCapabilityMatrix(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('professional capability gate input must be an object');
  }
  if (!Array.isArray(input.professionalCapabilities) || input.professionalCapabilities.length === 0) {
    return {
      gateId: GATE_ID,
      gateVersion: PROFESSIONAL_GATE_VERSION,
      status: 'BLOCKED',
      reason: 'PROFESSIONAL_CAPABILITY_MATRIX_MISSING',
      materialStageCount: 0,
      passedStageCount: 0,
      acceptedLimitationCount: 0,
      blockedStageCount: 0,
      stages: [],
    };
  }

  const stages = input.professionalCapabilities.map(normalizeStage);
  const seen = new Set();
  for (const stage of stages) {
    if (seen.has(stage.stageId)) throw new Error(`duplicate professional stageId: ${stage.stageId}`);
    seen.add(stage.stageId);
  }

  const results = stages.map((stage) => {
    const defects = stageDefects(stage);
    const accepted = defects.length > 0 && limitationAccepted(stage);
    return {
      stageId: stage.stageId,
      workProduct: stage.workProduct,
      material: stage.material,
      requiredDisciplines: stage.requiredDisciplines,
      assignedSpecialists: stage.assignedSpecialists,
      defects,
      disposition: !stage.material || defects.length === 0 ? 'PASS' : accepted ? 'ACCEPTED_LIMITATION' : 'BLOCKED',
    };
  });

  const material = results.filter((stage) => stage.material);
  const blocked = material.filter((stage) => stage.disposition === 'BLOCKED');
  const accepted = material.filter((stage) => stage.disposition === 'ACCEPTED_LIMITATION');
  const passed = material.filter((stage) => stage.disposition === 'PASS');

  return {
    gateId: GATE_ID,
    gateVersion: PROFESSIONAL_GATE_VERSION,
    status: blocked.length === 0 ? 'PASS' : 'BLOCKED',
    reason: blocked.length === 0 ? 'PROFESSIONAL_CAPABILITY_COMPLETE_OR_ACCEPTED' : 'UNRESOLVED_SPECIALIST_GAPS',
    materialStageCount: material.length,
    passedStageCount: passed.length,
    acceptedLimitationCount: accepted.length,
    blockedStageCount: blocked.length,
    stages: results,
  };
}

function assertProfessionalCapabilityComplete(input) {
  const result = evaluateProfessionalCapabilityMatrix(input);
  if (result.status !== 'PASS') {
    const blocked = result.stages.filter((stage) => stage.disposition === 'BLOCKED').map((stage) => stage.stageId);
    const suffix = blocked.length ? `: ${blocked.join(', ')}` : '';
    throw new Error(`G2.5 Professional Capability Completeness BLOCKED${suffix}`);
  }
  return result;
}

module.exports = {
  PROFESSIONAL_GATE_VERSION,
  GATE_ID,
  evaluateProfessionalCapabilityMatrix,
  assertProfessionalCapabilityComplete,
};
