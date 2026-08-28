#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SUPPORTED_CHECKS = new Set(['required_fields', 'cross_document_equal', 'required_url', 'regex', 'freshness', 'array_min_length', 'selected_max_score']);

function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function getPath(object, dottedPath) {
  const parts = String(dottedPath || '').split('.').filter(Boolean); let current = object;
  for (const part of parts) { if (current === null || current === undefined || typeof current !== 'object' || !(part in current)) return undefined; current = current[part]; }
  return current;
}
function evidenceLabel(manifest) {
  return String(manifest.identityLabel || manifest.runLabel || manifest.testId || 'TEST').replace(/[^A-Za-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').toUpperCase() || 'TEST';
}
function executeCheck(check, packet, context = {}) {
  if (!check || typeof check !== 'object') throw new Error('capability check definition is required');
  if (!SUPPORTED_CHECKS.has(check.type)) throw new Error(`unsupported check type: ${check.type}`);
  if (check.type === 'required_fields') {
    const document = getPath(packet, check.document); if (!document || typeof document !== 'object') return {status:'FAIL',observed:{missingDocument:check.document}};
    const missing=(check.fields||[]).filter((field)=>{const value=document[field];return value===undefined||value===null||String(value).trim()==='';});
    return {status:missing.length?'FAIL':'PASS',observed:{document:check.document,missing}};
  }
  if (check.type === 'cross_document_equal') {
    const left=getPath(packet,check.left),right=getPath(packet,check.right); return {status:left!==undefined&&right!==undefined&&left===right?'PASS':'FAIL',observed:{left,right}};
  }
  if (check.type === 'required_url') {
    const value=getPath(packet,check.path),valid=typeof value==='string'&&/^https:\/\//i.test(value); return {status:valid?'PASS':'FAIL',observed:{path:check.path,value:value??null}};
  }
  if (check.type === 'regex') {
    const value=getPath(packet,check.path),expression=new RegExp(check.pattern); return {status:typeof value==='string'&&expression.test(value)?'PASS':'FAIL',observed:{path:check.path,value:value??null}};
  }
  if (check.type === 'freshness') {
    const raw=getPath(packet,check.path),asOf=new Date(context.asOf||packet.asOf||Date.now()),observed=new Date(raw);
    if(!raw||Number.isNaN(asOf.getTime())||Number.isNaN(observed.getTime()))return {status:'FAIL',observed:{path:check.path,value:raw??null,reason:'invalid-date'}};
    const ageDays=Math.floor((asOf.getTime()-observed.getTime())/86400000);return {status:ageDays<=Number(check.maxAgeDays)?'PASS':'FAIL',observed:{path:check.path,value:raw,ageDays,maxAgeDays:Number(check.maxAgeDays)}};
  }
  if (check.type === 'array_min_length') {
    const value=getPath(packet,check.path),min=Number(check.min); const length=Array.isArray(value)?value.length:null;
    return {status:Array.isArray(value)&&Number.isInteger(min)&&length>=min?'PASS':'FAIL',observed:{path:check.path,length,min}};
  }
  if (check.type === 'selected_max_score') {
    const records=getPath(packet,check.recordsPath),selectedId=getPath(packet,check.selectedIdPath),idField=check.idField||'id',scoreField=check.scoreField||'score';
    if(!Array.isArray(records)||records.length===0||selectedId===undefined)return {status:'FAIL',observed:{reason:'missing-records-or-selection'}};
    const selected=records.find(r=>r&&r[idField]===selectedId),scores=records.map(r=>Number(r&&r[scoreField])).filter(Number.isFinite),maxScore=scores.length?Math.max(...scores):null;
    const selectedScore=selected?Number(selected[scoreField]):null; return {status:!!selected&&Number.isFinite(selectedScore)&&selectedScore===maxScore?'PASS':'FAIL',observed:{selectedId,selectedScore,maxScore,recordCount:records.length}};
  }
  throw new Error(`unsupported check type: ${check.type}`);
}
function runTeam(manifest, packet, options = {}) {
  if(!manifest||typeof manifest!=='object')throw new Error('manifest is required');
  if(manifest.topologyMode==='hybrid')throw new Error('hybrid topologies require a run-specific runtime; the generic runner is synthetic legacy validation only');
  if(manifest.externalAuthority!=='None')throw new Error('synthetic runner requires externalAuthority=None');
  if(!manifest.authority||Number(manifest.authority.maxExternalActions)!==0||Number(manifest.authority.maxSpendCents)!==0)throw new Error('synthetic runner requires zero external-action and spend authority');
  const capabilityAgents=(manifest.agents||[]).filter(a=>a.role==='capability'),qaAgents=(manifest.agents||[]).filter(a=>a.role==='qa');
  if(capabilityAgents.length<2)throw new Error('at least two capability agents are required'); if(qaAgents.length!==1)throw new Error('exactly one independent QA agent is required');
  const startedAt=options.now||new Date().toISOString(),packetHash=sha256(JSON.stringify(packet)),label=evidenceLabel(manifest);
  const results=capabilityAgents.map((agent,index)=>{const result=executeCheck(agent.check,packet,options);return {agentId:agent.id,capabilityId:agent.capabilityId,status:result.status,evidenceId:`EV-${label}-${String(index+1).padStart(3,'0')}`,observed:result.observed,externalActionsPerformed:0,spendCents:0};});
  const evidenceComplete=results.every(r=>typeof r.evidenceId==='string'&&r.evidenceId.length>0),authorityClean=results.every(r=>r.externalActionsPerformed===0&&r.spendCents===0),allPassed=results.every(r=>r.status==='PASS');
  const qa={agentId:qaAgents[0].id,status:evidenceComplete&&authorityClean?'PASS':'FAIL',evidenceComplete,authorityClean,unsupportedSuccessClaims:0};
  return {schemaVersion:'1.1',governanceMode:manifest.governanceMode||(manifest.runId?'RUN':'TEST'),runId:manifest.runId||null,testId:manifest.testId||null,teamId:manifest.teamId,packetSha256:packetHash,startedAt,terminalState:allPassed&&qa.status==='PASS'?'DELIVERED':'FAILED',capabilityResults:results,qa,externalActionsPerformed:0,spendCents:0};
}
function writeRunAtomic(manifest,packet,outFile,options={}){const result=runTeam(manifest,packet,options),target=path.resolve(outFile),dir=path.dirname(target);fs.mkdirSync(dir,{recursive:true});const temp=`${target}.tmp-${process.pid}-${Date.now()}`;try{fs.writeFileSync(temp,`${JSON.stringify(result,null,2)}\n`);fs.renameSync(temp,target);return result;}catch(error){fs.rmSync(temp,{force:true});throw error;}}
function main(){const argv=process.argv.slice(2),mi=argv.indexOf('--manifest'),pi=argv.indexOf('--packet'),oi=argv.indexOf('--out');if(mi<0||pi<0||oi<0||!argv[mi+1]||!argv[pi+1]||!argv[oi+1]){console.error('Usage: node team-runner.cjs --manifest <team-manifest.json> --packet <packet.json> --out <run-receipt.json>');process.exit(2);}try{const manifest=JSON.parse(fs.readFileSync(argv[mi+1],'utf8')),packet=JSON.parse(fs.readFileSync(argv[pi+1],'utf8')),result=writeRunAtomic(manifest,packet,argv[oi+1]);console.log(JSON.stringify({status:result.terminalState==='DELIVERED'?'PASS':'FAIL',terminalState:result.terminalState,runId:result.runId,testId:result.testId}));process.exit(result.terminalState==='DELIVERED'?0:1);}catch(error){console.error(JSON.stringify({status:'BLOCKED',error:error.message}));process.exit(2);}}
if(require.main===module)main();module.exports={SUPPORTED_CHECKS,getPath,evidenceLabel,executeCheck,runTeam,writeRunAtomic};
