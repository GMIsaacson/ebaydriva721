'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
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


test('recorded five-case IP portfolio passes guard and corrected Q2',()=>{
  const calibrationDir=path.join(__dirname,'..','calibration');
  const entries=[
    ['ip-policy-calibration-ebay-generic-001.receipt.json','IP_PASS','ebay'],
    ['ip-policy-calibration-ebay-compatibility-002.receipt.json','IP_BLOCK','ebay'],
    ['ip-policy-calibration-ebay-authenticity-003.receipt.json','IP_BLOCK','ebay'],
    ['ip-policy-calibration-ebay-content-004.receipt.json','IP_BLOCK','ebay'],
    ['ip-policy-calibration-amazon-compatibility-005.receipt.json','IP_PASS_WITH_LIMITATION','amazon']
  ];
  const results=[]; const q2=[]; const platforms=[];
  for(const [file,expectedOutcome,platform] of entries){
    const r=JSON.parse(fs.readFileSync(path.join(calibrationDir,file),'utf8'));
    const out=evaluateIpCalibrationReceipt(r,{expectedOutcome});
    assert.equal(out.pass,true,file+': '+JSON.stringify(out.violations));
    assert.equal(r.q2.result,'PASS');
    assert.equal(r.caseResult,'PASS');
    results.push({pass:true}); q2.push('PASS'); platforms.push(platform);
  }
  const provisional=qualificationStatus({caseResults:results.slice(0,3),q2Results:q2.slice(0,3),casePlatforms:platforms.slice(0,3)});
  assert.equal(provisional.recommendedState,'PROVISIONAL');
  const qualified=qualificationStatus({caseResults:results,q2Results:q2,casePlatforms:platforms,independentQ3:'PE_PASS'});
  assert.equal(qualified.recommendedState,'QUALIFIED');
  assert.equal(qualified.qualifiedEligible,true);
});

test('reviewer qualification and final portfolio Q3 support QUALIFIED without authority expansion',()=>{
  const calibrationDir=path.join(__dirname,'..','calibration');
  const reviewer=JSON.parse(fs.readFileSync(path.join(calibrationDir,'ip-policy-q3-reviewer-qualification-v1.json'),'utf8'));
  assert.equal(reviewer.qualificationResult,'QUALIFIED');
  assert.equal(reviewer.calibrationCases.length,3);
  for(const x of reviewer.calibrationCases){
    assert.equal(x.result,'PASS');
    assert.equal(x.actualOutcome,x.goldOutcome);
  }
  assert.equal(reviewer.aggregateQ2.result,'PASS');

  const finalQ3=JSON.parse(fs.readFileSync(path.join(calibrationDir,'ip-policy-q3-final-portfolio.receipt.json'),'utf8'));
  assert.equal(finalQ3.professionalOutcome,'PE_PASS');
  assert.equal(finalQ3.promotionRecommendation,'QUALIFIED');
  assert.equal(finalQ3.q2Audit.qualificationQ2,'PASS');
  assert.equal(finalQ3.q2Audit.promotionEvidenceStatus,'COMPLETE');
  assert.equal(finalQ3.authorityUsage.externalActions,0);
  assert.equal(finalQ3.authorityUsage.spendCents,0);
  assert.equal(finalQ3.authorityUsage.productionMutation,false);

  const program=JSON.parse(fs.readFileSync(path.join(calibrationDir,'ip-policy-specialist-qualification-v1.json'),'utf8'));
  assert.equal(program.qualificationResult,'QUALIFIED');
  assert.equal(program.progress.currentRecommendedState,'QUALIFIED');
  assert.equal(program.progress.passingCases,5);
  assert.equal(program.progress.q2PassingCases,5);
  assert.equal(program.progress.independentQ3,'PE_PASS');

  const registry=JSON.parse(fs.readFileSync(path.join(__dirname,'..','..','governance','specialist-registry-v1.0.json'),'utf8'));
  const author=registry.records.find(x=>x.specialistId==='SPC-IP-001');
  const q3=registry.records.find(x=>x.specialistId==='SPC-IP-Q3-001');
  assert.equal(author.qualificationState,'QUALIFIED');
  assert.equal(author.eligibleAsReviewer,false);
  assert.ok(author.allowedTaskClasses.includes('marketplace-policy-ip-professional-certification'));
  for(const x of ['independent-review','legal-opinion','platform-account-action','production-mutation','publication','purchase']){
    assert.ok(author.excludedTaskClasses.includes(x),'missing author exclusion '+x);
  }
  assert.equal(q3.qualificationState,'QUALIFIED');
  assert.equal(q3.eligibleAsReviewer,true);
  assert.ok(q3.allowedTaskClasses.includes('Q3-marketplace-policy-ip-review'));
  for(const x of ['policy-ip-authoring','self-review','legal-opinion','production-mutation']){
    assert.ok(q3.excludedTaskClasses.includes(x),'missing reviewer exclusion '+x);
  }
});
