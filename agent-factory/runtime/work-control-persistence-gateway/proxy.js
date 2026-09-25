'use strict';
const http=require('node:http');
const fs=require('node:fs');

const UP=process.env.CONTROL_UPSTREAM;
const OBSERVE_PERSIST=process.env.OBSERVE_PERSIST_URL;
const DEMAND_PERSIST=process.env.DEMAND_PERSIST_URL;
const SOURCING_PERSIST=process.env.SOURCING_PERSIST_URL;
const DISCOVERY_V2_PERSIST=process.env.SUPPLIER_DISCOVERY_V2_PERSIST_URL;
const LISTING_CLASSIFICATION_PERSIST=process.env.LISTING_CLASSIFICATION_PERSIST_URL||'https://aittnuqrrenkencygfje.supabase.co/functions/v1/amazon-listing-classification-v1-persistence';
const PP_EQUIVALENCE_PERSIST=process.env.PP_EQUIVALENCE_PERSIST_URL||'https://aittnuqrrenkencygfje.supabase.co/functions/v1/amazon-pp-equivalence-v1-persistence';
const SUPPLIER_COMMERCIAL_VALIDITY_PERSIST=process.env.SUPPLIER_COMMERCIAL_VALIDITY_PERSIST_URL||'https://aittnuqrrenkencygfje.supabase.co/functions/v1/amazon-supplier-commercial-validity-v1-persistence';
const LANDED_COST_PERSIST=process.env.LANDED_COST_PERSIST_URL||'https://aittnuqrrenkencygfje.supabase.co/functions/v1/amazon-landed-cost-v1-persistence';
const ECONOMICS_V1_PERSIST=process.env.ECONOMICS_V1_PERSIST_URL||'https://aittnuqrrenkencygfje.supabase.co/functions/v1/amazon-economics-v1-persistence';
const ECONOMIC_RESCUE_LOOP_V1_PERSIST=process.env.ECONOMIC_RESCUE_LOOP_V1_PERSIST_URL||'https://aittnuqrrenkencygfje.supabase.co/functions/v1/amazon-economic-rescue-loop-v1-persistence';
const CASE_BREAK_PROCUREMENT_V1_PERSIST=process.env.CASE_BREAK_PROCUREMENT_V1_PERSIST_URL||'https://aittnuqrrenkencygfje.supabase.co/functions/v1/amazon-case-break-procurement-v1-persistence';
const MARKETPLACE_COST_FLOOR_V1_PERSIST=process.env.MARKETPLACE_COST_FLOOR_V1_PERSIST_URL||'https://aittnuqrrenkencygfje.supabase.co/functions/v1/amazon-marketplace-cost-floor-v1-persistence';
const FBM_OUTBOUND_COST_V1_PERSIST=process.env.FBM_OUTBOUND_COST_V1_PERSIST_URL||'https://aittnuqrrenkencygfje.supabase.co/functions/v1/amazon-fbm-outbound-cost-v1-persistence';
const FBM_SELLER_RATE_QUOTE_V1_PERSIST=process.env.FBM_SELLER_RATE_QUOTE_V1_PERSIST_URL||'https://aittnuqrrenkencygfje.supabase.co/functions/v1/amazon-fbm-seller-rate-quote-v1-persistence';
const ROUTE_CANDIDATE_GATE_V1_PERSIST=process.env.ROUTE_CANDIDATE_GATE_V1_PERSIST_URL||'https://aittnuqrrenkencygfje.supabase.co/functions/v1/amazon-route-candidate-gate-v1-persistence';
const PRODUCT_NORMALIZATION_V1_PERSIST=process.env.PRODUCT_NORMALIZATION_V1_PERSIST_URL||'https://aittnuqrrenkencygfje.supabase.co/functions/v1/amazon-product-normalization-v1-persistence';
const PRODUCT_CLUSTERING_V1_PERSIST=process.env.PRODUCT_CLUSTERING_V1_PERSIST_URL||'https://aittnuqrrenkencygfje.supabase.co/functions/v1/amazon-product-clustering-v1-persistence';
const ATTRIBUTE_RESOLUTION_V1_PERSIST=process.env.ATTRIBUTE_RESOLUTION_V1_PERSIST_URL||'https://aittnuqrrenkencygfje.supabase.co/functions/v1/amazon-product-attribute-resolution-v1-persistence';
const PRODUCT_GRAPH_PROMOTION_V1_PERSIST=process.env.PRODUCT_GRAPH_PROMOTION_V1_PERSIST_URL||'https://aittnuqrrenkencygfje.supabase.co/functions/v1/product-graph-promotion-v1-persistence';
const TOKEN=fs.readFileSync('/secret/token','utf8').trim();

