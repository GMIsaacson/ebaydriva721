'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const program=JSON.parse(fs.readFileSync(path.join(root,'calibration','freight-q3-reviewer-qualification-v1.json'),'utf8'));
const registry=JSON.parse(fs.readFileSync(path.join(root,'..','governance','specialist-registry-v1.0.json'),'utf8'));

test('freight Q3 reviewer qualification matches all gold cases and Q2 audit',()=>{
  assert.equal(program.specialistId,'SPC-FREIGHT-Q3-001');
  assert.equal(program.roleType,'REVIEWER_ONLY');
  assert.equal(program.qualificationResult,'QUALIFIED');
  assert.equal(program.calibrationCases.length,3);
  for(const c of program.calibrationCases){
    assert.equal(c.result,'PASS',c.caseId);
    assert.equal(c.actualOutcome,c.goldOutcome,c.caseId);
  }
  assert.equal(program.aggregateQ2.result,'QUALIFICATION_Q2_PASS');
});

test('registered freight Q3 reviewer is qualified, independent and reviewer-only',()=>{
  const r=registry.records.find(x=>x.specialistId==='SPC-FREIGHT-Q3-001');
  assert.ok(r,'SPC-FREIGHT-Q3-001 missing');
  assert.equal(r.qualificationState,'QUALIFIED');
  assert.equal(r.eligibleAsReviewer,true);
  assert.ok(r.allowedTaskClasses.includes('Q3-freight-review'));
  for(const x of ['freight-authoring','self-review','production-mutation','supplier-contact','purchase']){
    assert.ok(r.excludedTaskClasses.includes(x),'missing exclusion '+x);
  }
  const author=registry.records.find(x=>x.specialistId==='SPC-FREIGHT-001');
  assert.ok(author);
  assert.equal(author.eligibleAsReviewer,false);
  assert.ok(author.excludedTaskClasses.includes('independent-review'));
});

test('reviewer calibration receipts preserve zero authority',()=>{
  for(const file of ['freight-q3-reviewer-a.receipt.json','freight-q3-reviewer-b.receipt.json','freight-q3-reviewer-c.receipt.json']){
    const r=JSON.parse(fs.readFileSync(path.join(root,'calibration',file),'utf8'));
    assert.equal(r.result,'PASS');
    assert.equal(r.authorityUsage.externalActions,0);
    assert.equal(r.authorityUsage.spendCents,0);
    assert.equal(r.authorityUsage.productionMutation,false);
  }
});
