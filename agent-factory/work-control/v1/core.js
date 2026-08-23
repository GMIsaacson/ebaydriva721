(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports){module.exports=api;}else{root.WorkControlCore=api;}
})(typeof self!=='undefined'?self:this,function(){
  const ALLOWED_PRIORITIES=['low','normal','high','urgent'];
  const APPROVAL_DECISIONS=['approved','rejected'];
  function normalizeText(value,max=5000){return String(value??'').replace(/\s+/g,' ').trim().slice(0,max);}
  function createRunRequest({teamId,teamName,instruction,priority='normal',now=new Date().toISOString()}){
    const cleanInstruction=normalizeText(instruction,2000);
    if(!teamId||!teamName) throw new Error('TEAM_REQUIRED');
    if(cleanInstruction.length<3) throw new Error('INSTRUCTION_REQUIRED');
    if(!ALLOWED_PRIORITIES.includes(priority)) throw new Error('INVALID_PRIORITY');
    const stamp=String(now).replace(/[-:.TZ]/g,'').slice(0,14);
    return {id:`LOCAL-${stamp}`,teamId,teamName,title:cleanInstruction.length>72?`${cleanInstruction.slice(0,69)}...`:cleanInstruction,instruction:cleanInstruction,priority,status:'queued',source:'local-draft',createdAt:now,progress:10,next:'Connect execution adapter',stages:[{name:'Request staged',state:'done',detail:'Saved in browser'},{name:'Factory dispatch',state:'blocked',detail:'Execution adapter disconnected'}],result:{summary:'Not executed',detail:'This request exists only in the local Work Control prototype. No Factory run was claimed.'}};
  }
  function applyApproval(approval,decision,now=new Date().toISOString()){
    if(!approval||!approval.id) throw new Error('APPROVAL_REQUIRED');
    if(!APPROVAL_DECISIONS.includes(decision)) throw new Error('INVALID_DECISION');
    if(approval.status!=='pending') throw new Error('APPROVAL_ALREADY_DECIDED');
    const updated={...approval,status:decision,decidedAt:now,transmitted:false};
    const event={id:`H-${approval.id}-${String(now).replace(/[-:.TZ]/g,'').slice(0,14)}`,at:now,title:`Approval ${decision}`,detail:`${approval.title} — local decision record only; authority was not transmitted to the Factory.`,type:'approval'};
    return {approval:updated,event};
  }
  function dispatchGuard(adapterConnected){if(adapterConnected!==true)return{allowed:false,reason:'EXECUTION_ADAPTER_DISCONNECTED'};return{allowed:true,reason:'ADAPTER_CONNECTED'};}
  function summarize(state){
    const work=Array.isArray(state?.work)?state.work:[];const teams=Array.isArray(state?.teams)?state.teams:[];const approvals=Array.isArray(state?.approvals)?state.approvals:[];
    return{readyTeams:teams.filter(t=>t.readiness==='Ready').length,running:work.filter(w=>w.status==='running').length,blocked:work.filter(w=>w.status==='blocked').length,pendingApprovals:approvals.filter(a=>a.status==='pending').length,completed:work.filter(w=>w.status==='completed').length};
  }
  function percentFromStages(stages){if(!Array.isArray(stages)||stages.length===0)return 0;const weights={done:1,active:.5,blocked:.25,queued:0};return Math.round((stages.reduce((sum,s)=>sum+(weights[s.state]??0),0)/stages.length)*100);}
  return{ALLOWED_PRIORITIES,APPROVAL_DECISIONS,normalizeText,createRunRequest,applyApproval,dispatchGuard,summarize,percentFromStages};
});