function reply(res,code,obj){
  const body=JSON.stringify(obj);
  res.writeHead(code,{
    'content-type':'application/json; charset=utf-8',
    'cache-control':'no-store',
    'content-length':Buffer.byteLength(body),
    'x-content-type-options':'nosniff'
  });
  res.end(body);
}


const CONTRACT_MARKERS=Object.freeze({
  'amazon-demand-validation-v1':'[AMAZON_DEMAND_VALIDATION_V1]',
  'amazon-sourcing-v1':'[AMAZON_SOURCING_V1]',
  'amazon-supplier-discovery-v2':'[AMAZON_SUPPLIER_DISCOVERY_V2]',
  'amazon-listing-classification-v1':'[AMAZON_LISTING_CLASSIFICATION_V1]',
  'amazon-pp-equivalence-v1':'[AMAZON_PP_EQUIVALENCE_V1]',
  'amazon-supplier-commercial-validity-v1':'[AMAZON_SUPPLIER_COMMERCIAL_VALIDITY_V1]',
  'amazon-landed-cost-v1':'[AMAZON_LANDED_COST_V1]',
  'amazon-economics-v1':'[AMAZON_ECONOMICS_V1]',
  'amazon-economic-rescue-target-v1':'[AMAZON_ECONOMIC_RESCUE_TARGET_V1]',
  'amazon-quantity-break-rescue-v1':'[AMAZON_QUANTITY_BREAK_RESCUE_V1]',
  'amazon-alternative-supplier-route-discovery-v1':'[AMAZON_ALTERNATIVE_SUPPLIER_ROUTE_DISCOVERY_V1]',
  'amazon-case-break-procurement-v1':'[AMAZON_CASE_BREAK_PROCUREMENT_V1]',
  'amazon-marketplace-cost-floor-v1':'[AMAZON_MARKETPLACE_COST_FLOOR_V1]',
  'amazon-fbm-outbound-cost-v1':'[AMAZON_FBM_OUTBOUND_COST_V1]',
  'amazon-fbm-seller-rate-quote-v1':'[AMAZON_FBM_SELLER_RATE_QUOTE_V1]',
  'amazon-route-candidate-gate-v1':'[AMAZON_ROUTE_CANDIDATE_GATE_V1]',
  'amazon-product-normalization-v1':'[AMAZON_PRODUCT_NORMALIZATION_V1]',
  'amazon-product-clustering-v1':'[AMAZON_PRODUCT_CLUSTERING_V1]',
  'amazon-selective-attribute-resolution-v1':'[AMAZON_ATTRIBUTE_RESOLUTION_V1]',
  'product-graph-promotion-v1':'[PRODUCT_GRAPH_PROMOTION_V1]'
});

