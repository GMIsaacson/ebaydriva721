'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fixture=require('../fixtures/g4-demo.json');
const {processPacket}=require('../runtime/runtime.cjs');
const {calculateWeakestLink,isPromotionReceiptEligible}=require('../runtime/adversarial-gate-v1.cjs');
const clone=(v=fixture)=>JSON.parse(JSON.stringify(v));

function assumptions(states=['P','P','I','P','I']){
  return states.map((state,index)=>({statement:`Critical commercial assumption ${index+1} must survive falsification`,state,existential:true,...(state==='P'?{evidenceRef:`EV-GATE-${index+1}`}:{})}));
}
function dimensions(overrides={}){
  return {evidenceInputReality:80,economicReality:75,buyerReality:70,acquisitionReality:70,competitiveReality:70,factoryAdvantage:85,tinyTestReadiness:90,...overrides};
}
function gate(overrides={}){
  const dims=overrides.dimensions||dimensions();
  return {version:'1.0',promotionDecision:'ADVANCE',criticalAssumptions:assumptions(),dimensions:dims,claimedWeakestLinkScore:calculateWeakestLink(dims),c8Status:'PASSED',c9Status:'ELIGIBLE',evidenceFreshnessDate:'2026-09-03',...overrides,dimensions:dims};
}
function packetWith(candidateMutator,gateValue){
  const p=clone();p.candidates=[p.candidates[0]];p.adversarialGateVersion='1.0';
  if(candidateMutator)candidateMutator(p.candidates[0]);
  p.candidates[0].adversarialGate=gateValue;
  return p;
}

test('AG-01 legacy high-score Escalate remains auditable but is never promotion-eligible',()=>{
  const p=clone();p.candidates=[p.candidates[0]];
  const r=processPacket(p);
  assert.equal(r.status,'Pass');assert.equal(r.results[0].route,'Escalate');
  assert.equal(r.results[0].promotionEligible,false);
  assert.equal(r.promotionControl,'LEGACY_REPLAY_NOT_PROMOTION_ELIGIBLE');
  assert.equal(r.summary.promotionEligible,0);
});

test('AG-02 high aggregate score cannot average away a 25/100 existential weak link',()=>{
  const dims=dimensions({acquisitionReality:25});
  const p=packetWith(null,gate({dimensions:dims,claimedWeakestLinkScore:25}));
  const r=processPacket(p);
  assert.equal(r.results[0].deterministicScore,92);
  assert.equal(r.results[0].status,'Blocked');
  assert.equal(r.results[0].reason,'weakest_link_below_threshold');
  assert.equal(r.results[0].weakestLinkScore,25);
});

test('AG-03 existential Assumed/Unknown claim blocks ADVANCE even when every dimension is >=60',()=>{
  const g=gate({criticalAssumptions:assumptions(['P','P','I','A','U'])});
  const p=packetWith(null,g);const r=processPacket(p);
  assert.equal(r.results[0].status,'Blocked');
  assert.equal(r.results[0].reason,'existential_assumption_unresolved');
});

test('AG-04 unknown CAC can route HOLD/Watch with exact restart condition but cannot promote',()=>{
  const dims=dimensions({acquisitionReality:25});
  const g=gate({promotionDecision:'HOLD',criticalAssumptions:assumptions(['P','P','I','A','U']),dimensions:dims,claimedWeakestLinkScore:25,c8Status:'READY',c9Status:'NOT_ELIGIBLE',failureReason:'Customer acquisition cost and close rate are unproven.',restartCondition:'Run a bounded paid-interest test and observe conversion economics.'});
  const p=packetWith((c)=>{c.routerRecommendation='Watch';},g);const r=processPacket(p);
  assert.equal(r.results[0].status,'Pass');assert.equal(r.results[0].route,'Watch');
  assert.equal(r.results[0].promotionDecision,'HOLD');assert.equal(r.results[0].promotionEligible,false);
  assert.equal(isPromotionReceiptEligible(r.results[0].promotionReceipt),false);
});

test('AG-05 commoditized wedge can route KILL/Archive regardless of attractive aggregate',()=>{
  const dims=dimensions({competitiveReality:20});
  const g=gate({promotionDecision:'KILL',dimensions:dims,claimedWeakestLinkScore:20,c8Status:'FAILED',c9Status:'NOT_ELIGIBLE',failureReason:'A cheaper incumbent already supplies the same actionable signal.',restartCondition:'Reopen only with evidence of a materially underserved wedge.'});
  const p=packetWith((c)=>{c.routerRecommendation='Archive';},g);const r=processPacket(p);
  assert.equal(r.results[0].deterministicScore,92);assert.equal(r.results[0].route,'Archive');
  assert.equal(r.results[0].promotionDecision,'KILL');assert.equal(r.results[0].promotionEligible,false);
});

test('AG-06 inaccessible/executable data weakness can HOLD at C2 without being rescued by Factory fit',()=>{
  const dims=dimensions({evidenceInputReality:30,factoryAdvantage:90});
  const g=gate({promotionDecision:'HOLD',criticalAssumptions:assumptions(['P','A','U','I','P']),dimensions:dims,claimedWeakestLinkScore:30,c8Status:'READY',c9Status:'NOT_ELIGIBLE',failureReason:'Displayed prices are not yet proven executable at matched terms.',restartCondition:'Obtain same-day matched quotes with VAT, delivery, quantity and availability.'});
  const p=packetWith((c)=>{c.routerRecommendation='Watch';},g);const r=processPacket(p);
  assert.equal(r.results[0].route,'Watch');assert.equal(r.results[0].weakestLinkScore,30);
  assert.equal(r.results[0].promotionEligible,false);
});

test('AG-07 fully evidenced survivor can ADVANCE and emits a Director-verifiable receipt',()=>{
  const p=packetWith(null,gate());const r=processPacket(p);const item=r.results[0];
  assert.equal(item.status,'Pass');assert.equal(item.route,'Escalate');
  assert.equal(item.promotionDecision,'ADVANCE');assert.equal(item.promotionEligible,true);
  assert.equal(r.summary.promotionEligible,1);
  assert.equal(isPromotionReceiptEligible(item.promotionReceipt),true);
});

test('AG-08 claimed weakest-link arithmetic is deterministic and fail-closed',()=>{
  const dims=dimensions({buyerReality:61});
  const p=packetWith(null,gate({dimensions:dims,claimedWeakestLinkScore:99}));const r=processPacket(p);
  assert.equal(r.results[0].status,'Blocked');
  assert.equal(r.results[0].reason,'adversarial_gate_schema_invalid');
  assert.match(r.results[0].violations.join(' | '),/weakest-link score mismatch/);
});

test('AG-09 HOLD/KILL must preserve failure memory and restart condition',()=>{
  const g=gate({promotionDecision:'HOLD',c8Status:'READY',c9Status:'NOT_ELIGIBLE'});
  const p=packetWith((c)=>{c.routerRecommendation='Watch';},g);const r=processPacket(p);
  assert.equal(r.results[0].status,'Blocked');
  assert.equal(r.results[0].reason,'adversarial_gate_schema_invalid');
  assert.match(r.results[0].violations.join(' | '),/failure reason missing/);
  assert.match(r.results[0].violations.join(' | '),/restart condition missing/);
});
