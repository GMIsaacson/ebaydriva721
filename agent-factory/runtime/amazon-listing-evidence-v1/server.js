'use strict';
const http=require('node:http');
const fs=require('node:fs');

const PORT=Number(process.env.PORT||8807);
const CONTROL_URL=process.env.WORK_CONTROL_URL||'http://work-control:8787';
const BROWSER_URL=process.env.AMAZON_LISTING_EVIDENCE_BROWSER_URL||'http://amazon-census-browser-v1:8791/census';
const WORKER_ID=process.env.WORKER_ID||'amazon-listing-evidence-v1';
const TOKEN=fs.readFileSync('/run/secrets/work-control-worker-token','utf8').trim();
const MARKER='[AMAZON_LISTING_EVIDENCE_V1]';
const CONTRACT='amazon-listing-evidence-v1';
const MAX_ASINS=24;

function json(res,status,value){const body=JSON.stringify(value);res.writeHead(status,{'content-type':'application/json','cache-control':'no-store','content-length':Buffer.byteLength(body)});res.end(body);}
async function readBody(req,max=200000){const chunks=[];let total=0;for await(const c of req){total+=c.length;if(total>max)throw new Error('REQUEST_TOO_LARGE');chunks.push(c);}return chunks.length?JSON.parse(Buffer.concat(chunks).toString('utf8')):{};}
async function control(path,method='GET',body){
  const r=await fetch(CONTROL_URL+path,{method,headers:{'content-type':'application/json','x-work-control-worker-token':TOKEN},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(35000)});
  const t=await r.text();let p={};try{p=t?JSON.parse(t):{};}catch{p={raw:t};}
  if(!r.ok){const e=new Error(p.error||('CONTROL_HTTP_'+r.status));e.statusCode=r.status;throw e;}return p;
}
function parsePayload(command){
  if(command?.team?.id!=='RUN-004')throw new Error('LISTING_EVIDENCE_TEAM_INVALID');
  const text=String(command?.instruction||'');const at=text.indexOf(MARKER);if(at<0)throw new Error('LISTING_EVIDENCE_MARKER_REQUIRED');
  let p;try{p=JSON.parse(text.slice(at+MARKER.length).trim());}catch{throw new Error('LISTING_EVIDENCE_PAYLOAD_INVALID');}
  if(!/^SM-AMZ-[A-Z0-9][A-Z0-9-]{2,100}$/.test(String(p.runId||'')))throw new Error('LISTING_EVIDENCE_RUN_ID_INVALID');
  if(!/^[0-9]{5,20}$/.test(String(p.leafId||'')))throw new Error('LISTING_EVIDENCE_LEAF_ID_INVALID');
  if(typeof p.leafName!=='string'||p.leafName.trim().length<2||p.leafName.trim().length>120)throw new Error('LISTING_EVIDENCE_LEAF_NAME_INVALID');
  if(p.contractVersion!==CONTRACT)throw new Error('LISTING_EVIDENCE_CONTRACT_INVALID');
  if(p.specialist!=='AGT-AMAZON-LISTING-CLASSIFIER-001')throw new Error('LISTING_EVIDENCE_SPECIALIST_INVALID');
  if(p.sourceCensusCommandId!=null&&!/^WC-\d{14}-[a-f0-9]{10}$/.test(String(p.sourceCensusCommandId||'')))throw new Error('LISTING_EVIDENCE_CENSUS_COMMAND_INVALID');
  if(p.demandValidationCommandId!=null&&!/^WC-\d{14}-[a-f0-9]{10}$/.test(String(p.demandValidationCommandId||'')))throw new Error('LISTING_EVIDENCE_DEMAND_COMMAND_INVALID');
  p.targetAsins=Array.isArray(p.targetAsins)?[...new Set(p.targetAsins.map(x=>String(x||'').trim().toUpperCase()))]:[];
  if(p.targetAsins.length<1||p.targetAsins.length>MAX_ASINS||p.targetAsins.some(x=>!/^B[A-Z0-9]{9}$/.test(x)))throw new Error('LISTING_EVIDENCE_ASINS_INVALID');
  p.leafName=p.leafName.trim();return p;
}
function norm(v){return String(v||'').toLowerCase().replace(/[^a-z0-9]+/g,'').trim();}
function signal(row){
  const seller=String(row?.sellerName||'').trim();
  const brand=String(row?.brandName||'').trim();
  if(/^amazon\.com$/i.test(seller))return {code:'AM',confidence:95,reason:'Amazon.com is the displayed seller.'};
  const ns=norm(seller), nb=norm(brand);
  if(ns&&nb&&(ns===nb||ns.includes(nb)||nb.includes(ns)))return {code:'BO',confidence:90,reason:'Displayed seller name materially matches product byline brand.'};
  if(seller||brand)return {code:'UN',confidence:55,reason:'Seller/brand evidence exists but does not prove channel relationship.'};
  return {code:'UN',confidence:35,reason:'Amazon product detail did not expose usable seller/brand evidence in this pass.'};
}
async function browser(payload){
  const r=await fetch(BROWSER_URL,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({leafId:payload.leafId,targetAsins:payload.targetAsins,enrichSeller:true,limit:payload.targetAsins.length}),signal:AbortSignal.timeout(300000)});
  const p=await r.json();if(!r.ok||!p?.ok)throw new Error(p?.error||'LISTING_EVIDENCE_BROWSER_FAILED');return p;
}
function receipt(command,payload,b){
  const observedAt=String(b.observedAt||new Date().toISOString());
  const by=new Map((Array.isArray(b.results)?b.results:[]).map(r=>[String(r.asin||'').toUpperCase(),r]));
  const rows=payload.targetAsins.map(asin=>{const r=by.get(asin)||{};const s=signal(r);return {
    asin,title:String(r.title||'').slice(0,500),sourceUrl:'https://www.amazon.com/dp/'+asin,
    brandName:String(r.brandName||'').trim()||null,sellerName:String(r.sellerName||'').trim()||null,
    sellerId:String(r.sellerId||'').trim()||null,sellerUrl:String(r.sellerUrl||'').trim()||null,
    signalCode:s.code,confidencePct:s.confidence,reason:s.reason,observedAt,detailError:r.detailError||null
  };});
  const known=rows.filter(x=>x.signalCode!=='UN').length,unknown=rows.length-known;
  return {schemaVersion:'1.1',commandId:command.commandId,terminalState:'DELIVERED',
    summary:'Amazon '+payload.leafName+' Listing Evidence V1: PASS',
    detail:'Listing evidence collected for '+rows.length+' ASINs: '+known+' with explicit route-relevant signal, '+unknown+' unresolved. Unknowns remain fail-closed.',
    steps:[
      {name:'Targeted product-page evidence',detail:'Reused the canonical Amazon census browser in targeted seller-enrichment mode.'},
      {name:'Conservative signal derivation',detail:'Only Amazon Retail or seller/brand name match emitted a positive signal. All other cases remain unresolved.'}
    ],
    completedAt:new Date().toISOString(),externalActionsPerformed:0,spendCents:0,productionMutation:false,
    specialistExecution:{specialistId:'AGT-AMAZON-LISTING-CLASSIFIER-001',qualificationState:'TESTING',taskClass:'listing-seller-evidence-v1',independentReview:false,runId:payload.runId,leafId:payload.leafId,stage:'LISTING_EVIDENCE',reviewedCommandIds:[payload.sourceCensusCommandId,payload.demandValidationCommandId].filter(Boolean)},
    stageResult:{runId:payload.runId,leafId:payload.leafId,stage:'LISTING_EVIDENCE',contractVersion:CONTRACT,outcome:'PASS',summary:'Collected conservative listing/seller evidence.',sourceCensusCommandId:payload.sourceCensusCommandId||null,demandValidationCommandId:payload.demandValidationCommandId||null,evidence:rows},
    modelExecution:{provider:'deterministic',model:'amazon-listing-evidence-v1',responseId:null,inputTokens:0,outputTokens:0,estimatedCostCents:0}
  };
}
function failed(command,e){return {schemaVersion:'1.1',commandId:command.commandId,terminalState:'FAILED',summary:'Amazon Listing Evidence V1 failed closed',detail:String(e?.message||e).slice(0,1200),steps:[{name:'Fail closed',detail:'No classification evidence was accepted.'}],completedAt:new Date().toISOString(),externalActionsPerformed:0,spendCents:0,productionMutation:false,modelExecution:{provider:'deterministic',model:'amazon-listing-evidence-v1',responseId:null,inputTokens:0,outputTokens:0,estimatedCostCents:0}};}
async function runExpected(expectedCommandId){
  const claimed=await control('/api/v1/worker/next','POST',{workerId:WORKER_ID});
  if(claimed.status!=='CLAIMED')throw new Error('LISTING_EVIDENCE_NO_COMMAND_AVAILABLE');
  const command=claimed.command;if(expectedCommandId&&command.commandId!==expectedCommandId)throw new Error('LISTING_EVIDENCE_CLAIMED_UNEXPECTED_COMMAND:'+command.commandId);
  try{const p=parsePayload(command);const b=await browser(p);const rec=receipt(command,p,b);const result=await control('/api/v1/worker/receipts','POST',rec);return {ok:true,commandId:command.commandId,receipt:rec,result};}
  catch(e){try{await control('/api/v1/worker/receipts','POST',failed(command,e));}catch{}throw e;}
}
const server=http.createServer(async(req,res)=>{const path=String(req.url||'/').split('?')[0];
  if(req.method==='GET'&&path==='/health')return json(res,200,{ok:true,service:'amazon-listing-evidence-v1',contractVersion:CONTRACT});
  if(req.method==='POST'&&path==='/run'){try{return json(res,200,await runExpected((await readBody(req)).expectedCommandId||null));}catch(e){return json(res,500,{ok:false,error:String(e?.message||e)});}}
  return json(res,404,{ok:false,error:'NOT_FOUND'});
});
server.listen(PORT,'0.0.0.0',()=>console.log(JSON.stringify({service:'amazon-listing-evidence-v1',status:'ready',port:PORT})));
