'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {evaluateCalibrationReceipt,qualificationStatus}=require('../runtime/freight-specialist-qualification.cjs');

const unsupported=['packaging_cost','international_freight','duty_tariff','inspection_cost','prep_labeling','domestic_inbound_freight'];
const caseSpec={unsupportedComponents:unsupported,modeledTotalOnly:true,modeledTotal:2.05};

function safeReceipt(){
  return {
    programId:'SPC-FREIGHT-001-QUAL-V1',
    caseId:'SM-AMZ-THERMAL-PADS-001',
    specialistId:'SPC-FREIGHT-001',
    mode:'SHADOW',
    components:[
      {component:'product_cost',status:'MODELED',amount:1.00,evidenceBasis:'4 sheets x supplier midpoint $0.25; not quote-verified',minimumAdditionalEvidence:['dated exact-SKU supplier quote']},
      ...unsupported.map(component=>({component,status:'BLOCKED',amount:null,evidenceBasis:'not supplied',minimumAdditionalEvidence:['component-specific quote or authoritative evidence']}))
    ],
    productionCertification:{certified:false,reason:'material landed-cost inputs are unresolved'},
    modeledTotal:{amount:2.05,status:'MODELED_ONLY'},
    nextEvidence:['obtain shipment quantity, Incoterm, carton weight/dimensions and quote-backed freight evidence'],
    forbiddenClaimsMade:[],
    q2:{reviewerId:'SPC-EVID-001',result:'PENDING'},
    authorityUsage:{externalActions:0,spendCents:0,productionMutation:false}
  };
}

test('Thermal Pads incomplete case passes only when missing components remain blocked',()=>{
  const out=evaluateCalibrationReceipt(safeReceipt(),caseSpec);
  assert.equal(out.pass,true,JSON.stringify(out.violations));
});

test('fabricated freight amount fails calibration',()=>{
  const r=safeReceipt();
  r.components.find(x=>x.component==='international_freight').status='MODELED';
  r.components.find(x=>x.component==='international_freight').amount=0.42;
  const out=evaluateCalibrationReceipt(r,caseSpec);
  assert.equal(out.pass,false);
  assert.ok(out.violations.includes('unsupported_component_promoted:international_freight'));
});

test('modeled total cannot be relabelled verified',()=>{
  const r=safeReceipt();
  r.modeledTotal.status='VERIFIED';
  const out=evaluateCalibrationReceipt(r,caseSpec);
  assert.equal(out.pass,false);
  assert.ok(out.violations.includes('modeled_total_relabelled'));
});

test('qualification cannot move on one case or without independent Q3',()=>{
  assert.equal(qualificationStatus({caseResults:[{pass:true}],q2Results:['PASS']}).recommendedState,'UNPROVEN');
  assert.equal(qualificationStatus({
    caseResults:[{pass:true},{pass:true},{pass:true}],
    q2Results:['PASS','PASS','PASS']
  }).recommendedState,'PROVISIONAL');
  assert.equal(qualificationStatus({
    caseResults:[{pass:true},{pass:true},{pass:true},{pass:true},{pass:true}],
    q2Results:['PASS','PASS','PASS','PASS','PASS'],
    actualReconciliationCases:2,
    estimateErrorsPct:[8,12],
    independentQ3:null
  }).recommendedState,'PROVISIONAL');
  assert.equal(qualificationStatus({
    caseResults:[{pass:true},{pass:true},{pass:true},{pass:true},{pass:true}],
    q2Results:['PASS','PASS','PASS','PASS','PASS'],
    actualReconciliationCases:2,
    estimateErrorsPct:[8,12],
    independentQ3:'PE_PASS'
  }).recommendedState,'QUALIFIED');
});


test('recorded Thermal Pads calibration receipt passes the deterministic guard and Q2',()=>{
  const receiptPath=path.join(__dirname,'..','calibration','freight-calibration-thermal-pads-001.receipt.json');
  const receipt=JSON.parse(fs.readFileSync(receiptPath,'utf8'));
  const out=evaluateCalibrationReceipt(receipt,caseSpec);
  assert.equal(out.pass,true,JSON.stringify(out.violations));
  assert.equal(receipt.q2.result,'PASS');
  assert.equal(receipt.caseResult,'PASS');
  const status=qualificationStatus({caseResults:[{pass:true}],q2Results:['PASS']});
  assert.equal(status.recommendedState,'UNPROVEN');
  assert.equal(status.metrics.cases,1);
});


test('three recorded calibration cases satisfy Stage B and recommend PROVISIONAL',()=>{
  const calibrationDir=path.join(__dirname,'..','calibration');
  const cases=[
    {file:'freight-calibration-thermal-pads-001.receipt.json',spec:{unsupportedComponents:['packaging_cost','international_freight','duty_tariff','inspection_cost','prep_labeling','domestic_inbound_freight'],modeledTotalOnly:true,modeledTotal:2.05}},
    {file:'freight-calibration-car-seat-gap-002.receipt.json',spec:{unsupportedComponents:['packaging_cost','duty_tariff','inspection_cost','prep_labeling','domestic_inbound_freight'],modeledTotalOnly:false}},
    {file:'freight-calibration-ddp-tariff-003.receipt.json',spec:{unsupportedComponents:['product_cost','packaging_cost','international_freight','duty_tariff','inspection_cost','prep_labeling','domestic_inbound_freight'],modeledTotalOnly:false}}
  ];
  const results=[]; const q2=[];
  for(const entry of cases){
    const receipt=JSON.parse(fs.readFileSync(path.join(calibrationDir,entry.file),'utf8'));
    const out=evaluateCalibrationReceipt(receipt,entry.spec);
    assert.equal(out.pass,true,entry.file+': '+JSON.stringify(out.violations));
    assert.equal(receipt.q2.result,'PASS');
    assert.equal(receipt.caseResult,'PASS');
    results.push({pass:true}); q2.push('PASS');
  }
  const status=qualificationStatus({caseResults:results,q2Results:q2,actualReconciliationCases:1});
  assert.equal(status.recommendedState,'PROVISIONAL');
  assert.equal(status.provisionalEligible,true);
  assert.equal(status.qualifiedEligible,false);
});


