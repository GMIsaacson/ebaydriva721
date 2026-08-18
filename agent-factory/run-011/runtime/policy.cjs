'use strict';

const FIXED = Object.freeze({
  runId: 'OPP-INTEL-011', gate: 'G4', workflowId: 'WF-OIT-011-G4-001', workflowVersion: '1.0.0',
  boundaryContract: 'B0-OIT-011-v1.0', maxCandidates: 10, maxSupportingSources: 3,
  escalationScore: 80, watchScore: 65, minEvidenceStrength: 3,
});
const PROHIBITED_ACTIONS = new Set(['send_message','contact_prospect','contact_vendor','publish','purchase','subscribe','activate_paid_tool','activate_schedule','create_account','submit_form','deploy_production','canonical_portfolio_write','change_portfolio_stage','change_portfolio_priority']);
const RATING_FIELDS = ['speedToRevenue','strategicFit','automationPotential','evidenceStrength','revenuePotential','executionEffort','asyncOperability','defensibility'];
const validRating = (value) => Number.isInteger(value) && value >= 1 && value <= 5;
function calculateScore(ratings) {
  if (!ratings || RATING_FIELDS.some((field) => !validRating(ratings[field]))) throw new Error('all OIT dimension ratings must be integers 1-5');
  const total = (ratings.speedToRevenue/5)*20 + (ratings.strategicFit/5)*15 + (ratings.automationPotential/5)*15 + (ratings.evidenceStrength/5)*15 + (ratings.revenuePotential/5)*15 + ((6-ratings.executionEffort)/5)*10 + (ratings.asyncOperability/5)*5 + (ratings.defensibility/5)*5;
  return Number(total.toFixed(2));
}
function validateCandidate(candidate) {
  const v=[]; if(!candidate||typeof candidate!=='object')return ['candidate must be an object'];
  if(typeof candidate.candidateId!=='string'||candidate.candidateId.length<5)v.push('candidateId missing');
  if(!candidate.source||candidate.source.status!=='Active')v.push('source must be Active');
  if(typeof candidate.source?.registryId!=='string'||candidate.source.registryId.length<4)v.push('source registry identity missing');
  if(!Array.isArray(candidate.evidenceRefs)||candidate.evidenceRefs.length===0)v.push('evidence reference missing');
  if((candidate.supportingSourceCount??0)>FIXED.maxSupportingSources)v.push('supporting source limit exceeded');
  if(!candidate.factsAssumptionsSeparated)v.push('facts and assumptions must be separated');
  if(!candidate.ratings||RATING_FIELDS.some((field)=>!validRating(candidate.ratings[field])))v.push('invalid OIT ratings');
  if(!['Unique','Duplicate','Material Variant','Needs Review'].includes(candidate.duplicateDisposition))v.push('duplicate disposition missing');
  if(typeof candidate.nextTest!=='string'||candidate.nextTest.trim().length<8)v.push('reversible next test missing');
  return [...new Set(v)];
}
function validateEnvelope(packet) {
  const v=[]; if(!packet||typeof packet!=='object')return ['packet must be an object'];
  if(packet.runId!==FIXED.runId||packet.gate!==FIXED.gate)v.push('wrong run or gate');
  if(packet.workflowId!==FIXED.workflowId||packet.workflowVersion!==FIXED.workflowVersion)v.push('wrong workflow contract');
  if(packet.boundaryContract!==FIXED.boundaryContract)v.push('wrong boundary contract');
  const c=packet.control||{}; if(c.manualOnly!==true)v.push('manual-only control removed');
  if(c.scheduleEnabled!==false||c.webhookEnabled!==false)v.push('trigger expansion');
  if(c.maxExternalActions!==0)v.push('external actions enabled'); if(c.maxCanonicalPortfolioWrites!==0)v.push('canonical portfolio writes enabled');
  if(c.maxPaidToolCostUsd!==0)v.push('paid-tool cost enabled'); if(c.maxAiCalls!==0)v.push('AI calls enabled at G4'); if(c.retryOnUnknownOutcome!==false)v.push('unsafe blind retry enabled');
  if(!Array.isArray(packet.candidates))v.push('candidates must be an array'); else { if(packet.candidates.length>FIXED.maxCandidates)v.push('candidate limit exceeded'); packet.candidates.forEach((candidate,index)=>validateCandidate(candidate).forEach((x)=>v.push(`candidate ${index}: ${x}`))); }
  for(const action of Array.isArray(packet.requestedActions)?packet.requestedActions:[]){const n=String(action).toLowerCase();v.push(PROHIBITED_ACTIONS.has(n)?'prohibited action requested: '+action:'G4 requestedActions must be empty');}
  return [...new Set(v)];
}
function routeCandidate(candidate, score) { if(candidate.fatalRisk===true)return 'Blocked'; if(candidate.duplicateDisposition==='Duplicate')return 'Archive'; if(candidate.duplicateDisposition==='Needs Review')return 'Watch'; if(candidate.ratings.evidenceStrength<FIXED.minEvidenceStrength)return score>=FIXED.watchScore?'Watch':'Archive'; if(score>=FIXED.escalationScore&&['Unique','Material Variant'].includes(candidate.duplicateDisposition))return 'Escalate'; if(score>=FIXED.watchScore)return 'Watch'; return 'Archive'; }
function makeWriteKey(runId,candidateId,targetStore,contractVersion){return [runId,candidateId,targetStore,contractVersion].join('|');}
function retryDecision(outcome){if(outcome==='unknown')return 'read-before-retry';if(outcome==='not_committed')return 'retry-once';return 'no-retry';}
module.exports={FIXED,PROHIBITED_ACTIONS,RATING_FIELDS,calculateScore,makeWriteKey,retryDecision,routeCandidate,validateCandidate,validateEnvelope};
