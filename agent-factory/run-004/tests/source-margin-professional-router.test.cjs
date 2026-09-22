'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {routeSourceMarginCandidate,categoryRisk}=require('../runtime/source-margin-professional-router.cjs');

function baseRegistry(){
  return [
    {
      specialistId:'SPC-IP-001',
      discipline:'Marketplace Policy/IP',
      subdiscipline:'IP/Marketplace Risk',
      qualificationState:'QUALIFIED',
      allowedTaskClasses:['marketplace-policy-ip-risk-screen','listing-content-ip-review','authenticity-provenance-risk-screen'],
      excludedTaskClasses:['legal-opinion','production-mutation'],
      eligibleAsReviewer:false,
    },
    {
      specialistId:'SPC-IP-Q3-001',
      discipline:'Marketplace Policy/IP',
      subdiscipline:'Independent Marketplace Policy/IP Q3 Review',
      qualificationState:'QUALIFIED',
      allowedTaskClasses:['Q3-marketplace-policy-ip-review'],
      excludedTaskClasses:['policy-ip-authoring','self-review','legal-opinion'],
      eligibleAsReviewer:true,
    },
    {
      specialistId:'SPC-FREIGHT-001',
      discipline:'Logistics',
      subdiscipline:'Freight/Import/Landed Cost',
      qualificationState:'QUALIFIED',
      allowedTaskClasses:['landed-cost-professional-certification'],
      excludedTaskClasses:['independent-review'],
      eligibleAsReviewer:false,
    },
    {
      specialistId:'SPC-FREIGHT-Q3-001',
      discipline:'Logistics',
      subdiscipline:'Independent Freight/Import/Landed-Cost Q3 Review',
      qualificationState:'QUALIFIED',
      allowedTaskClasses:['Q3-freight-review'],
      excludedTaskClasses:['freight-authoring','self-review'],
      eligibleAsReviewer:true,
    },
  ];
}

function genericCandidate(extra={}){
  return {
    candidateId:'GEN-001',
    marketplace:'ebay',
    businessOutcome:'Assess whether a generic commodity candidate can advance toward customer publication.',
    genericCommodity:true,
    simpleSpecification:true,
    ...extra,
  };
}

test('explicit generic/simple candidate bypasses category specialist but still requires policy/IP',()=>{
  const result=routeSourceMarginCandidate(genericCandidate(),baseRegistry());
  assert.equal(result.categoryGate.required,false);
  assert.equal(result.readiness,'READY');
  assert.equal(result.publishableProfessionalGate,true);
  assert.equal(result.pcm.requiredDisciplines.length,1);
  assert.equal(result.pcm.requiredDisciplines[0].discipline,'Marketplace Policy/IP');
});

test('compatibility claim triggers job-specific category specialist and blocks when unbound',()=>{
  const result=routeSourceMarginCandidate(genericCandidate({compatibilityClaim:true}),baseRegistry());
  assert.equal(result.categoryGate.required,true);
  assert.equal(result.readiness,'BLOCKED');
  assert.ok(result.blockers.some(x=>x.type==='CATEGORY_SPECIALIST_UNBOUND'));
});

test('unknown category complexity fails closed rather than assuming low risk',()=>{
  const result=routeSourceMarginCandidate({
    candidateId:'UNKNOWN-001',
    marketplace:'amazon',
    businessOutcome:'Evaluate an incompletely characterized candidate.',
  },baseRegistry());
  assert.equal(result.categoryGate.required,true);
  assert.equal(result.readiness,'BLOCKED');
});

test('qualified job-specific category specialist and reviewer can satisfy a compatibility case',()=>{
  const registry=baseRegistry();
  registry.push(
    {
      specialistId:'SPC-CAT-ELEC-001',
      discipline:'Product/Category Specification',
      subdiscipline:'Electronics compatibility',
      qualificationState:'QUALIFIED',
      allowedTaskClasses:['electronics-compatibility'],
      excludedTaskClasses:['independent-review'],
      eligibleAsReviewer:false,
    },
    {
      specialistId:'SPC-CAT-ELEC-Q3-001',
      discipline:'Product/Category Specification',
      subdiscipline:'Independent electronics compatibility review',
      qualificationState:'QUALIFIED',
      allowedTaskClasses:['Q3-electronics-compatibility'],
      excludedTaskClasses:['authoring','self-review'],
      eligibleAsReviewer:true,
    },
  );
  const result=routeSourceMarginCandidate(genericCandidate({
    compatibilityClaim:true,
    categorySubdiscipline:'Electronics compatibility',
    categorySpecialistId:'SPC-CAT-ELEC-001',
    categoryReviewerId:'SPC-CAT-ELEC-Q3-001',
  }),registry);
  assert.equal(result.readiness,'READY');
  assert.equal(result.publishableProfessionalGate,true);
});

test('cross-border case reuses qualified freight capability and independent reviewer',()=>{
  const result=routeSourceMarginCandidate(genericCandidate({crossBorderImport:true}),baseRegistry());
  assert.equal(result.readiness,'READY');
  assert.ok(result.pcm.requiredDisciplines.some(x=>x.discipline==='Logistics'));
});

test('policy ambiguity blocks even with a qualified IP specialist',()=>{
  const result=routeSourceMarginCandidate(genericCandidate({rightsOwnerAuthorizationAmbiguous:true}),baseRegistry());
  assert.equal(result.readiness,'BLOCKED');
  assert.ok(result.blockers.some(x=>x.type==='POLICY_ESCALATION'));
});

test('safety/electrical/material and branded-equivalence flags are category-gating',()=>{
  for(const key of ['safetyCritical','electricalOrElectronicFunction','materialPerformanceClaim','brandedEquivalenceClaim']){
    const risk=categoryRisk(genericCandidate({[key]:true}));
    assert.equal(risk.required,true,key);
    assert.ok(risk.triggered.includes(key),key);
  }
});


test('canonical registry resolves generic candidate but blocks unbound compatibility candidate',()=>{
  const registry=JSON.parse(fs.readFileSync(path.join(__dirname,'..','..','governance','specialist-registry-v1.0.json'),'utf8')).records;
  const generic=routeSourceMarginCandidate(genericCandidate({candidateId:'CANON-GEN-001'}),registry);
  assert.equal(generic.readiness,'READY');
  assert.equal(generic.publishableProfessionalGate,true);

  const compatibility=routeSourceMarginCandidate(genericCandidate({candidateId:'CANON-COMP-001',compatibilityClaim:true}),registry);
  assert.equal(compatibility.readiness,'BLOCKED');
  assert.equal(compatibility.publishableProfessionalGate,false);
  assert.ok(compatibility.blockers.some(x=>x.type==='CATEGORY_SPECIALIST_UNBOUND'));
});
