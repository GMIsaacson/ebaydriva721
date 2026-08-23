const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Core=require('../core.js');
const ROOT=path.resolve(__dirname,'..');
const read=name=>fs.readFileSync(path.join(ROOT,name),'utf8');

test('run request stages locally and never claims execution',()=>{
  const req=Core.createRunRequest({teamId:'SW-PROD-014',teamName:'Software Product Engineering',instruction:'Build a bounded internal demo',priority:'high',now:'2026-08-23T02:36:00Z'});
  assert.equal(req.source,'local-draft');
  assert.equal(req.status,'queued');
  assert.equal(req.stages[1].state,'blocked');
  assert.match(req.result.detail,/No Factory run was claimed/);
});

test('dispatch guard fails closed when adapter is disconnected',()=>{
  assert.deepEqual(Core.dispatchGuard(false),{allowed:false,reason:'EXECUTION_ADAPTER_DISCONNECTED'});
  assert.deepEqual(Core.dispatchGuard(undefined),{allowed:false,reason:'EXECUTION_ADAPTER_DISCONNECTED'});
  assert.deepEqual(Core.dispatchGuard(true),{allowed:true,reason:'ADAPTER_CONNECTED'});
});

test('approval decision records local-only non-transmitted state',()=>{
  const approval={id:'A-1',title:'Preview deploy',status:'pending'};
  const {approval:updated,event}=Core.applyApproval(approval,'approved','2026-08-23T02:40:00Z');
  assert.equal(updated.status,'approved');
  assert.equal(updated.transmitted,false);
  assert.match(event.detail,/not transmitted/i);
  assert.equal(approval.status,'pending');
});

test('approval cannot be decided twice',()=>{assert.throws(()=>Core.applyApproval({id:'A-1',title:'x',status:'approved'},'rejected'),/APPROVAL_ALREADY_DECIDED/);});

test('input normalization trims, compacts and bounds instructions',()=>{assert.equal(Core.normalizeText('  alpha   beta\n gamma  ',20),'alpha beta gamma');assert.equal(Core.normalizeText('x'.repeat(50),10).length,10);});

test('summary reports owner-control metrics',()=>{const s=Core.summarize({teams:[{readiness:'Ready'},{readiness:'Review'}],work:[{status:'running'},{status:'blocked'},{status:'completed'}],approvals:[{status:'pending'}]});assert.deepEqual(s,{readyTeams:1,running:1,blocked:1,pendingApprovals:1,completed:1});});

test('runtime contains no remote scripts, fetch, xhr, websocket or beacon APIs',()=>{const runtime=['index.html','core.js','app.js'].map(read).join('\n');assert.doesNotMatch(runtime,/https?:\/\//i);assert.doesNotMatch(runtime,/\bfetch\s*\(/);assert.doesNotMatch(runtime,/XMLHttpRequest|WebSocket|sendBeacon|EventSource/);});

test('runtime has no eval or dynamic Function execution',()=>{const runtime=['core.js','app.js'].map(read).join('\n');assert.doesNotMatch(runtime,/\beval\s*\(|new\s+Function\s*\(/);});

test('UI exposes the six required owner workflows',()=>{const html=read('index.html');for(const label of ['Teams','Work','Approvals','History'])assert.match(html,new RegExp(`>${label}<`));assert.match(html,/Run team/i);const app=read('app.js');assert.match(app,/openWorkDetail/);assert.match(app,/decideApproval/);});

test('allocatable team registry skips reserved run number',()=>{const app=read('app.js');assert.doesNotMatch(app,/Run 013/);assert.match(app,/Run 012/);assert.match(app,/Run 014/);});

test('Factory v0.1 recovery anchor is visible and development line is explicit',()=>{const html=read('index.html'),readme=read('README.md');assert.match(html,/v0\.1 recovery anchor preserved/);assert.match(readme,/develop\/factory-v0\.2/);assert.match(readme,/archive\/factory-v0\.1\.0/);});

test('HTML provides responsive viewport and accessible drawer semantics',()=>{const html=read('index.html');assert.match(html,/name="viewport"/);assert.match(html,/aria-hidden="true"/);assert.match(html,/aria-label="Work Control detail panel"/);});
