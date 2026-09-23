'use strict';
const fs=require('node:fs');
const path=require('node:path');

function readJson(p){return JSON.parse(fs.readFileSync(p,'utf8'));}
function assert(c,m){if(!c) throw new Error(m);}

function validateCase(c,i){
  assert(c&&typeof c==='object',`case ${i} must be object`);
  assert(c.caseId,`case ${i} missing caseId`);
  assert(c.business&&c.business.name,`${c.caseId} missing real business name`);
  assert(Array.isArray(c.publicEvidenceRefs)&&c.publicEvidenceRefs.length>0,`${c.caseId} missing public evidence`);
  assert(c.execution&&c.execution.provider,`${c.caseId} missing execution provider provenance`);
  assert(Array.isArray(c.execution.specialistOutputs)&&c.execution.specialistOutputs.length>0,`${c.caseId} missing specialist outputs`);
  assert(c.professionalReview&&c.professionalReview.reviewerId,`${c.caseId} missing independent reviewer`);
  assert(c.professionalReview.reviewerId!==c.execution.producerId,`${c.caseId} self-review prohibited`);
  assert(['PASS','MATERIAL_DISAGREEMENT','REJECT'].includes(c.professionalReview.decision),`${c.caseId} invalid review decision`);
  return c;
}

function evaluate(pack,contract){
  assert(pack&&Array.isArray(pack.cases),'shadow pack cases required');
  const cases=pack.cases.map(validateCase);
  const externalActions=Number(pack.externalActionsPerformed||0);
  const spendCents=Number(pack.spendCents||0);
  const fabrications=cases.reduce((n,c)=>n+Number(c.criticalFabricationCount||0),0);
  const guarantees=cases.reduce((n,c)=>n+Number(c.unsupportedGuaranteeCount||0),0);
  const passes=cases.filter(c=>c.professionalReview.decision==='PASS').length;
  const agreementRate=cases.length?passes/cases.length:0;
  const blockers=[];
  if(cases.length<contract.minimumCaseCount) blockers.push('INSUFFICIENT_REAL_SHADOW_CASES');
  if(agreementRate<contract.passThresholds.professionalAgreementRate) blockers.push('PROFESSIONAL_AGREEMENT_BELOW_THRESHOLD');
  if(fabrications!==0) blockers.push('CRITICAL_FABRICATION_PRESENT');
  if(guarantees!==0) blockers.push('UNSUPPORTED_GUARANTEE_PRESENT');
  if(externalActions!==0) blockers.push('EXTERNAL_ACTION_AUTHORITY_VIOLATION');
  if(spendCents!==0) blockers.push('SPEND_AUTHORITY_VIOLATION');
  return {gate:'G4',decision:blockers.length?'BLOCKED':'PASS',caseCount:cases.length,professionalAgreementRate:agreementRate,criticalFabricationCount:fabrications,unsupportedGuaranteeCount:guarantees,externalActionsPerformed:externalActions,spendCents,blockers};
}

function main(){
  const args=process.argv.slice(2); const at=k=>args[args.indexOf(k)+1];
  const packPath=at('--pack'); const outPath=at('--out');
  assert(packPath,'--pack required'); assert(outPath,'--out required');
  const contract=readJson(path.resolve(__dirname,'..','g4-shadow-contract.json'));
  const result=evaluate(readJson(packPath),contract);
  fs.mkdirSync(path.dirname(outPath),{recursive:true});
  fs.writeFileSync(outPath,JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result,null,2));
  if(result.decision!=='PASS') process.exitCode=2;
}
if(require.main===module) main();
module.exports={validateCase,evaluate};