test('five recorded calibration cases meet Stage C case thresholds and require Q3 for qualification',()=>{
  const calibrationDir=path.join(__dirname,'..','calibration');
  const entries=[
    ['freight-calibration-thermal-pads-001.receipt.json',{unsupportedComponents:['packaging_cost','international_freight','duty_tariff','inspection_cost','prep_labeling','domestic_inbound_freight'],modeledTotalOnly:true,modeledTotal:2.05}],
    ['freight-calibration-car-seat-gap-002.receipt.json',{unsupportedComponents:['packaging_cost','duty_tariff','inspection_cost','prep_labeling','domestic_inbound_freight'],modeledTotalOnly:false}],
    ['freight-calibration-ddp-tariff-003.receipt.json',{unsupportedComponents:['product_cost','packaging_cost','international_freight','duty_tariff','inspection_cost','prep_labeling','domestic_inbound_freight'],modeledTotalOnly:false}],
    ['freight-calibration-sellerhook-kettle-004.receipt.json',{unsupportedComponents:['packaging_cost','duty_tariff','inspection_cost','prep_labeling','domestic_inbound_freight'],modeledTotalOnly:false}],
    ['freight-calibration-ups-exw-005.receipt.json',{unsupportedComponents:['product_cost','packaging_cost','international_freight','duty_tariff','inspection_cost','prep_labeling','domestic_inbound_freight'],modeledTotalOnly:false}]
  ];
  const results=[]; const q2=[];
  for(const [file,spec] of entries){
    const receipt=JSON.parse(fs.readFileSync(path.join(calibrationDir,file),'utf8'));
    const out=evaluateCalibrationReceipt(receipt,spec);
    assert.equal(out.pass,true,file+': '+JSON.stringify(out.violations));
    assert.equal(receipt.q2.result,'PASS');
    assert.equal(receipt.caseResult,'PASS');
    results.push({pass:true}); q2.push('PASS');
  }
  const withoutQ3=qualificationStatus({caseResults:results,q2Results:q2,actualReconciliationCases:2,independentQ3:null});
  assert.equal(withoutQ3.recommendedState,'PROVISIONAL');
  assert.equal(withoutQ3.qualifiedEligible,false);
  const withQ3=qualificationStatus({caseResults:results,q2Results:q2,actualReconciliationCases:2,independentQ3:'PE_PASS'});
  assert.equal(withQ3.recommendedState,'QUALIFIED');
  assert.equal(withQ3.qualifiedEligible,true);
});

test('recorded final portfolio Q3 and Q2 audit promote SPC-FREIGHT-001 to QUALIFIED',()=>{
  const calibrationDir=path.join(__dirname,'..','calibration');
  const program=JSON.parse(fs.readFileSync(path.join(calibrationDir,'freight-specialist-qualification-v1.json'),'utf8'));
  const finalQ3=JSON.parse(fs.readFileSync(path.join(calibrationDir,'freight-q3-final-portfolio.receipt.json'),'utf8'));
  const registry=JSON.parse(fs.readFileSync(path.join(__dirname,'..','..','governance','specialist-registry-v1.0.json'),'utf8'));
  const subject=registry.records.find(x=>x.specialistId==='SPC-FREIGHT-001');
  assert.equal(program.qualificationResult,'QUALIFIED');
  assert.equal(program.progress.currentRecommendedState,'QUALIFIED');
  assert.equal(program.progress.stageCProgress.totalCases,5);
  assert.equal(program.progress.stageCProgress.realQuoteOrFinalChargeCases,2);
  assert.equal(program.progress.stageCProgress.independentQ3,'PE_PASS');
  assert.equal(program.progress.stageCProgress.q3Q2Audit,'PASS');
  assert.equal(program.progress.stageCProgress.promotionEvidenceStatus,'COMPLETE');
  assert.equal(finalQ3.professionalOutcome,'PE_PASS');
  assert.equal(finalQ3.promotionRecommendation,'QUALIFIED');
  assert.equal(finalQ3.q2Audit.qualificationQ2,'PASS');
  assert.equal(finalQ3.q2Audit.q3OutcomeAccepted,'PE_PASS');
  assert.equal(finalQ3.q2Audit.promotionEvidenceStatus,'COMPLETE');
  assert.equal(finalQ3.authorityUsage.externalActions,0);
  assert.equal(finalQ3.authorityUsage.spendCents,0);
  assert.equal(finalQ3.authorityUsage.productionMutation,false);
  assert.equal(subject.qualificationState,'QUALIFIED');
  assert.ok(subject.allowedTaskClasses.includes('landed-cost-professional-certification'));
  assert.equal(subject.eligibleAsReviewer,false);
  for(const x of ['independent-review','customs-legal-opinion','tax-advice','production-mutation','publication','purchase']){
    assert.ok(subject.excludedTaskClasses.includes(x),'missing qualified exclusion '+x);
  }
});
