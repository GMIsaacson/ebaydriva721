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
const SALE_OBSERVATION_READ=process.env.SALE_OBSERVATION_READ_URL||'https://aittnuqrrenkencygfje.supabase.co/functions/v1/amazon-sale-observation-read-v1';
const ROUTE_CONTRACT_PERSIST=process.env.ROUTE_CONTRACT_PERSIST_URL||'https://aittnuqrrenkencygfje.supabase.co/functions/v1/amazon-route-contract-v1';
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
  'amazon-listing-evidence-v1':'[AMAZON_LISTING_EVIDENCE_V1]',
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

async function workControlCommand(commandId){
  const response=await fetch(UP+'/api/v1/commands/'+encodeURIComponent(commandId),{method:'GET',headers:{'accept':'application/json'},signal:AbortSignal.timeout(5000)});
  if(!response.ok)return null;
  return response.json();
}

const workflowQueues=new Map();
function enqueueWorkflow(key,fn){
  const prior=workflowQueues.get(key)||Promise.resolve();
  const next=prior.catch(()=>{}).then(fn);
  workflowQueues.set(key,next.finally(()=>{if(workflowQueues.get(key)===next)workflowQueues.delete(key);}));
  return next;
}

async function createGovernedCommand({workflow,runId,marker,payload,budget=2,priority='high'}){
  const state=await workControlState();
  const serialized=JSON.stringify(state?.work||[]);
  if(runId&&serialized.includes(runId)){
    console.log(JSON.stringify({event:'FACTORY_COORDINATOR_IDEMPOTENT',workflow,runId}));
    return {state:'EXISTS',commandId:null,runId};
  }
  const instruction=marker+' '+JSON.stringify(payload);
  if(Buffer.byteLength(instruction,'utf8')>1950){
    throw Object.assign(new Error('FACTORY_COORDINATOR_INSTRUCTION_TOO_LONG'),{kind:'FACTORY_COORDINATOR',workflow,bytes:Buffer.byteLength(instruction,'utf8')});
  }
  const response=await fetch(UP+'/api/v1/commands',{
    method:'POST',
    headers:{'content-type':'application/json','accept':'application/json'},
    body:JSON.stringify({teamId:'RUN-004',priority,modelBudgetCents:budget,instruction}),
    signal:AbortSignal.timeout(5000)
  });
  const body=await response.text();
  if(!response.ok)throw Object.assign(new Error('FACTORY_COORDINATOR_DISPATCH_FAILED'),{kind:'FACTORY_COORDINATOR',workflow,statusCode:response.status,detail:body.slice(0,500)});
  let created={};try{created=JSON.parse(body);}catch{}
  const commandId=created?.command?.commandId||null;
  if(!commandId)throw Object.assign(new Error('FACTORY_COORDINATOR_COMMAND_ACK_MISSING'),{kind:'FACTORY_COORDINATOR',workflow});
  console.log(JSON.stringify({event:'FACTORY_COORDINATOR_DISPATCHED',workflow,runId,commandId}));
  return {state:'DISPATCHED',commandId,runId};
}

async function executeMicroWorker({workflow,serviceUrl,commandId}){
  if(!commandId)return {state:'NOOP'};
  const response=await fetch(serviceUrl,{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({expectedCommandId:commandId}),
    signal:AbortSignal.timeout(300000)
  });
  const body=await response.text();
  console.log(JSON.stringify({
    event:response.ok?'FACTORY_COORDINATOR_EXECUTOR_COMPLETED':'FACTORY_COORDINATOR_EXECUTOR_FAILED',
    workflow,commandId,status:response.status,detail:body.slice(0,800)
  }));
  if(!response.ok)throw Object.assign(new Error('FACTORY_COORDINATOR_EXECUTOR_FAILED'),{kind:'FACTORY_COORDINATOR',workflow,statusCode:response.status,detail:body.slice(0,800)});
  return {state:'COMPLETED',commandId};
}

async function dispatchRun(spec){
  return enqueueWorkflow(spec.workflow,async()=>{
    const created=await createGovernedCommand(spec);
    if(created.state!=='DISPATCHED')return created;
    await executeMicroWorker({workflow:spec.workflow,serviceUrl:spec.serviceUrl,commandId:created.commandId});
    return created;
  });
}