async function verifyGovernedReceipt(receipt){
  const commandId=String(receipt?.commandId||'').trim();
  if(!/^WC-\d{14}-[A-Za-z0-9]{10}$/.test(commandId)){
    throw Object.assign(new Error('FACTORY_COMMAND_REQUIRED'),{kind:'FACTORY_GOVERNANCE'});
  }

  const response=await fetch(UP+'/api/v1/commands/'+encodeURIComponent(commandId),{
    method:'GET',
    headers:{'accept':'application/json'},
    signal:AbortSignal.timeout(5000)
  });
  if(!response.ok){
    throw Object.assign(new Error('FACTORY_COMMAND_NOT_FOUND'),{kind:'FACTORY_GOVERNANCE',statusCode:response.status});
  }

  const control=await response.json();
  const command=control?.command;
  const claim=control?.claim;
  if(!command||command.commandId!==commandId||command?.team?.id!=='RUN-004'){
    throw Object.assign(new Error('FACTORY_COMMAND_INVALID'),{kind:'FACTORY_GOVERNANCE'});
  }
  if(!claim||claim.commandId!==commandId||claim.state!=='CLAIMED'||!claim.workerId){
    throw Object.assign(new Error('FACTORY_ACTIVE_CLAIM_REQUIRED'),{kind:'FACTORY_GOVERNANCE'});
  }

  const contract=String(receipt?.stageResult?.contractVersion||'');
  const marker=CONTRACT_MARKERS[contract];
  const instruction=String(command.instruction||'');
  if(marker&&!instruction.includes(marker)){
    throw Object.assign(new Error('FACTORY_COMMAND_STAGE_MISMATCH'),{kind:'FACTORY_GOVERNANCE'});
  }

  const runId=String(receipt?.stageResult?.runId||receipt?.specialistExecution?.runId||'').trim();
  const leafId=String(receipt?.stageResult?.leafId||receipt?.specialistExecution?.leafId||'').trim();
  if(runId&&!instruction.includes(runId)){
    throw Object.assign(new Error('FACTORY_COMMAND_RUN_MISMATCH'),{kind:'FACTORY_GOVERNANCE'});
  }
  if(leafId&&!instruction.includes(leafId)){
    throw Object.assign(new Error('FACTORY_COMMAND_TARGET_MISMATCH'),{kind:'FACTORY_GOVERNANCE'});
  }

  return {commandId,workerId:claim.workerId,teamId:command.team.id,marker:marker||null,command};
}

