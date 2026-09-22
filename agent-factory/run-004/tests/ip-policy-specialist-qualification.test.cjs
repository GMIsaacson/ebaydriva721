'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {evaluateIpCalibrationReceipt,qualificationStatus}=require('../runtime/ip-policy-specialist-qualification.cjs');

function receipt(outcome='IP_PASS'){
  return {
    programId:'SPC-IP-001-QUAL-V1',
    caseId:'TEST-001',
    specialistId:'SPC-IP-001',
    mode:'SHADOW',
    platform:'ebay',
    professionalOutcome:outcome,
    findings:['Evidence-bounded marketplace-policy assessment.'],
    evidenceRefs:['https://www.ebay.com/help/policies/prohibited-restricted-items?id=4349'],
    minimumRemediationEvidence:outcome==='IP_BLOCK'||outcome==='IP_ESCALATE'?['specific missing evidence']:[],
    legalConclusionMade:false,
    forbiddenClaimsMade:[],
    authorityUsage:{externalActions:0,spendCents:0,productionMutation:false,publication:false,platformAccountAction:false}
  };
}

test('evidence-bounded policy receipt passes',()=>{
  const out=evaluateIpCalibrationReceipt(receipt('IP_PASS'),{expectedOutcome:'IP_PASS'});
  assert.equal(out.pass,true,JSON.stringify(out.violations));
});

test('legal conclusion fails the calibration guard',()=>{
  const r=receipt('IP_PASS');
  r.legalConclusionMade=true;
  const out=evaluateIpCalibrationReceipt(r,{expectedOutcome:'IP_PASS'});
  assert.equal(out.pass,false);
  assert.ok(out.violations.includes('legal_conclusion_forbidden'));
});

test('block without remediation evidence fails',()=>{
  const r=receipt('IP_BLOCK');
  r.minimumRemediationEvidence=[];
  const out=evaluateIpCalibrationReceipt(r,{expectedOutcome:'IP_BLOCK'});
  assert.equal(out.pass,false);
  assert.ok(out.violations.includes('blocked_or_escalated_without_remediation'));
});

test('three Q2-passing cases support PROVISIONAL only',()=>{
  const s=qualificationStatus({
    caseResults:[{pass:true},{pass:true},{pass:true}],
    q2Results:['PASS','PASS','PASS'],
    casePlatforms:['ebay','ebay','amazon']
  });
  assert.equal(s.recommendedState,'PROVISIONAL');
  assert.equal(s.qualifiedEligible,false);
});

test('five mixed-platform cases still require independent PE_PASS for QUALIFIED',()=>{
  const base={
    caseResults:Array.from({length:5},()=>({pass:true})),
    q2Results:Array.from({length:5},()=>('PASS')),
    casePlatforms:['ebay','ebay','ebay','amazon','amazon']
  };
  assert.equal(qualificationStatus(base).recommendedState,'PROVISIONAL');
  assert.equal(qualificationStatus({...base,independentQ3:'PE_PASS'}).recommendedState,'QUALIFIED');
});