function suffixFrom(commandId){
  return String(commandId||'').replace(/[^A-Za-z0-9]/g,'').slice(-10).toUpperCase()||'AUTO';
}

function uniqueAsins(rows,key='asin'){
  return [...new Set((Array.isArray(rows)?rows:[]).map(x=>String(x?.[key]||'').trim().toUpperCase()).filter(x=>/^B[A-Z0-9]{9}$/.test(x)))];
}

async function canonicalSaleObservations(leafId,asins){
  if(!asins.length)return [];
  const response=await fetch(SALE_OBSERVATION_READ,{
    method:'POST',
    headers:{'content-type':'application/json','x-source-margin-observe-token':TOKEN},
    body:JSON.stringify({leafId,asins}),
    signal:AbortSignal.timeout(15000)
  });
  const body=await response.text();
  let payload={};try{payload=body?JSON.parse(body):{};}catch{}
  if(!response.ok){
    console.error(JSON.stringify({event:'FACTORY_COORDINATOR_OBSERVATION_READ_FAILED',leafId,status:response.status,detail:body.slice(0,500)}));
    return [];
  }
  return Array.isArray(payload?.observations)?payload.observations:[];
}


async function updateRouteContract({leafId,commercialRoute='RESALE_EXISTING_ASIN',action='ENSURE',sourceCommandId=null,selectionReason=null,terminalReason=null}){
  const response=await fetch(ROUTE_CONTRACT_PERSIST,{
    method:'POST',
    headers:{'content-type':'application/json','x-source-margin-observe-token':TOKEN},
    body:JSON.stringify({
      leafId,commercialRoute,action,sourceCommandId,
      selectedBy:'FACTORY_COORDINATOR',
      selectionReason,terminalReason
    }),
    signal:AbortSignal.timeout(15000)
  });
  const body=await response.text();
  let payload={};try{payload=body?JSON.parse(body):{};}catch{}
  if(!response.ok){
    throw Object.assign(new Error('FACTORY_ROUTE_CONTRACT_PERSIST_FAILED'),{
      kind:'FACTORY_ROUTE_CONTRACT',
      statusCode:response.status,
      detail:body.slice(0,500)
    });
  }
  console.log(JSON.stringify({
    event:'FACTORY_ROUTE_CONTRACT_UPDATED',
    leafId,commercialRoute,action,sourceCommandId,
    contractVersion:payload?.contractVersion||null,
    routeStatus:payload?.routeStatus||null
  }));
  return payload;
}


async function readRouteContract(leafId,commercialRoute='RESALE_EXISTING_ASIN'){
  const response=await fetch(ROUTE_CONTRACT_PERSIST,{
    method:'POST',
    headers:{'content-type':'application/json','x-source-margin-observe-token':TOKEN},
    body:JSON.stringify({leafId,commercialRoute,action:'READ'}),
    signal:AbortSignal.timeout(15000)
  });
  const body=await response.text();
  let payload={};try{payload=body?JSON.parse(body):{};}catch{}
  if(!response.ok){
    throw Object.assign(new Error('FACTORY_ROUTE_CONTRACT_READ_FAILED'),{
      kind:'FACTORY_ROUTE_CONTRACT',
      statusCode:response.status,
      detail:body.slice(0,500)
    });
  }
  return payload?.record||null;
}

async function assertAutoStagePermitted(leafId,stage,commercialRoute='RESALE_EXISTING_ASIN'){
  const contract=await readRouteContract(leafId,commercialRoute);
  const routeStatus=String(contract?.route_status||'UNKNOWN').toUpperCase();
  const requirement=String(contract?.stage_requirements?.[stage]||'UNDECLARED').toUpperCase();
  if(routeStatus!=='ACTIVE'){
    throw Object.assign(new Error('FACTORY_ROUTE_NOT_ACTIVE'),{
      kind:'FACTORY_ROUTE_CONTRACT',
      leafId,commercialRoute,stage,requirement,routeStatus
    });
  }
  if(!['REQUIRED','CONDITIONAL'].includes(requirement)){
    throw Object.assign(new Error('FACTORY_ROUTE_STAGE_NOT_AUTO_PERMITTED'),{
      kind:'FACTORY_ROUTE_CONTRACT',
      leafId,commercialRoute,stage,requirement,routeStatus
    });
  }
  return {contract,requirement,routeStatus};
}

