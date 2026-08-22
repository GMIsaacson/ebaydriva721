#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cp = require('child_process');

function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function mkdir(p) { fs.mkdirSync(p, { recursive: true }); }
function writeJson(file, value) { mkdir(path.dirname(file)); fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n'); }
function writeText(file, value) { mkdir(path.dirname(file)); fs.writeFileSync(file, value); }
function assert(condition, message) { if (!condition) throw new Error(message); }
function hashFile(file) { return sha256(fs.readFileSync(file)); }
function log(role, status, detail) { console.log(JSON.stringify({ role, status, detail })); }

function productSpecAgent(brief, out) {
  assert(brief.status === 'APPROVED', 'brief must be APPROVED');
  assert(brief.validationStatus === 'VALIDATED_INTERNAL', 'brief must be validated');
  assert(brief.runId === 'SW-PROD-014', 'brief must target Run 014');
  assert(Array.isArray(brief.acceptanceCriteria) && brief.acceptanceCriteria.length >= 5, 'acceptance criteria incomplete');
  assert(brief.authorityCeiling && brief.authorityCeiling.externalActions === 0 && brief.authorityCeiling.spendCents === 0 && brief.authorityCeiling.deployments === 0, 'authority ceiling must be zero');
  const spec = {
    schemaVersion: '1.0', handoffType: 'software_spec_v1', specId: 'SPEC-SW-PROD-014-G4-001',
    sourceBriefId: brief.briefId, ownerRole: 'Product Spec Agent',
    functionalRequirements: brief.acceptanceCriteria,
    edgeCases: [
      'missing evidence object', 'failed test evidence', 'failed security review', 'incomplete operations handoff',
      'non-zero external actions', 'non-zero deployments', 'missing artifact hashes', 'explicit blocker present'
    ],
    nonFunctionalRequirements: ['local-only', 'dependency-free', 'read-only', 'deterministic', 'accessible semantic HTML', 'no secrets'],
    traceability: Object.fromEntries(brief.acceptanceCriteria.map((c) => [c.id, ['readiness-core', 'ui-render', 'automated-test']]))
  };
  writeJson(path.join(out, '01-software-spec.json'), spec);
  log('Product Spec Agent', 'PASS', `${spec.functionalRequirements.length} acceptance criteria traced`);
  return spec;
}

function architectAgent(spec, out) {
  const plan = {
    schemaVersion: '1.0', handoffType: 'architecture_plan_v1', architectureId: 'ARCH-SW-PROD-014-G4-001',
    sourceSpecId: spec.specId, ownerRole: 'Software Architect Agent',
    style: 'dependency-free static single-page application',
    components: [
      { name: 'readiness-core.js', responsibility: 'pure deterministic evidence evaluation, shared by browser and Node tests' },
      { name: 'app.js', responsibility: 'load local sample evidence and render summary/blockers' },
      { name: 'index.html', responsibility: 'semantic read-only operator surface' },
      { name: 'styles.css', responsibility: 'local presentation only' },
      { name: 'sample-evidence.json', responsibility: 'non-production fixture' }
    ],
    dataFlow: 'local JSON -> readiness core -> rendered decision; no outbound network path',
    persistence: 'none', integrations: [], dependencies: [], secrets: [], productionData: false,
    rollbackStrategy: 'delete generated release-candidate directory; no state migration exists',
    authority: { externalActions: 0, spendCents: 0, deployments: 0 }
  };
  writeJson(path.join(out, '02-architecture-plan.json'), plan);
  log('Software Architect Agent', 'PASS', 'reuse-first local static architecture selected');
  return plan;
}

function implementationAgent(spec, architecture, out) {
  const source = path.join(out, 'source'); mkdir(source);
  const core = `(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ReadinessCore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){\n  function evaluateEvidence(evidence){\n    const e=evidence||{}; const blockers=[];\n    if(!e.runId) blockers.push('MISSING_RUN_ID');\n    if(!e.gate) blockers.push('MISSING_GATE');\n    if(e.releaseDecision!=='PASS') blockers.push('RELEASE_DECISION_NOT_PASS');\n    if(!e.tests||e.tests.status!=='PASS') blockers.push('TESTS_NOT_PASS');\n    if(!e.security||e.security.status!=='PASS') blockers.push('SECURITY_NOT_PASS');\n    if(!e.opsHandoff||e.opsHandoff.status!=='READY') blockers.push('OPS_HANDOFF_NOT_READY');\n    if(!Array.isArray(e.artifactHashes)||e.artifactHashes.length===0) blockers.push('ARTIFACT_HASHES_MISSING');\n    if(Array.isArray(e.blockers)&&e.blockers.length) blockers.push(...e.blockers.map(b=>'EVIDENCE_BLOCKER:'+String(b)));\n    const a=e.authority||{}; if(Number(a.externalActions||0)!==0) blockers.push('EXTERNAL_ACTIONS_NONZERO');\n    if(Number(a.deployments||0)!==0) blockers.push('DEPLOYMENTS_NONZERO');\n    if(Number(a.spendCents||0)!==0) blockers.push('SPEND_NONZERO');\n    return {ready:blockers.length===0,decision:blockers.length===0?'READY':'BLOCKED',blockers:[...new Set(blockers)]};\n  }\n  return {evaluateEvidence};\n});\n`;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Evidence Readiness Console</title><link rel="stylesheet" href="styles.css"></head><body><main><header><p class="eyebrow">Run 014 · G4 proving assignment</p><h1>Evidence Readiness Console</h1><p>Read-only local release evidence check before Run 008 handoff.</p></header><section aria-labelledby="decision-title"><h2 id="decision-title">Readiness</h2><div id="decision" class="decision">Loading…</div><ul id="blockers"></ul></section><section aria-labelledby="summary-title"><h2 id="summary-title">Evidence summary</h2><dl id="summary"></dl></section><section aria-labelledby="hash-title"><h2 id="hash-title">Artifact hashes</h2><ul id="hashes"></ul></section></main><script src="readiness-core.js"></script><script src="app.js"></script></body></html>`;
  const app = `'use strict';\nasync function load(){const res=await fetch('sample-evidence.json',{cache:'no-store'});const e=await res.json();const r=ReadinessCore.evaluateEvidence(e);document.getElementById('decision').textContent=r.decision;document.getElementById('decision').dataset.state=r.decision;document.getElementById('blockers').innerHTML=r.blockers.map(x=>'<li>'+escapeHtml(x)+'</li>').join('');const rows=[['Run',e.runId],['Gate',e.gate],['Release',e.releaseDecision],['Tests',e.tests&&e.tests.status],['Security',e.security&&e.security.status],['Ops handoff',e.opsHandoff&&e.opsHandoff.status],['External actions',e.authority&&e.authority.externalActions],['Deployments',e.authority&&e.authority.deployments],['Spend cents',e.authority&&e.authority.spendCents]];document.getElementById('summary').innerHTML=rows.map(([k,v])=>'<div><dt>'+escapeHtml(k)+'</dt><dd>'+escapeHtml(String(v??''))+'</dd></div>').join('');document.getElementById('hashes').innerHTML=(e.artifactHashes||[]).map(h=>'<li><code>'+escapeHtml(h)+'</code></li>').join('');}\nfunction escapeHtml(s){return s.replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));}\nload().catch(err=>{document.getElementById('decision').textContent='BLOCKED';document.getElementById('blockers').innerHTML='<li>LOAD_FAILED:'+escapeHtml(err.message)+'</li>';});\n`;
  const css = `:root{font-family:Inter,ui-sans-serif,system-ui,sans-serif;color:#172033;background:#f4f6f8}*{box-sizing:border-box}body{margin:0}main{max-width:900px;margin:0 auto;padding:48px 24px 72px}header{margin-bottom:32px}.eyebrow{text-transform:uppercase;letter-spacing:.12em;font-size:.75rem;font-weight:700;color:#52616f}h1{font-size:clamp(2rem,5vw,3.4rem);margin:.3rem 0}section{background:#fff;border:1px solid #dfe4e8;border-radius:16px;padding:24px;margin-top:18px;box-shadow:0 8px 30px rgba(23,32,51,.05)}.decision{display:inline-block;font-size:1.5rem;font-weight:800;padding:10px 14px;border-radius:10px;background:#eef2f5}.decision[data-state="READY"]{background:#e6f5ec}.decision[data-state="BLOCKED"]{background:#fae9e7}dl>div{display:grid;grid-template-columns:180px 1fr;gap:16px;padding:10px 0;border-bottom:1px solid #edf0f2}dt{font-weight:700}dd{margin:0}code{word-break:break-all}@media(max-width:600px){dl>div{grid-template-columns:1fr;gap:4px}}`;
  const fixture = {
    runId: 'SW-PROD-014', gate: 'G4', releaseDecision: 'PASS',
    tests: { status: 'PASS', passed: 7, failed: 0 }, security: { status: 'PASS', criticalFindings: 0 },
    opsHandoff: { status: 'READY', target: 'Run 008' }, blockers: [],
    artifactHashes: ['sha256:example-release-candidate-hash'],
    authority: { externalActions: 0, deployments: 0, spendCents: 0 }
  };
  const files = { 'index.html': html, 'readiness-core.js': core, 'app.js': app, 'styles.css': css, 'sample-evidence.json': JSON.stringify(fixture, null, 2)+'\n' };
  for (const [name, content] of Object.entries(files)) writeText(path.join(source, name), content);
  const changeSet = {
    schemaVersion: '1.0', handoffType: 'implementation_change_set_v1', changeSetId: 'IMPL-SW-PROD-014-G4-001',
    sourceSpecId: spec.specId, sourceArchitectureId: architecture.architectureId, ownerRole: 'Implementation Agent',
    files: Object.keys(files).map(name => ({ path: name, sha256: hashFile(path.join(source, name)) })),
    externalActionsPerformed: 0, spendCents: 0, deploymentsPerformed: 0
  };
  writeJson(path.join(out, '03-implementation-change-set.json'), changeSet);
  log('Implementation Agent', 'PASS', `${changeSet.files.length} source files generated in non-production workspace`);
  return { source, changeSet };
}