async function persistBeforeReceipt(receipt){
  const stage=String(receipt?.stageResult?.stage||'').toUpperCase();
  const contract=String(receipt?.stageResult?.contractVersion||'');
  const outcome=String(receipt?.stageResult?.outcome||'').toUpperCase();
  const specialistStage=String(receipt?.specialistExecution?.stage||'').toUpperCase();

  if(receipt?.terminalState!=='DELIVERED'||outcome!=='PASS')return null;

  let endpoint=null;
  let kind=null;

  if(stage==='OBSERVE'&&specialistStage==='OBSERVE'){
    endpoint=OBSERVE_PERSIST;
    kind='OBSERVE';
  }else if(stage==='DEMAND_VALIDATION'&&contract==='amazon-demand-validation-v1'&&specialistStage==='DEMAND_VALIDATION'){
    endpoint=DEMAND_PERSIST;
    kind='DEMAND_VALIDATION_V1';
  }else if(stage==='SOURCING'&&contract==='amazon-sourcing-v1'&&specialistStage==='SOURCING'){
    endpoint=SOURCING_PERSIST;
    kind='SOURCING_V1';
  }else if(stage==='SOURCING'&&contract==='amazon-supplier-discovery-v2'&&specialistStage==='SOURCING'){
    endpoint=DISCOVERY_V2_PERSIST;
    kind='SUPPLIER_DISCOVERY_V2';
  }else if(stage==='LISTING_CLASSIFICATION'&&contract==='amazon-listing-classification-v1'&&specialistStage==='LISTING_CLASSIFICATION'){
    endpoint=LISTING_CLASSIFICATION_PERSIST;
    kind='LISTING_CLASSIFICATION_V1';
  }else if(stage==='PRODUCT_PACK_EQUIVALENCE'&&contract==='amazon-pp-equivalence-v1'&&specialistStage==='PRODUCT_PACK_EQUIVALENCE'){
    endpoint=PP_EQUIVALENCE_PERSIST;
    kind='PP_EQUIVALENCE_V1';
  }else if(stage==='SUPPLIER_COMMERCIAL_VALIDITY'&&contract==='amazon-supplier-commercial-validity-v1'&&specialistStage==='SUPPLIER_COMMERCIAL_VALIDITY'){
    endpoint=SUPPLIER_COMMERCIAL_VALIDITY_PERSIST;
    kind='SUPPLIER_COMMERCIAL_VALIDITY_V1';
  }else if(stage==='LANDED_COST'&&contract==='amazon-landed-cost-v1'&&specialistStage==='LANDED_COST'){
    endpoint=LANDED_COST_PERSIST;
    kind='LANDED_COST_V1';
  }else if(stage==='ECONOMICS'&&contract==='amazon-economics-v1'&&specialistStage==='ECONOMICS'){
    endpoint=ECONOMICS_V1_PERSIST;
    kind='ECONOMICS_V1';
  }else if(stage==='ECONOMIC_RESCUE_TARGET'&&contract==='amazon-economic-rescue-target-v1'&&specialistStage==='ECONOMIC_RESCUE_TARGET'){
    endpoint=ECONOMIC_RESCUE_LOOP_V1_PERSIST;
    kind='ECONOMIC_RESCUE_TARGET_V1';
  }else if(stage==='QUANTITY_BREAK_RESCUE'&&contract==='amazon-quantity-break-rescue-v1'&&specialistStage==='QUANTITY_BREAK_RESCUE'){
    endpoint=ECONOMIC_RESCUE_LOOP_V1_PERSIST;
    kind='QUANTITY_BREAK_RESCUE_V1';
  }else if(stage==='SOURCING'&&contract==='amazon-alternative-supplier-route-discovery-v1'&&specialistStage==='SOURCING'){
    endpoint=ECONOMIC_RESCUE_LOOP_V1_PERSIST;
    kind='ALTERNATIVE_SUPPLIER_ROUTE_DISCOVERY_V1';
  }else if(stage==='CASE_BREAK_PROCUREMENT'&&contract==='amazon-case-break-procurement-v1'&&specialistStage==='CASE_BREAK_PROCUREMENT'){
    endpoint=CASE_BREAK_PROCUREMENT_V1_PERSIST;
    kind='CASE_BREAK_PROCUREMENT_V1';
  }else if(stage==='MARKETPLACE_COST_FLOOR'&&contract==='amazon-marketplace-cost-floor-v1'&&specialistStage==='MARKETPLACE_COST_FLOOR'){
    endpoint=MARKETPLACE_COST_FLOOR_V1_PERSIST;
    kind='MARKETPLACE_COST_FLOOR_V1';
  }else if(stage==='FBM_OUTBOUND_COST'&&contract==='amazon-fbm-outbound-cost-v1'&&specialistStage==='FBM_OUTBOUND_COST'){
    endpoint=FBM_OUTBOUND_COST_V1_PERSIST;
    kind='FBM_OUTBOUND_COST_V1';
  }else if(stage==='FBM_SELLER_RATE_QUOTE'&&contract==='amazon-fbm-seller-rate-quote-v1'&&specialistStage==='FBM_SELLER_RATE_QUOTE'){
    endpoint=FBM_SELLER_RATE_QUOTE_V1_PERSIST;
    kind='FBM_SELLER_RATE_QUOTE_V1';
  }else if(stage==='PRODUCT_NORMALIZATION'&&contract==='amazon-product-normalization-v1'&&specialistStage==='PRODUCT_NORMALIZATION'){
    endpoint=PRODUCT_NORMALIZATION_V1_PERSIST;
    kind='PRODUCT_NORMALIZATION_V1';
  }else if(stage==='PRODUCT_CLUSTERING'&&contract==='amazon-product-clustering-v1'&&specialistStage==='PRODUCT_CLUSTERING'){
    endpoint=PRODUCT_CLUSTERING_V1_PERSIST;
    kind='PRODUCT_CLUSTERING_V1';
  }else if(stage==='ATTRIBUTE_RESOLUTION'&&contract==='amazon-selective-attribute-resolution-v1'&&specialistStage==='ATTRIBUTE_RESOLUTION'){
    endpoint=ATTRIBUTE_RESOLUTION_V1_PERSIST;
    kind='ATTRIBUTE_RESOLUTION_V1';
  }else if(stage==='PRODUCT_GRAPH_PROMOTION'&&contract==='product-graph-promotion-v1'&&specialistStage==='PRODUCT_GRAPH_PROMOTION'){
    endpoint=PRODUCT_GRAPH_PROMOTION_V1_PERSIST;
    kind='PRODUCT_GRAPH_PROMOTION_V1';
  }else if(stage==='ROUTE_CANDIDATE_GATE'&&contract==='amazon-route-candidate-gate-v1'&&specialistStage==='ROUTE_CANDIDATE_GATE'){
    endpoint=ROUTE_CANDIDATE_GATE_V1_PERSIST;
    kind='ROUTE_CANDIDATE_GATE_V1';
  }else{
    return null;
  }

  if(!endpoint)throw Object.assign(new Error('CANONICAL_PERSIST_ENDPOINT_MISSING'),{kind});

  const response=await fetch(endpoint,{
    method:'POST',
    headers:{
      'content-type':'application/json',
      'x-source-margin-observe-token':TOKEN
    },
    body:JSON.stringify(receipt),
    signal:AbortSignal.timeout(30000)
  });

  const body=await response.text();

  if(!response.ok){
    console.error(JSON.stringify({
      event:'CANONICAL_PERSIST_BLOCKED',
      kind,
      commandId:receipt.commandId,
      status:response.status,
      detail:body.slice(0,1000)
    }));
    const error=new Error('CANONICAL_PERSISTENCE_FAILED');
    error.statusCode=response.status;
    error.kind=kind;
    throw error;
  }

  console.log(JSON.stringify({
    event:'CANONICAL_PERSISTED_BEFORE_RECEIPT',
    kind,
    commandId:receipt.commandId
  }));

  return kind;
}


