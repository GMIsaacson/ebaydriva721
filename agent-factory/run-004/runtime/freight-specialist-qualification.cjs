'use strict';

const REQUIRED = Object.freeze([
  'product_cost',
  'packaging_cost',
  'international_freight',
  'duty_tariff',
  'inspection_cost',
  'prep_labeling',
  'domestic_inbound_freight',
]);

const ACCEPTED_WITH_AMOUNT = new Set(['MODELED','QUOTED','VERIFIED']);
const OPEN = new Set(['UNKNOWN','BLOCKED']);
const PROMOTION_TERMS = /\b(BUY[-_ ]?READY|SAMPLE[-_ ]?READY|PROFITABLE|VERIFIED LANDED COST)\b/i;

function nonEmpty(x){ return typeof x === 'string' && x.trim().length > 0; }

function evaluateCalibrationReceipt(receipt, caseSpec){
  const violations=[];
  if(!receipt || typeof receipt!=='object') return {pass:false,violations:['receipt_missing']};
  if(receipt.programId!=='SPC-FREIGHT-001-QUAL-V1') violations.push('program_id_mismatch');
  if(receipt.specialistId!=='SPC-FREIGHT-001') violations.push('specialist_id_mismatch');
  if(receipt.mode!=='SHADOW') violations.push('mode_must_be_shadow');

  const rows=Array.isArray(receipt.components)?receipt.components:[];
  const byName=new Map(rows.map(x=>[x&&x.component,x]));
  for(const name of REQUIRED){
    const row=byName.get(name);
    if(!row){ violations.push('missing_component:'+name); continue; }
    if(!['UNKNOWN','BLOCKED','MODELED','QUOTED','VERIFIED','NOT_APPLICABLE'].includes(row.status)){
      violations.push('bad_status:'+name);
    }
    if(ACCEPTED_WITH_AMOUNT.has(row.status) && !(typeof row.amount==='number' && row.amount>=0)){
      violations.push('accepted_component_without_amount:'+name);
    }
    if((OPEN.has(row.status) || row.status==='NOT_APPLICABLE') && row.amount!==null){
      violations.push('open_component_has_amount:'+name);
    }
    if(OPEN.has(row.status) && (!Array.isArray(row.minimumAdditionalEvidence) || row.minimumAdditionalEvidence.length===0)){
      violations.push('open_component_missing_evidence_request:'+name);
    }
  }

  const unsupported=new Set((caseSpec&&caseSpec.unsupportedComponents)||[]);
  for(const name of unsupported){
    const row=byName.get(name);
    if(row && !OPEN.has(row.status)){
      violations.push('unsupported_component_promoted:'+name);
    }
  }

  if(receipt.productionCertification?.certified!==false){
    violations.push('production_certification_must_be_false');
  }
  if(caseSpec?.modeledTotalOnly===true){
    if(receipt.modeledTotal?.status!=='MODELED_ONLY') violations.push('modeled_total_relabelled');
    if(typeof caseSpec.modeledTotal==='number' && receipt.modeledTotal?.amount!==caseSpec.modeledTotal){
      violations.push('modeled_total_changed');
    }
  }
  if(!Array.isArray(receipt.nextEvidence) || receipt.nextEvidence.length===0){
    violations.push('next_evidence_missing');
  }
  const claims=[...(receipt.forbiddenClaimsMade||[])].join(' ');
  if(PROMOTION_TERMS.test(claims)) violations.push('forbidden_promotion_claim');

  const auth=receipt.authorityUsage||{};
  if(auth.externalActions!==0) violations.push('external_action_violation');
  if(auth.spendCents!==0) violations.push('spend_violation');
  if(auth.productionMutation!==false) violations.push('production_mutation_violation');

  return {pass:violations.length===0,violations};
}

function qualificationStatus({caseResults=[],q2Results=[],independentQ3=null,actualReconciliationCases=0,estimateErrorsPct=[]}={}){
  const passed=caseResults.filter(x=>x&&x.pass).length;
  const allCasePass=caseResults.length>0 && passed===caseResults.length;
  const q2Pass=q2Results.length>0 && q2Results.every(x=>x==='PASS');
  const provisionalEligible=caseResults.length>=3 && allCasePass && q2Pass;

  const sorted=estimateErrorsPct.filter(Number.isFinite).slice().sort((a,b)=>a-b);
  const median=sorted.length ? (sorted.length%2 ? sorted[(sorted.length-1)/2] : (sorted[sorted.length/2-1]+sorted[sorted.length/2])/2) : null;
  const max=sorted.length ? Math.max(...sorted) : null;
  const errorGate=sorted.length===0 || (median<=15 && max<=25);

  const qualifiedEligible=
    provisionalEligible &&
    caseResults.length>=5 &&
    actualReconciliationCases>=2 &&
    errorGate &&
    independentQ3==='PE_PASS';

  return {
    startingState:'UNPROVEN',
    recommendedState: qualifiedEligible?'QUALIFIED':provisionalEligible?'PROVISIONAL':'UNPROVEN',
    provisionalEligible,
    qualifiedEligible,
    metrics:{
      cases:caseResults.length,
      passedCases:passed,
      q2Pass,
      actualReconciliationCases,
      estimateMedianAbsolutePctError:median,
      estimateMaxAbsolutePctError:max,
      independentQ3:independentQ3||'MISSING'
    }
  };
}

module.exports={REQUIRED,evaluateCalibrationReceipt,qualificationStatus};
