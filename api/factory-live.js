'use strict';

const DEFAULT_WORK_CONTROL_STATE_URL = 'https://workcontrol.159-65-169-244.sslip.io/api/v1/state';

function json(res,status,body){
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  return res.status(status).json(body);
}

function processName(title){
  const m=String(title||'').match(/^\[([^\]]+)\]/);
  return m ? m[1] : null;
}

function lastStage(stages){
  const rows=Array.isArray(stages)?stages:[];
  return rows.length ? rows[rows.length-1] : null;
}

function normalize(row){
  const stage=lastStage(row.stages);
  return {
    commandId:String(row.id||''),
    title:row.title||'Untitled work item',
    process:processName(row.title),
    teamId:row.teamId||null,
    teamName:row.teamName||null,
    status:String(row.status||'unknown').toLowerCase(),
    priority:row.priority||null,
    createdAt:row.createdAt||null,
    progress:Number.isFinite(Number(row.progress))?Number(row.progress):null,
    next:row.next||null,
    latestStage:stage ? {
      name:stage.name||null,
      state:stage.state||null,
      detail:stage.detail||null
    } : null,
    stages:Array.isArray(row.stages)?row.stages.map(s=>({
      name:s.name||null,state:s.state||null,detail:s.detail||null
    })):[]
  };
}

module.exports=async function handler(req,res){
  if(req.method!=='GET'){
    res.setHeader('Allow','GET');
    return json(res,405,{ok:false,error:'METHOD_NOT_ALLOWED'});
  }
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),6000);
  try{
    const url=process.env.WORK_CONTROL_STATE_URL||DEFAULT_WORK_CONTROL_STATE_URL;
    const response=await fetch(url,{headers:{accept:'application/json'},signal:controller.signal,cache:'no-store'});
    if(!response.ok) throw Object.assign(new Error('WORK_CONTROL_STATE_HTTP_'+response.status),{status:response.status});
    const state=await response.json();
    const all=(state.work||[]).map(normalize).sort((a,b)=>Date.parse(b.createdAt||0)-Date.parse(a.createdAt||0));
    const active=all.filter(r=>!['completed','blocked','failed','cancelled','canceled'].includes(r.status));
    const sourceMargin=all.filter(r=>r.teamId==='RUN-004'||String(r.process||'').startsWith('AMAZON_'));
    const sourceMarginActive=sourceMargin.filter(r=>!['completed','blocked','failed','cancelled','canceled'].includes(r.status));
    return json(res,200,{
      ok:true,
      fetchedAt:new Date().toISOString(),
      connection:state.connection||null,
      meta:state.meta||null,
      metrics:{
        total:all.length,
        active:active.length,
        sourceMargin:sourceMargin.length,
        sourceMarginActive:sourceMarginActive.length,
        blocked:all.filter(r=>r.status==='blocked').length
      },
      active:active.slice(0,30),
      sourceMarginActive:sourceMarginActive.slice(0,30),
      recent:all.slice(0,50),
      sourceMarginRecent:sourceMargin.slice(0,50)
    });
  }catch(error){
    return json(res,error.status||503,{ok:false,error:error.message||'WORK_CONTROL_STATE_UNAVAILABLE'});
  }finally{
    clearTimeout(timer);
  }
};
