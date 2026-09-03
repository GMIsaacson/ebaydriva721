'use strict';
const {calculateScore,evaluateRoute,makeWriteKey,retryDecision,validateEnvelope}=require('./policy.cjs');
const {GATE_VERSION,evaluateAdversarialCandidate,makePromotionReceipt}=require('./adversarial-gate-v1.cjs');

function blockedEnvelope(packet, violations, promotionControl) {
  const candidatesIn=Array.isArray(packet?.candidates)?packet.candidates.length:0;
  return{runId:packet?.runId||null,gate:packet?.gate||null,status:'Blocked',violations,results:[],summary:{candidatesIn,escalated:0,watched:0,archived:0,blocked:candidatesIn,duplicatesSuppressed:0,promotionEligible:0},promotionControl,incrementalCostUsd:0,externalActions:0,canonicalPortfolioWrites:0,aiCalls:0};
}

function processPacket(packet){
 const adversarialMode=packet?.adversarialGateVersion===GATE_VERSION;
 const promotionControl=adversarialMode?'ADVERSARIAL_GATE_V1':'LEGACY_REPLAY_NOT_PROMOTION_ELIGIBLE';
 const violations=validateEnvelope(packet);
 if(packet?.adversarialGateVersion!==undefined&&!adversarialMode)violations.push('unsupported adversarial gate version');
 if(violations.length)return blockedEnvelope(packet,[...new Set(violations)],promotionControl);
 const seen=new Set(),results=[];let duplicatesSuppressed=0;
 for(const candidate of packet.candidates){
  const score=calculateScore(candidate.ratings);
  if(candidate.claimedScore!==undefined&&Number(candidate.claimedScore)!==score){results.push({candidateId:candidate.candidateId,status:'Blocked',reason:'score_mismatch',deterministicScore:score,promotionEligible:false});continue;}

  let routeDecision;
  let adversarialEvaluation=null;
  let promotionReceipt=null;
  if(adversarialMode){
    adversarialEvaluation=evaluateAdversarialCandidate(candidate);
    if(!adversarialEvaluation.valid){
      results.push({candidateId:candidate.candidateId,status:'Blocked',reason:adversarialEvaluation.reason,violations:adversarialEvaluation.violations||[],deterministicScore:score,weakestLinkScore:adversarialEvaluation.weakestLinkScore??null,promotionDecision:adversarialEvaluation.promotionDecision||candidate.adversarialGate?.promotionDecision||null,promotionEligible:false});
      continue;
    }
    if(candidate.routerRecommendation!==adversarialEvaluation.routeCeiling){
      results.push({candidateId:candidate.candidateId,status:'Blocked',reason:'promotion_decision_router_mismatch',deterministicScore:score,weakestLinkScore:adversarialEvaluation.weakestLinkScore,promotionDecision:adversarialEvaluation.promotionDecision,requestedRoute:candidate.routerRecommendation,allowedRoute:adversarialEvaluation.routeCeiling,promotionEligible:false});
      continue;
    }
    if(adversarialEvaluation.promotionDecision==='ADVANCE'){
      routeDecision=evaluateRoute(candidate,score);
      if(!routeDecision.valid){
        results.push({candidateId:candidate.candidateId,status:'Blocked',reason:routeDecision.reason,deterministicScore:score,weakestLinkScore:adversarialEvaluation.weakestLinkScore,promotionDecision:adversarialEvaluation.promotionDecision,requestedRoute:candidate.routerRecommendation,promotionEligible:false});
        continue;
      }
    }else{
      routeDecision={route:adversarialEvaluation.routeCeiling,valid:true};
    }
    promotionReceipt=makePromotionReceipt(candidate.candidateId,adversarialEvaluation);
  }else{
    routeDecision=evaluateRoute(candidate,score);
    if(!routeDecision.valid){results.push({candidateId:candidate.candidateId,status:'Blocked',reason:routeDecision.reason,deterministicScore:score,requestedRoute:candidate.routerRecommendation,promotionEligible:false});continue;}
  }

  const route=routeDecision.route;
  if(candidate.duplicateDisposition==='Duplicate')duplicatesSuppressed++;
  const targetStore=route==='Escalate'?'OIT Escalation Queue':'OIT Candidate Queue';
  const writeKey=makeWriteKey(packet.runId,candidate.candidateId,targetStore,packet.workflowVersion);
  if(seen.has(writeKey)){results.push({candidateId:candidate.candidateId,status:'NoOp',reason:'idempotent_replay',deterministicScore:score,route,writeKey,promotionEligible:false});continue;}
  seen.add(writeKey);
  results.push({candidateId:candidate.candidateId,status:'Pass',deterministicScore:score,route,duplicateDisposition:candidate.duplicateDisposition,writeKey,nextTest:candidate.nextTest,promotionDecision:adversarialEvaluation?.promotionDecision||null,weakestLinkScore:adversarialEvaluation?.weakestLinkScore??null,assumptionSummary:adversarialEvaluation?.assumptionSummary||null,promotionEligible:adversarialEvaluation?.promotionEligible===true,promotionReceipt});
 }
 const count=(route)=>results.filter((x)=>x.status==='Pass'&&x.route===route).length;const blocked=results.filter((x)=>x.status==='Blocked').length;const promotionEligible=results.filter((x)=>x.status==='Pass'&&x.promotionEligible===true).length;
 return{runId:packet.runId,gate:packet.gate,workflowId:packet.workflowId,workflowVersion:packet.workflowVersion,boundaryContract:packet.boundaryContract,status:blocked?'Warning':'Pass',violations:[],results,summary:{candidatesIn:packet.candidates.length,escalated:count('Escalate'),watched:count('Watch'),archived:count('Archive'),blocked,duplicatesSuppressed,promotionEligible},promotionControl,controls:{manualOnly:true,scheduleEnabled:false,webhookEnabled:false,retryPolicyForUnknownOutcome:retryDecision('unknown')},incrementalCostUsd:0,externalActions:0,canonicalPortfolioWrites:0,aiCalls:0};
}
module.exports={processPacket};
