'use strict';
const test=require('node:test'); const assert=require('node:assert/strict');
const {tick,initial,validateResult,STAGES,RUN,LEAF}=require('../runtime/amazon-leaf-controller.cjs');
const {makePorts}=require('../runtime/amazon-leaf-ports.cjs');
const at='2026-09-22T14:00:00.000Z';
const bindings={executionReceipt:'fixture',publicResearchReceipt:'fixture',writebackReceipt:'fixture',run004TeamId:'DS-S2M-004'};
function harness(){
 let state=null,calls=0,reply=null;
 return {store:{read:async()=>structuredClone(state),compareAndSet:async(v,n)=>{if((state?.version||0)!==v)throw Error('CHECKPOINT_CONFLICT');state=structuredClone(n);}},
 workControl:{dispatch:async()=>({command:{commandId:`WC-test-${++calls}`}}),read:async()=>reply},bindings,now:()=>new Date(at),
 state:()=>state,calls:()=>calls,reply:r=>{reply=r;}};
}
function result(stage){return {runId:RUN,leafId:LEAF,stage,outcome:'PASS',summary:'Fixture evidence',blockers:[],coverage:'partial',
 evidence:[{url:'https://www.amazon.com/dp/B000000001',observedAt:at,claim:'Fixture only',sourceReceipt:'fixture-retrieval'}],
 candidates:[{asin:'B000000001',disposition:stage==='EVIDENCE_QA'?'research_candidate':'continue',reason:'Fixture',
 economicsInputs:{collectedRevenueCents:1000,sourceCostCents:200,inboundFreightCents:100,marketplaceFeesCents:200,outboundShippingCents:100,packagingCents:50,riskReserveCents:50}}]};}
test('preflight records blocker without dispatch',async()=>{const h=harness();await tick({...h,bindings:{}});assert.equal(h.state().phase,'BLOCKED');assert.equal(h.calls(),0);});
test('six stage sequence is resumable, independent QA and never publication',async()=>{
 const h=harness();
 for(const [stage] of STAGES){
  h.reply(null);await tick(h);const id=h.state().commandId;assert.equal(h.state().phase,'WAITING');
  await tick(h);assert.equal(h.state().commandId,id);
  h.reply({receipt:{terminalState:'DELIVERED',summary:JSON.stringify(result(stage))}});await tick(h);
 }
 assert.equal(h.state().phase,'RESEARCH_FINISHED');assert.equal(h.calls(),6);
 assert.equal(new Set(h.state().results.map(r=>r.commandId)).size,6);
 assert.equal(h.state().results[4].result.candidates[0].deterministicEconomics.netProfitCents,300);
 await tick(h);assert.equal(h.calls(),6);
});
test('two concurrent ticks cannot dispatch twice',async()=>{const h=harness();await Promise.allSettled([tick(h),tick(h)]);assert.equal(h.calls(),1);});
test('ambiguous dispatch never retried',async()=>{const h=harness();h.workControl.dispatch=async()=>{throw Error('timeout');};await tick(h);assert.equal(h.state().phase,'BLOCKED');await tick(h);assert.equal(h.state().events.filter(e=>e.kind==='DISPATCH_INTENT').length,1);});
test('crash after intent stops for reconciliation',async()=>{const h=harness();const s={...initial(),version:1,phase:'DISPATCH_INTENT',events:[]};await h.store.compareAndSet(0,s);await tick(h);assert.equal(h.state().phase,'BLOCKED');assert.equal(h.calls(),0);});
test('model narrative cannot masquerade as structured evidence',async()=>{const h=harness();await tick(h);h.reply({receipt:{terminalState:'DELIVERED',summary:'Looks profitable'}});await tick(h);assert.equal(h.state().phase,'BLOCKED');});
test('dropping a candidate blocks the handoff',async()=>{const h=harness();await tick(h);h.reply({receipt:{terminalState:'DELIVERED',summary:JSON.stringify(result('ASIN_DISCOVERY'))}});await tick(h);await tick(h);const r=result('DEMAND_VALIDATION');r.candidates=[];h.reply({receipt:{terminalState:'DELIVERED',summary:JSON.stringify(r)}});await tick(h);assert.equal(h.state().events.at(-1).reason,'CANDIDATE_RECONCILIATION_FAILED');});
test('auth failures stop immediately; server read retries are capped',async()=>{
 const h=harness();await tick(h);h.workControl.read=async()=>{const e=Error();e.status=503;throw e;};
 await tick(h);await tick(h);assert.equal(h.state().phase,'WAITING');await tick(h);assert.equal(h.state().phase,'BLOCKED');
 const a=harness();await tick(a);a.workControl.read=async()=>{const e=Error();e.status=401;throw e;};await tick(a);assert.equal(a.state().phase,'BLOCKED');
});
test('stalled worker stops after thirty minutes',async()=>{const h=harness();await tick(h);await tick({...h,now:()=>new Date(Date.parse(at)+31*60000)});assert.equal(h.state().events.at(-1).kind,'WORKER_TIMEOUT');});
test('stale evidence, duplicate ASINs, empty discoveries and missing costs fail',()=>{
 for(const change of [r=>r.evidence[0].observedAt='2020-01-01',r=>r.candidates.push(r.candidates[0]),r=>r.candidates=[]]){
  const r=result('ASIN_DISCOVERY');change(r);assert.throws(()=>validateResult(r,'ASIN_DISCOVERY',Date.parse(at)));
 }
 const r=result('ECONOMICS');delete r.candidates[0].economicsInputs;assert.throws(()=>validateResult(r,'ECONOMICS',Date.parse(at)),/ECONOMICS_INPUTS/);
});
test('real HTTP adapter uses established gateway and checkpoint RPC; forbids redirects',async()=>{
 const calls=[];const p=makePorts({gateway:'https://factory.example/gateway',token:'fixture',supabaseUrl:'https://db.example',supabaseKey:'fixture',fetchImpl:async(u,o)=>{calls.push([u,o]);return {ok:true,json:async()=>({})};}});
 await p.workControl.dispatch({teamId:'fixture'});await p.workControl.read('WC-test-1');await p.store.compareAndSet(0,initial());
 assert.match(calls[0][0],/gateway\/v1\/commands$/);assert.match(calls[2][0],/rpc\/run004_plant_labels_checkpoint$/);
 assert.equal(calls[0][1].redirect,'error');
});
