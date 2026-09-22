'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
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