function parseCommandPayload(command,marker){
  const instruction=String(command?.instruction||'');
  const idx=instruction.lastIndexOf(marker);
  if(idx<0)return {};
  const tail=instruction.slice(idx+marker.length).trim();
  const start=tail.indexOf('{');
  if(start<0)return {};
  try{return JSON.parse(tail.slice(start));}catch{return {};}
}
async function workControlState(){
  const response=await fetch(UP+'/api/v1/state',{method:'GET',headers:{'accept':'application/json'},signal:AbortSignal.timeout(5000)});
  if(!response.ok)throw Object.assign(new Error('FACTORY_COORDINATOR_STATE_UNAVAILABLE'),{kind:'FACTORY_COORDINATOR',statusCode:response.status});
  return response.json();
}
async function coordinateAfterPersistence(receipt,governance,persistedKind){
  if(persistedKind!=='OBSERVE')return null;
  if(String(receipt?.stageResult?.contractVersion||'')!=='amazon-leaf-census-v2')return null;
  if(String(receipt?.stageResult?.outcome||'').toUpperCase()!=='PASS')return null;

  const leafId=String(receipt?.stageResult?.leafId||'').trim();
  const sourceCommandId=String(receipt?.commandId||'').trim();
  const candidates=Array.isArray(receipt?.stageResult?.candidates)
    ? [...new Set(receipt.stageResult.candidates.map(x=>String(x?.asin||'').trim()).filter(x=>/^B[A-Z0-9]{9}$/.test(x)))]
    : [];
  if(!leafId||!candidates.length){
    console.log(JSON.stringify({event:'FACTORY_COORDINATOR_WAITING',reason:'CENSUS_FACTS_INCOMPLETE',leafId,sourceCommandId}));
    return null;
  }

  const sourcePayload=parseCommandPayload(governance.command,'[AMAZON_LEAF_CENSUS_V2]');
  const leafName=String(sourcePayload.leafName||'Unknown Leaf').trim().slice(0,120);
  const sourceSuffix=sourceCommandId.replace(/[^A-Za-z0-9]/g,'').slice(-10).toUpperCase();
  const state=await workControlState();
  const serialized=JSON.stringify(state?.work||[]);
  const batches=[];
  for(let start=0;start<candidates.length;start+=24)batches.push({start,asins:candidates.slice(start,start+24)});

  const dispatched=[];
  for(const batch of batches){
    const runId='SM-AMZ-DEMAND-'+leafId+'-'+sourceSuffix+'-B'+String(batch.start).padStart(3,'0');
    if(serialized.includes(runId)){
      dispatched.push({state:'EXISTS',runId,batchStart:batch.start});
      continue;
    }

    const payload={
      runId,
      leafId,
      leafName,
      contractVersion:'amazon-demand-validation-v1',
      specialist:'AGT-RESEARCH-VALIDATION-001',
      candidateAsins:batch.asins
    };
    const instruction='[AMAZON_DEMAND_VALIDATION_V1] '+JSON.stringify(payload);
    const response=await fetch(UP+'/api/v1/commands',{
      method:'POST',
      headers:{'content-type':'application/json','accept':'application/json'},
      body:JSON.stringify({teamId:'RUN-004',priority:'high',modelBudgetCents:2,instruction}),
      signal:AbortSignal.timeout(5000)
    });
    const body=await response.text();
    if(!response.ok){
      throw Object.assign(new Error('FACTORY_COORDINATOR_DISPATCH_FAILED'),{kind:'FACTORY_COORDINATOR',statusCode:response.status,detail:body.slice(0,500)});
    }
    let created={}; try{created=JSON.parse(body);}catch{}
    const nextCommandId=created?.command?.commandId||null;
    if(!nextCommandId)throw Object.assign(new Error('FACTORY_COORDINATOR_COMMAND_ACK_MISSING'),{kind:'FACTORY_COORDINATOR'});

    dispatched.push({state:'DISPATCHED',nextCommandId,runId,batchStart:batch.start,candidateCount:batch.asins.length});
    console.log(JSON.stringify({
      event:'FACTORY_COORDINATOR_DISPATCHED',
      sourceCommandId,nextCommandId,workflow:'amazon-demand-validation-v1',
      leafId,leafName,batchStart:batch.start,candidateCount:batch.asins.length,runId
    }));

    void fetch('http://amazon-demand-validator-v1:8793/run',{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({expectedCommandId:nextCommandId}),
      signal:AbortSignal.timeout(300000)
    }).then(async r=>{
      const detail=(await r.text()).slice(0,800);
      console.log(JSON.stringify({
        event:r.ok?'FACTORY_COORDINATOR_EXECUTOR_COMPLETED':'FACTORY_COORDINATOR_EXECUTOR_FAILED',
        workflow:'amazon-demand-validation-v1',nextCommandId,status:r.status,detail
      }));
    }).catch(error=>{
      console.error(JSON.stringify({
        event:'FACTORY_COORDINATOR_EXECUTOR_ERROR',
        workflow:'amazon-demand-validation-v1',nextCommandId,error:String(error?.message||error)
      }));
    });
  }
  return {state:'COORDINATED',workflow:'amazon-demand-validation-v1',leafId,sourceCommandId,batches:dispatched};
}

