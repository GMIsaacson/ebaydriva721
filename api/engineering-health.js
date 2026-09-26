'use strict';
const { REPOS, summarize } = require('./engineering-health-model.cjs');
const { verifyFirebaseIdToken } = require('./n8n-control');
const CONTROL_BASE = (process.env.WORKFLOW_CONTROL_BASE_URL || 'https://workcontrol.159-65-169-244.sslip.io/workflows').replace(/\\/+$/, '');
const API = 'https://api.github.com';
function json(res,status,body){res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');return res.status(status).json(body);}
async function limitedFetch(url, headers, timeout = 8500) {
  const c = new AbortController(), timer = setTimeout(() => c.abort(), timeout);
  try { return await fetch(url,{headers,cache:'no-store',signal:c.signal}); } finally { clearTimeout(timer); }
}
async function authOwner(req) {
  const a = String(req.headers.authorization || '');
  if (!a.startsWith('Bearer ') || !a.slice(7).trim()) throw Object.assign(new Error('AUTH_REQUIRED'),{status:401});
  const token = a.slice(7).trim();
  try { await verifyFirebaseIdToken(token); } catch { throw Object.assign(new Error('AUTH_INVALID'),{status:401}); }
  const response = await limitedFetch(CONTROL_BASE+'/api/owner',{Authorization:'Bearer '+token,Accept:'application/json'});
  if (!response.ok) throw Object.assign(new Error('OWNER_CHECK_UNAVAILABLE'),{status:503});
  const owner = await response.json();
  if (!owner.isOwner) throw Object.assign(new Error('OWNER_REQUIRED'),{status:403});
}
async function github(path, token) {
  const res = await limitedFetch(API+path,{
    Authorization:'Bearer '+token,Accept:'application/vnd.github+json',
    'X-GitHub-Api-Version':'2022-11-28','User-Agent':'SourceMargin-Engineering-Health'
  });
  if (!res.ok) throw new Error('GITHUB_HTTP_'+res.status);
  return res.json();
}
async function paged(repo, resource, token) {
  const all = [];
  for (let page=1; page<=4; page++) {
    const rows=await github('/repos/'+repo+'/'+resource+'?state=open&per_page=100&page='+page,token);
    if(!Array.isArray(rows)) throw new Error('GITHUB_MALFORMED_RESPONSE');
    all.push(...rows);
    if(rows.length<100) return {rows:all,truncated:false};
  }
  return {rows:all,truncated:true};
}
async function oneRepo(repo, token, now) {
  try {
    const [prs,issues]=await Promise.all([paged(repo.name,'pulls',token),paged(repo.name,'issues',token)]);
    // Only the bounded active queue needs per-PR checks; never swamp API with historical stacks.
    const active=prs.rows.filter(p=>!(repo.name==='GMIsaacson/sourcemargin1.0' && p.number<=53)
      && !(repo.name==='GMIsaacson/ebaydriva721' && p.base?.ref!=='master')).slice(0,12);
    const pairs=await Promise.all(active.map(async p=>{
      const [reviews,checks]=await Promise.all([
        github('/repos/'+repo.name+'/pulls/'+p.number+'/reviews?per_page=100',token).catch(()=>null),
        github('/repos/'+repo.name+'/commits/'+p.head.sha+'/check-runs?per_page=100',token).then(x=>x.check_runs||null).catch(()=>null)
      ]);
      return [p.number,{reviews,checkRuns:checks}];
    }));
    const summary=summarize(repo,prs.rows,issues.rows,now,Object.fromEntries(pairs));
    return {...summary,truncated:prs.truncated||issues.truncated,
      checksScope:active.length<prs.rows.filter(p=>!(repo.name==='GMIsaacson/sourcemargin1.0'&&p.number<=53)&&!(repo.name==='GMIsaacson/ebaydriva721'&&p.base?.ref!=='master')).length?'FIRST_12_ACTIVE':'ALL_ACTIVE'};
  } catch(error) {return {repo:repo.name,label:repo.label,branch:repo.main,status:'unavailable',error:error.message};}
}
module.exports = async function handler(req,res){
  if(req.method!=='GET'){res.setHeader('Allow','GET');return json(res,405,{ok:false,error:'METHOD_NOT_ALLOWED'});}
  try {
    await authOwner(req);
    const token=process.env.SOURCEMARGIN_GITHUB_TOKEN || process.env.GITHUB_TOKEN;
    if(!token) return json(res,503,{ok:false,error:'GITHUB_CREDENTIAL_NOT_CONFIGURED'});
    const now=Date.now(), repos=await Promise.all(REPOS.map(repo=>oneRepo(repo,token,now)));
    return json(res,200,{ok:repos.some(r=>r.status==='connected'),source:'GitHub REST API (owner gated; read only)',
      fetchedAt:new Date(now).toISOString(),repos,notes:['Legacy stacked PRs are reported separately, not safe-to-merge suggestions.',
      'Regression and technical-debt counts include only labeled open issues; unlabeled work is not represented.',
      'Unknown CI/review state is not treated as passing.','Test coverage and deployment verification are not available from this endpoint.']});
  } catch(e){return json(res,e.status||503,{ok:false,error:e.message||'ENGINEERING_HEALTH_UNAVAILABLE'});}
};