function testEngineeringAgent(source, out) {
  const testFile = path.resolve(__dirname, '..', 'tests', 'g4-generated-app.test.cjs');
  const proc = cp.spawnSync(process.execPath, ['--test', testFile], { env: { ...process.env, G4_SOURCE_DIR: source }, encoding: 'utf8' });
  const evidence = {
    schemaVersion: '1.0', handoffType: 'test_evidence_v1', evidenceId: 'TEST-SW-PROD-014-G4-001', ownerRole: 'Test Engineering Agent',
    status: proc.status === 0 ? 'PASS' : 'FAIL', command: `node --test ${path.relative(process.cwd(), testFile)}`,
    stdoutSha256: sha256(proc.stdout || ''), stderrSha256: sha256(proc.stderr || ''), exitCode: proc.status,
    externalActionsPerformed: 0, spendCents: 0
  };
  writeText(path.join(out, '04-test-output.txt'), (proc.stdout || '') + (proc.stderr || ''));
  writeJson(path.join(out, '04-test-evidence.json'), evidence);
  assert(evidence.status === 'PASS', 'automated tests failed');
  log('Test Engineering Agent', 'PASS', 'independent generated-app test suite passed');
  return evidence;
}

function securityAgent(source, out) {
  const files = fs.readdirSync(source).filter(n => fs.statSync(path.join(source,n)).isFile());
  const findings = [];
  for (const name of files) {
    const text = fs.readFileSync(path.join(source,name),'utf8');
    if (/https?:\/\//i.test(text)) findings.push({severity:'HIGH',file:name,rule:'EXTERNAL_URL'});
    if (/\beval\s*\(|new\s+Function\s*\(/.test(text)) findings.push({severity:'HIGH',file:name,rule:'DYNAMIC_CODE_EXECUTION'});
    if (/(api[_-]?key|password|secret)\s*[:=]\s*['\"][^'\"]+/i.test(text)) findings.push({severity:'CRITICAL',file:name,rule:'POSSIBLE_SECRET'});
  }
  const review = {
    schemaVersion: '1.0', handoffType: 'security_review_v1', reviewId: 'SEC-SW-PROD-014-G4-001', ownerRole: 'Security & Dependency Reviewer',
    status: findings.length === 0 ? 'PASS' : 'FAIL', dependencies: [], secretsRequired: [], productionDataUsed: false,
    findings, criticalFindings: findings.filter(f=>f.severity==='CRITICAL').length,
    externalNetworkDependencies: 0, externalActionsPerformed: 0, spendCents: 0
  };
  writeJson(path.join(out, '05-security-review.json'), review);
  assert(review.status === 'PASS', `security review failed with ${findings.length} findings`);
  log('Security & Dependency Reviewer', 'PASS', '0 findings; 0 dependencies; 0 secrets');
  return review;
}

function releaseAgent(source, tests, security, out) {
  assert(tests.status === 'PASS' && security.status === 'PASS', 'release blocked by verification');
  const releaseDir = path.join(out, 'release-candidate'); mkdir(releaseDir);
  for (const name of fs.readdirSync(source)) fs.copyFileSync(path.join(source,name), path.join(releaseDir,name));
  const hashes = fs.readdirSync(releaseDir).sort().map(name => ({ path: name, sha256: hashFile(path.join(releaseDir,name)) }));
  const release = {
    schemaVersion: '1.0', handoffType: 'release_candidate_v1', releaseId: 'RC-SW-PROD-014-G4-001', ownerRole: 'Release & Handoff Agent',
    version: '0.1.0-g4', status: 'READY_FOR_NONPROD_HANDOFF', files: hashes,
    testEvidenceId: tests.evidenceId, securityReviewId: security.reviewId,
    rollback: 'Remove this release-candidate directory; no persistent state or migration exists.',
    deployed: false, published: false, externalActionsPerformed: 0, spendCents: 0
  };
  writeJson(path.join(out, '06-release-candidate.json'), release);
  writeText(path.join(out, '06-release-notes.md'), '# Evidence Readiness Console 0.1.0-g4\n\nFirst Run 014 G4 non-production proving release. Read-only, local-only, dependency-free. Not deployed.\n');
  writeText(path.join(out, '06-rollback-plan.md'), '# Rollback\n\nDelete the generated release-candidate directory. No database, migration, secret, external service, or production state is touched.\n');
  const handoff = {
    schemaVersion: '1.0', handoffType: 'ops_handoff_v1', handoffId: 'OPS-HO-SW-PROD-014-G4-001', ownerRole: 'Release & Handoff Agent',
    sourceRun: 'SW-PROD-014', targetRun: 'OPS-CORE-008', targetLabel: 'Run 008 Operations Core', status: 'READY',
    releaseId: release.releaseId, verification: {tests:'PASS',security:'PASS'},
    operatingInstructions: ['Serve release-candidate as static files only in an approved non-production environment.', 'Do not add external integrations without new authority.'],
    rollback: release.rollback, unresolvedBlockers: [], authorityRequiredForDeployment: true,
    externalActionsPerformed: 0, deploymentsPerformed: 0, spendCents: 0
  };
  writeJson(path.join(out, '07-ops-handoff.json'), handoff);
  log('Release & Handoff Agent', 'PASS', `${hashes.length} artifacts hashed; Run 008 handoff prepared; not deployed`);
  return { release, handoff };
}

function challengerQaAgent(brief, spec, architecture, implementation, tests, security, releaseResult, out) {
  const handoffFiles = ['01-software-spec.json','02-architecture-plan.json','03-implementation-change-set.json','04-test-evidence.json','05-security-review.json','06-release-candidate.json','07-ops-handoff.json'];
  const missing = handoffFiles.filter(f => !fs.existsSync(path.join(out,f)));
  const criteria = new Set(brief.acceptanceCriteria.map(c=>c.id));
  const traced = new Set(Object.keys(spec.traceability));
  const untraced = [...criteria].filter(id=>!traced.has(id));
  const authorityClean = [implementation.changeSet, tests, security, releaseResult.release, releaseResult.handoff].every(x => Number(x.externalActionsPerformed||0)===0 && Number(x.spendCents||0)===0 && Number(x.deploymentsPerformed||0)===0);
  const checks = {
    handoffChainComplete: missing.length===0, acceptanceTraceComplete: untraced.length===0,
    testsPass: tests.status==='PASS', securityPass: security.status==='PASS', releaseHasHashes: releaseResult.release.files.length>0,
    opsHandoffReady: releaseResult.handoff.status==='READY' && releaseResult.handoff.targetRun==='OPS-CORE-008',
    authorityClean, noDeployment: releaseResult.release.deployed===false
  };
  const pass = Object.values(checks).every(Boolean);
  const receipt = {
    schemaVersion: '1.0', runId: 'SW-PROD-014', gate: 'G4', assignmentId: 'G4-EVIDENCE-READINESS-CONSOLE-001',
    product: 'Evidence Readiness Console', decision: pass ? 'PASS' : 'FAIL', evaluatedAt: new Date().toISOString(),
    ownerRole: 'Challenger / QA Reviewer', checks, missingHandoffs: missing, untracedAcceptanceCriteria: untraced,
    stageEvidence: {
      productBrief: brief.briefId, softwareSpec: spec.specId, architecture: architecture.architectureId,
      implementation: implementation.changeSet.changeSetId, tests: tests.evidenceId, security: security.reviewId,
      releaseCandidate: releaseResult.release.releaseId, opsHandoff: releaseResult.handoff.handoffId
    },
    externalActionsPerformed: 0, spendCents: 0, deploymentsPerformed: 0,
    nextGateOnPass: 'G5', nextGateScope: 'manual shadow / bounded operational rehearsal only'
  };
  writeJson(path.join(out, '08-g4-receipt.json'), receipt);
  assert(pass, 'challenger QA rejected G4 release');
  log('Challenger / QA Reviewer', 'PASS', 'full typed handoff chain verified; G4 PASS');
  return receipt;
}

function main() {
  const args = process.argv.slice(2); const bi=args.indexOf('--brief'); const oi=args.indexOf('--out');
  if (bi<0 || !args[bi+1] || oi<0 || !args[oi+1]) { console.error('Usage: node g4-runner.cjs --brief <brief.json> --out <directory>'); process.exit(2); }
  const briefPath=path.resolve(args[bi+1]); const out=path.resolve(args[oi+1]);
  try {
    fs.rmSync(out,{recursive:true,force:true}); mkdir(out);
    const brief=JSON.parse(fs.readFileSync(briefPath,'utf8')); writeJson(path.join(out,'00-product-brief.json'),brief);
    const spec=productSpecAgent(brief,out); const architecture=architectAgent(spec,out);
    const implementation=implementationAgent(spec,architecture,out); const tests=testEngineeringAgent(implementation.source,out);
    const security=securityAgent(implementation.source,out); const releaseResult=releaseAgent(implementation.source,tests,security,out);
    const receipt=challengerQaAgent(brief,spec,architecture,implementation,tests,security,releaseResult,out);
    console.log(JSON.stringify({runId:receipt.runId,gate:receipt.gate,decision:receipt.decision,assignmentId:receipt.assignmentId,externalActions:0,spendCents:0,deployments:0}));
  } catch (error) {
    const receipt={runId:'SW-PROD-014',gate:'G4',decision:'BLOCKED',error:error.message,externalActionsPerformed:0,spendCents:0,deploymentsPerformed:0};
    try { writeJson(path.join(path.resolve(args[oi+1]||'.'),'08-g4-receipt.json'),receipt); } catch {}
    console.error(JSON.stringify(receipt)); process.exit(1);
  }
}

if(require.main===module) main();
module.exports={productSpecAgent,architectAgent,implementationAgent,testEngineeringAgent,securityAgent,releaseAgent,challengerQaAgent};
