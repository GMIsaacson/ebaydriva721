'use strict';

const {
  evaluateProfessionalReadiness,
  validatePCM,
} = require('../../core/professional-capability.cjs');

const CATEGORY_RISK_FLAGS = Object.freeze([
  'compatibilityClaim',
  'fitmentClaim',
  'vehicleFitment',
  'electricalOrElectronicFunction',
  'safetyCritical',
  'regulatedProduct',
  'medicalOrHealthClaim',
  'materialPerformanceClaim',
  'chemicalCompositionClaim',
  'loadBearingOrStructuralClaim',
  'brandedEquivalenceClaim',
  'patentOrDesignRisk',
  'installationOrModificationRequired',
]);

const POLICY_ESCALATION_FLAGS = Object.freeze([
  'legalOpinionRequired',
  'activeIpComplaint',
  'rightsOwnerAuthorizationAmbiguous',
  'authenticityEvidenceInsufficient',
  'restrictedProductApprovalUnknown',
]);

function bool(value){ return value === true; }
function nonEmpty(value){ return typeof value === 'string' && value.trim().length > 0; }

function categoryRisk(candidate = {}){
  const triggered = CATEGORY_RISK_FLAGS.filter((key) => bool(candidate[key]));
  const explicitLowRisk =
    candidate.genericCommodity === true &&
    candidate.simpleSpecification === true &&
    triggered.length === 0;

  // Fail closed: absence of explicit low-risk facts is not evidence of simplicity.
  return {
    required: !explicitLowRisk,
    explicitLowRisk,
    triggered,
    reason: explicitLowRisk
      ? 'Explicit generic/simple candidate with no material category-risk flags.'
      : triggered.length
        ? `Material product/category judgment required: ${triggered.join(', ')}.`
        : 'Category complexity not explicitly established as low risk; specialist binding required.',
  };
}

function policyEscalations(candidate = {}){
  return POLICY_ESCALATION_FLAGS.filter((key) => bool(candidate[key]));
}

function requirement({
  discipline,
  subdiscipline,
  criticality='gating',
  scopeBoundary,
  evidenceStandard,
  professionalAcceptanceStandard,
  assignedSpecialistId,
  independentReviewerId,
}){
  return {
    discipline,
    subdiscipline,
    criticality,
    scopeBoundary,
    evidenceStandard,
    professionalAcceptanceStandard,
    ...(assignedSpecialistId ? {assignedSpecialistId} : {}),
    ...(independentReviewerId ? {independentReviewerId} : {}),
  };
}