async function coordinateAfterPersistence(receipt,governance,persistedKind){
  const contract=String(receipt?.stageResult?.contractVersion||'');
  const outcome=String(receipt?.stageResult?.outcome||'').toUpperCase();
  const leafId=String(receipt?.stageResult?.leafId||'').trim();
  const sourceCommandId=String(receipt?.commandId||'').trim();
  if(outcome&&outcome!=='PASS')return null;
  if(!leafId)return null;

  // 1) Canonical census -> bounded demand validation -> listing evidence.
  if(contract==='amazon-leaf-census-v2'){
    const sourcePayload=parseCommandPayload(governance.command,'[AMAZON_LEAF_CENSUS_V2]');
    const leafName=String(sourcePayload.leafName||'Unknown Leaf').trim().slice(0,120);
    // Establish explicit route contract before resale downstream work.
    await updateRouteContract({leafId,commercialRoute:'RESALE_EXISTING_ASIN',action:'ENSURE',sourceCommandId,selectionReason:'Factory selected existing-ASIN resale evaluation after canonical census.'});
    const candidates=uniqueAsins(receipt?.stageResult?.candidates);
    if(!candidates.length){
      console.log(JSON.stringify({event:'FACTORY_COORDINATOR_BRANCH_TERMINAL',workflow:'amazon-demand-validation-v1',leafId,reason:'NO_CENSUS_ASINS'}));
      return null;
    }
    const sourceSuffix=suffixFrom(sourceCommandId);
    const batchSize=10;
    for(let start=0;start<candidates.length;start+=batchSize){
      const asins=candidates.slice(start,start+batchSize);
      const batchTag='B'+String(start).padStart(3,'0');
      await assertAutoStagePermitted(leafId,'DEMAND_VALIDATION');
      const demandRunId='SM-AMZ-DEMAND-'+leafId+'-'+sourceSuffix+'-'+batchTag;
      const demand=await dispatchRun({
        workflow:'amazon-demand-validation-v1',
        runId:demandRunId,
        marker:'[AMAZON_DEMAND_VALIDATION_V1]',
        payload:{
          runId:demandRunId,leafId,leafName,
          contractVersion:'amazon-demand-validation-v1',
          specialist:'AGT-RESEARCH-VALIDATION-001',
          sourceCensusCommandId,
          candidateAsins:asins
        },
        budget:2,
        serviceUrl:'http://amazon-demand-validator-v1:8793/run'
      });
      if(!demand.commandId)continue;
      await assertAutoStagePermitted(leafId,'LISTING_EVIDENCE');
      const evidenceRunId='SM-AMZ-LIST-EVID-'+leafId+'-'+sourceSuffix+'-'+batchTag;
      await dispatchRun({
        workflow:'amazon-listing-evidence-v1',
        runId:evidenceRunId,
        marker:'[AMAZON_LISTING_EVIDENCE_V1]',
        payload:{
          runId:evidenceRunId,leafId,leafName,
          contractVersion:'amazon-listing-evidence-v1',
          specialist:'AGT-AMAZON-LISTING-CLASSIFIER-001',
          sourceCensusCommandId,
          demandValidationCommandId:demand.commandId,
          targetAsins:asins
        },
        budget:2,
        serviceUrl:'http://amazon-listing-evidence-v1:8807/run'
      });
    }
    return {state:'COORDINATED',workflow:'census-to-demand-and-listing-evidence',leafId};
  }

  // 2) Listing evidence -> deterministic listing classification.
  if(contract==='amazon-listing-evidence-v1'){
    const sr=receipt.stageResult||{};
    const evidence=Array.isArray(sr.evidence)?sr.evidence:[];
    if(!evidence.length)return null;
    const leafName=String(parseCommandPayload(governance.command,'[AMAZON_LISTING_EVIDENCE_V1]').leafName||'Unknown Leaf').trim().slice(0,120);
    const candidateFacts=evidence.map(row=>[
      String(row.asin||'').toUpperCase(),
      row.brandName||null,
      row.sellerName||null,
      String(row.signalCode||'UN').toUpperCase(),
      Number(row.confidencePct||35)
    ]);
    await assertAutoStagePermitted(leafId,'LISTING_CLASSIFICATION');
    const runId='SM-AMZ-LIST-CLASS-'+leafId+'-'+suffixFrom(sourceCommandId);
    await dispatchRun({
      workflow:'amazon-listing-classification-v1',
      runId,
      marker:'[AMAZON_LISTING_CLASSIFICATION_V1]',
      payload:{
        runId,leafId,leafName,
        contractVersion:'amazon-listing-classification-v1',
        specialist:'AGT-AMAZON-LISTING-CLASSIFIER-001',
        sourceCensusCommandId:sr.sourceCensusCommandId||null,
        demandValidationCommandId:sr.demandValidationCommandId||null,
        listingEvidenceCommandId:sourceCommandId,
        evidenceRef:sourceCommandId,
        candidateFacts
      },
      budget:2,
      serviceUrl:'http://amazon-listing-classifier-v1:8795/run'
    });
    return {state:'COORDINATED',workflow:'amazon-listing-classification-v1',leafId};
  }

  // 3) Classification + completed demand -> targeted supplier discovery.
  if(contract==='amazon-listing-classification-v1'){
    const commandPayload=parseCommandPayload(governance.command,'[AMAZON_LISTING_CLASSIFICATION_V1]');
    const demandId=String(commandPayload.demandValidationCommandId||'');
    const censusId=String(commandPayload.sourceCensusCommandId||'');
    if(!demandId||!censusId){
      console.log(JSON.stringify({event:'FACTORY_COORDINATOR_WAITING',workflow:'amazon-supplier-discovery-v2',leafId,reason:'LINEAGE_MISSING'}));
      return null;
    }
    const demandRecord=await workControlCommand(demandId);
    if(demandRecord?.receipt?.terminalState!=='DELIVERED'){
      console.log(JSON.stringify({event:'FACTORY_COORDINATOR_WAITING',workflow:'amazon-supplier-discovery-v2',leafId,reason:'DEMAND_RECEIPT_NOT_READY',demandId}));
      return null;
    }
    const classifications=Array.isArray(receipt?.stageResult?.classifications)?receipt.stageResult.classifications:[];
    const eligible=classifications
      .filter(row=>!['STOP_NO_JUMP_ON','DEEP_CLASSIFICATION_REQUIRED'].includes(String(row?.sourcingRoute||'')))
      .map(row=>String(row?.asin||'').toUpperCase())
      .filter(x=>/^B[A-Z0-9]{9}$/.test(x))
      .slice(0,20);
    if(!eligible.length){
      await updateRouteContract({
        leafId,
        commercialRoute:'RESALE_EXISTING_ASIN',
        action:'STOP',
        sourceCommandId,
        selectionReason:'Existing-ASIN resale route evaluated through listing classification.',
        terminalReason:'NO_ROUTE_ELIGIBLE_ASINS'
      });
      console.log(JSON.stringify({event:'FACTORY_COORDINATOR_BRANCH_TERMINAL',workflow:'amazon-supplier-discovery-v2',leafId,reason:'NO_ROUTE_ELIGIBLE_ASINS'}));
      return null;
    }
    const leafName=String(commandPayload.leafName||'Unknown Leaf').trim().slice(0,120);
    await assertAutoStagePermitted(leafId,'SUPPLIER_DISCOVERY');
    const runId='SM-AMZ-SUPPLIER-'+leafId+'-'+suffixFrom(sourceCommandId);
    await dispatchRun({
      workflow:'amazon-supplier-discovery-v2',
      runId,
      marker:'[AMAZON_SUPPLIER_DISCOVERY_V2]',
      payload:{
        runId,leafId,leafName,
        contractVersion:'amazon-supplier-discovery-v2',
        specialist:'SPC-SOURCE-001',
        asinDiscoveryCommandId:censusId,
        demandValidationCommandId:demandId,
        listingClassificationCommandId:sourceCommandId,
        excludeAsins:[],
        targetAsins:eligible,
        selectionScope:'COMMERCIAL_TRIAGE'
      },
      budget:10,
      serviceUrl:'http://amazon-supplier-discovery-v2:8796/run'
    });
    return {state:'COORDINATED',workflow:'amazon-supplier-discovery-v2',leafId};
  }

  // 4) Supplier discovery -> PP equivalence for ASINs that actually have supplier candidates.
  if(contract==='amazon-supplier-discovery-v2'){
    const commandPayload=parseCommandPayload(governance.command,'[AMAZON_SUPPLIER_DISCOVERY_V2]');
    const classificationId=String(commandPayload.listingClassificationCommandId||'');
    if(!classificationId)return null;
    const targetAsins=uniqueAsins(receipt?.stageResult?.candidates).slice(0,20);
    if(!targetAsins.length){
      console.log(JSON.stringify({event:'FACTORY_COORDINATOR_BRANCH_TERMINAL',workflow:'amazon-pp-equivalence-v1',leafId,reason:'NO_SUPPLIER_CANDIDATES'}));
      return null;
    }
    const leafName=String(commandPayload.leafName||'Unknown Leaf').trim().slice(0,120);
    await assertAutoStagePermitted(leafId,'PP_EQUIVALENCE');
    const runId='SM-AMZ-PP-EQ-'+leafId+'-'+suffixFrom(sourceCommandId);
    await dispatchRun({
      workflow:'amazon-pp-equivalence-v1',
      runId,
      marker:'[AMAZON_PP_EQUIVALENCE_V1]',
      payload:{
        runId,leafId,leafName,
        contractVersion:'amazon-pp-equivalence-v1',
        specialist:'SPC-PP-EQUIV-001',
        listingClassificationCommandId:classificationId,
        supplierDiscoveryCommandIds:[sourceCommandId],
        targetAsins
      },
      budget:10,
      serviceUrl:'http://amazon-pp-equivalence-v1:8797/run'
    });
    return {state:'COORDINATED',workflow:'amazon-pp-equivalence-v1',leafId};
  }

  // 5) PP equivalence -> exact-pack commercial validity and/or case-break procurement.
  if(contract==='amazon-pp-equivalence-v1'){
    const commandPayload=parseCommandPayload(governance.command,'[AMAZON_PP_EQUIVALENCE_V1]');
    const leafName=String(commandPayload.leafName||'Unknown Leaf').trim().slice(0,120);
    const rows=Array.isArray(receipt?.stageResult?.results)?receipt.stageResult.results:[];
    const exact=[...new Set(rows.filter(r=>r?.verdict==='EXACT_MATCH'&&r?.channelEligibility==='ELIGIBLE').map(r=>String(r.asin||'').toUpperCase()))].slice(0,20);
    const caseBreak=[...new Set(rows.filter(r=>r?.verdict==='EXACT_PRODUCT_CASE_BREAK_REQUIRED'&&r?.channelEligibility==='ELIGIBLE').map(r=>String(r.asin||'').toUpperCase()))].slice(0,20);
    if(exact.length){
      await assertAutoStagePermitted(leafId,'SUPPLIER_COMMERCIAL_VALIDITY');
      const runId='SM-AMZ-COMM-'+leafId+'-'+suffixFrom(sourceCommandId);
      await dispatchRun({
        workflow:'amazon-supplier-commercial-validity-v1',
        runId,
        marker:'[AMAZON_SUPPLIER_COMMERCIAL_VALIDITY_V1]',
        payload:{runId,leafId,leafName,contractVersion:'amazon-supplier-commercial-validity-v1',specialist:'SPC-SOURCE-001',ppEquivalenceCommandId:sourceCommandId,targetAsins:exact},
        budget:10,
        serviceUrl:'http://amazon-supplier-commercial-validity-v1:8798/run'
      });
    }
    if(caseBreak.length){
      await assertAutoStagePermitted(leafId,'CASE_BREAK_PROCUREMENT');
      const runId='SM-AMZ-CASE-BREAK-'+leafId+'-'+suffixFrom(sourceCommandId);
      await dispatchRun({
        workflow:'amazon-case-break-procurement-v1',
        runId,
        marker:'[AMAZON_CASE_BREAK_PROCUREMENT_V1]',
        payload:{runId,leafId,leafName,contractVersion:'amazon-case-break-procurement-v1',specialist:'SPC-CASE-BREAK-001',ppEquivalenceCommandId:sourceCommandId,targetAsins:caseBreak},
        budget:10,
        serviceUrl:'http://amazon-case-break-procurement-v1:8804/run'
      });
    }
    if(!exact.length&&!caseBreak.length){
      console.log(JSON.stringify({event:'FACTORY_COORDINATOR_BRANCH_TERMINAL',workflow:'procurement',leafId,reason:'NO_EQUIVALENCE_ELIGIBLE_CANDIDATES'}));
    }
    return {state:'COORDINATED',workflow:'pp-to-procurement',leafId,exact:exact.length,caseBreak:caseBreak.length};
  }

  // 6a) Commercial validity -> landed cost.
  if(contract==='amazon-supplier-commercial-validity-v1'){
    const commandPayload=parseCommandPayload(governance.command,'[AMAZON_SUPPLIER_COMMERCIAL_VALIDITY_V1]');
    const leafName=String(commandPayload.leafName||'Unknown Leaf').trim().slice(0,120);
    const eligible=[...new Set((receipt?.stageResult?.results||[]).filter(r=>r?.orderability==='ORDERABLE_NOW').map(r=>String(r.asin||'').toUpperCase()))].slice(0,20);
    if(!eligible.length){
      console.log(JSON.stringify({event:'FACTORY_COORDINATOR_BRANCH_TERMINAL',workflow:'amazon-landed-cost-v1',leafId,reason:'NO_ORDERABLE_COMMERCIAL_CANDIDATES'}));
      return null;
    }
    await assertAutoStagePermitted(leafId,'LANDED_COST');
    const runId='SM-AMZ-LANDED-'+leafId+'-'+suffixFrom(sourceCommandId);
    await dispatchRun({
      workflow:'amazon-landed-cost-v1',
      runId,
      marker:'[AMAZON_LANDED_COST_V1]',
      payload:{runId,leafId,leafName,contractVersion:'amazon-landed-cost-v1',specialist:'SPC-LANDED-COST-001',commercialValidityCommandId:sourceCommandId,targetAsins:eligible},
      budget:10,
      serviceUrl:'http://amazon-landed-cost-v1:8799/run'
    });
    return {state:'COORDINATED',workflow:'amazon-landed-cost-v1',leafId};
  }

  // 6b) Case-break procurement -> landed cost.
  if(contract==='amazon-case-break-procurement-v1'){
    const commandPayload=parseCommandPayload(governance.command,'[AMAZON_CASE_BREAK_PROCUREMENT_V1]');
    const leafName=String(commandPayload.leafName||'Unknown Leaf').trim().slice(0,120);
    const eligible=[...new Set((receipt?.stageResult?.results||[]).filter(r=>r?.orderability==='ORDERABLE_CASE_BREAK').map(r=>String(r.asin||'').toUpperCase()))].slice(0,20);
    if(!eligible.length){
      console.log(JSON.stringify({event:'FACTORY_COORDINATOR_BRANCH_TERMINAL',workflow:'amazon-landed-cost-v1',leafId,reason:'NO_ORDERABLE_CASE_BREAK_CANDIDATES'}));
      return null;
    }
    const runId='SM-AMZ-LANDED-'+leafId+'-'+suffixFrom(sourceCommandId);
    await dispatchRun({
      workflow:'amazon-landed-cost-v1',
      runId,
      marker:'[AMAZON_LANDED_COST_V1]',
      payload:{runId,leafId,leafName,contractVersion:'amazon-landed-cost-v1',specialist:'SPC-LANDED-COST-001',caseBreakProcurementCommandId:sourceCommandId,targetAsins:eligible},
      budget:10,
      serviceUrl:'http://amazon-landed-cost-v1:8799/run'
    });
    return {state:'COORDINATED',workflow:'amazon-landed-cost-v1',leafId};
  }

  // 7) Landed cost -> Economics, but only with fresh canonical observation UUIDs.
  if(contract==='amazon-landed-cost-v1'){
    const commandPayload=parseCommandPayload(governance.command,'[AMAZON_LANDED_COST_V1]');
    const leafName=String(commandPayload.leafName||'Unknown Leaf').trim().slice(0,120);
    const asins=[...new Set((receipt?.stageResult?.results||[]).filter(r=>Number.isFinite(Number(r?.knownCostFloorUsd))).map(r=>String(r.asin||'').toUpperCase()))].slice(0,20);
    if(!asins.length){
      console.log(JSON.stringify({event:'FACTORY_COORDINATOR_BRANCH_TERMINAL',workflow:'amazon-economics-v1',leafId,reason:'NO_COST_FLOOR_READY_CANDIDATES'}));
      return null;
    }
    const observations=await canonicalSaleObservations(leafId,asins);
    if(!observations.length){
      console.log(JSON.stringify({event:'FACTORY_COORDINATOR_WAITING',workflow:'amazon-economics-v1',leafId,reason:'NO_FRESH_CANONICAL_SALE_OBSERVATIONS',asins}));
      return null;
    }
    await assertAutoStagePermitted(leafId,'ECONOMICS');
    const runId='SM-AMZ-ECON-'+leafId+'-'+suffixFrom(sourceCommandId);
    await dispatchRun({
      workflow:'amazon-economics-v1',
      runId,
      marker:'[AMAZON_ECONOMICS_V1]',
      payload:{runId,leafId,leafName,contractVersion:'amazon-economics-v1',specialist:'SPC-ECON-001',landedCostCommandId:sourceCommandId,saleObservations:observations.map(o=>({asin:o.asin,observationId:o.observationId,observedPriceUsd:o.observedPriceUsd,sourceUrl:o.sourceUrl,observedAt:o.observedAt}))},
      budget:2,
      serviceUrl:'http://amazon-economics-v1:8800/run'
    });
    return {state:'COORDINATED',workflow:'amazon-economics-v1',leafId};
  }

  if(contract==='amazon-economics-v1'){
    const rows=Array.isArray(receipt?.stageResult?.results)?receipt.stageResult.results:[];
    const allTerminal=rows.length>0&&rows.every(r=>r?.terminal===true);
    const allKilled=allTerminal&&rows.every(r=>String(r?.disposition||'').startsWith('KILL_'));
    if(allKilled){
      await updateRouteContract({
        leafId,
        commercialRoute:'RESALE_EXISTING_ASIN',
        action:'STOP',
        sourceCommandId,
        selectionReason:'Existing-ASIN resale route reached Economics.',
        terminalReason:[...new Set(rows.map(r=>String(r?.disposition||'KILL')))].join(',')
      });
    }else if(allTerminal){
      await updateRouteContract({
        leafId,
        commercialRoute:'RESALE_EXISTING_ASIN',
        action:'COMPLETE',
        sourceCommandId,
        selectionReason:'Existing-ASIN resale route reached terminal Economics evaluation.',
        terminalReason:[...new Set(rows.map(r=>String(r?.disposition||'TERMINAL')))].join(',')
      });
    }
    console.log(JSON.stringify({event:'FACTORY_COORDINATOR_BRANCH_COMPLETE',workflow:'amazon-economics-v1',leafId,commandId:sourceCommandId,counts:receipt?.stageResult?.counts||null}));
    return {state:allKilled?'STOPPED':'COMPLETE',workflow:'amazon-economics-v1',leafId};
  }

  return null;
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

    let coordinatorContext=null;
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
          coordinatorContext={receipt,governance,persistedKind};
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

    if(coordinatorContext&&upstream.ok){
      void coordinateAfterPersistence(
        coordinatorContext.receipt,
        coordinatorContext.governance,
        coordinatorContext.persistedKind
      ).catch(error=>{
        console.error(JSON.stringify({
          event:'FACTORY_COORDINATOR_ERROR',
          commandId:coordinatorContext.receipt?.commandId||null,
          error:String(error?.message||error),
          workflow:error?.workflow||null,
          status:error?.statusCode||null
        }));
      });
    }

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