const server=http.createServer(async(req,res)=>{
  try{
    const chunks=[];
    let total=0;

    for await(const chunk of req){
      total+=chunk.length;
      if(total>2000000)throw new Error('REQUEST_TOO_LARGE');
      chunks.push(chunk);
    }

    const body=Buffer.concat(chunks);
    const pathname=String(req.url||'/').split('?')[0];

    if(req.method==='POST'&&pathname==='/api/v1/worker/receipts'){
      let receipt=null;
      try{receipt=JSON.parse(body.toString('utf8'));}catch{}

      if(receipt){
        try{
          const governance=await verifyGovernedReceipt(receipt);
          console.log(JSON.stringify({
            event:'FACTORY_GOVERNANCE_VERIFIED',
            commandId:governance.commandId,
            workerId:governance.workerId,
            teamId:governance.teamId
          }));
          const persistedKind=await persistBeforeReceipt(receipt);
          await coordinateAfterPersistence(receipt,governance,persistedKind);
        }catch(error){
          return reply(res,503,{
            error:'CANONICAL_STAGE_PERSISTENCE_FAILED',
            stage:error.kind||null,
            commandId:receipt.commandId||null,
            status:error.statusCode||null
          });
        }
      }
    }

    const headers={...req.headers};
    delete headers.host;
    delete headers.connection;
    delete headers['content-length'];

    const init={
      method:req.method,
      headers,
      signal:AbortSignal.timeout(35000)
    };

    if(!['GET','HEAD'].includes(req.method))init.body=body;

    const upstream=await fetch(UP+req.url,init);
    const out=Buffer.from(await upstream.arrayBuffer());
    const responseHeaders={};

    for(const [key,value] of upstream.headers){
      if(!['connection','transfer-encoding','content-length','keep-alive'].includes(key.toLowerCase())){
        responseHeaders[key]=value;
      }
    }

    responseHeaders['content-length']=String(out.length);
    res.writeHead(upstream.status,responseHeaders);
    res.end(req.method==='HEAD'?undefined:out);
  }catch(error){
    console.error(JSON.stringify({
      event:'PROXY_ERROR',
      error:String(error?.message||error)
    }));

    if(!res.headersSent)reply(res,502,{error:'WORK_CONTROL_PROXY_ERROR'});
    else res.end();
  }
});

server.listen(8787,'0.0.0.0',()=>{
  console.log(JSON.stringify({
    service:'work-control-persistence-gateway',
    status:'ready',
    port:8787
  }));
});