function buildSourceMarginPCM(candidate = {}){
  if(!nonEmpty(candidate.candidateId)) throw new Error('candidateId is required');
  if(!nonEmpty(candidate.marketplace)) throw new Error('marketplace is required');
  if(!nonEmpty(candidate.businessOutcome)) throw new Error('businessOutcome is required');

  const category = categoryRisk(candidate);
  const requiredDisciplines = [];

  // Always gate public/customer readiness on Marketplace Policy/IP.
  requiredDisciplines.push(requirement({
    discipline:'Marketplace Policy/IP',
    subdiscipline:'IP/Marketplace Risk',
    scopeBoundary:'Marketplace policy, authenticity/provenance, trademark/copyright/listing-content and platform IP-risk screening only; no legal opinion.',
    evidenceStandard:'Current first-party marketplace policy where available plus candidate-specific listing/provenance evidence. Unknown platform or rights-owner facts remain blocked/escalated.',
    professionalAcceptanceStandard:'No unsupported policy-safe claim; counterfeit/authenticity/content-rights/brand-use risks are explicit; legal uncertainty is escalated rather than decided.',
    assignedSpecialistId:'SPC-IP-001',
    independentReviewerId:'SPC-IP-Q3-001',
  }));

  if(candidate.crossBorderImport === true || candidate.landedCostCertificationRequired === true){
    requiredDisciplines.push(requirement({
      discipline:'Logistics',
      subdiscipline:'Freight/Import/Landed Cost',
      scopeBoundary:'Freight/import/landed-cost professional judgment only; customs legal and tax opinions excluded.',
      evidenceStandard:'Evidence-complete landed-cost components, Incoterm/route/weight/classification/origin evidence as material.',
      professionalAcceptanceStandard:'No invented freight/duty values; quote/model/final-charge states separated; evidence-complete certification only.',
      assignedSpecialistId:'SPC-FREIGHT-001',
      independentReviewerId:'SPC-FREIGHT-Q3-001',
    }));
  }

  if(category.required){
    requiredDisciplines.push(requirement({
      discipline:'Product/Category Specification',
      subdiscipline: nonEmpty(candidate.categorySubdiscipline) ? candidate.categorySubdiscipline : 'Job-specific product/category judgment',
      scopeBoundary:'Technical equivalence, fitment, compatibility, material/performance, safety or category-specific claims only. No generic universal category certification.',
      evidenceStandard:'Manufacturer/supplier specifications and authoritative category evidence sufficient for every material equivalence or compatibility claim.',
      professionalAcceptanceStandard:'Every material product/category claim is supported; incompatible or ambiguous equivalence remains blocked.',
      assignedSpecialistId: nonEmpty(candidate.categorySpecialistId) ? candidate.categorySpecialistId : undefined,
      independentReviewerId: nonEmpty(candidate.categoryReviewerId) ? candidate.categoryReviewerId : undefined,
    }));
  }

  const pcm={
    jobId:`SM-${candidate.candidateId}`,
    deliverableType:'SourceMargin candidate professional-readiness manifest',
    businessOutcome:candidate.businessOutcome,
    materialDecisions:[
      'Whether candidate may advance beyond research/sample-worthy state toward customer/publication readiness.',
      'Whether Marketplace Policy/IP risk is sufficiently bounded.',
      ...(category.required ? ['Whether product/category equivalence or compatibility is professionally supported.'] : []),
      ...((candidate.crossBorderImport || candidate.landedCostCertificationRequired) ? ['Whether landed-cost professional certification is supportable.'] : []),
    ],
    requiredDisciplines,
  };

  return {
    pcm,
    categoryGate:category,
    policyEscalations:policyEscalations(candidate),
  };
}

function routeSourceMarginCandidate(candidate, registry){
  const built=buildSourceMarginPCM(candidate);
  validatePCM(built.pcm, registry);
  const assessment=evaluateProfessionalReadiness(built.pcm, registry);

  const blockers=[];
  if(built.policyEscalations.length){
    blockers.push({
      type:'POLICY_ESCALATION',
      flags:built.policyEscalations,
      reason:'Policy/IP ambiguity requires additional platform/rights-owner evidence or appropriate legal escalation; the specialist may not decide legal rights.',
    });
  }
  if(built.categoryGate.required && !candidate.categorySpecialistId){
    blockers.push({
      type:'CATEGORY_SPECIALIST_UNBOUND',
      reason:built.categoryGate.reason,
    });
  }
  if(built.categoryGate.required && candidate.categorySpecialistId && !candidate.categoryReviewerId){
    blockers.push({
      type:'CATEGORY_REVIEWER_UNBOUND',
      reason:'Material product/category judgment requires independent qualified review.',
    });
  }

  for(const x of assessment.unfilledCapabilities){
    blockers.push({type:'UNFILLED_PROFESSIONAL_CAPABILITY',...x});
  }
  for(const x of assessment.independenceDefects){
    blockers.push({type:'INDEPENDENCE_DEFECT',...x});
  }

  let readiness=assessment.professionalReadiness;
  if(blockers.length) readiness='BLOCKED';

  return {
    candidateId:candidate.candidateId,
    marketplace:candidate.marketplace,
    readiness,
    publishableProfessionalGate:readiness==='READY',
    categoryGate:built.categoryGate,
    policyEscalations:built.policyEscalations,
    pcm:built.pcm,
    assessment,
    blockers,
    nextAction:
      blockers.length
        ? blockers[0].reason || 'Resolve professional capability blocker.'
        : readiness==='READY'
          ? 'Professional capability gate satisfied; continue to remaining SourceMargin evidence/publication gates.'
          : 'Resolve provisional/material professional limitations.',
  };
}

module.exports={
  CATEGORY_RISK_FLAGS,
  POLICY_ESCALATION_FLAGS,
  categoryRisk,
  policyEscalations,
  buildSourceMarginPCM,
  routeSourceMarginCandidate,
};
