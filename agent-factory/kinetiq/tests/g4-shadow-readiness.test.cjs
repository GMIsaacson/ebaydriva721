'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const contract=JSON.parse(fs.readFileSync(path.join(root,'g4-shadow-contract.json'),'utf8'));
const receipt=JSON.parse(fs.readFileSync(path.join(root,'g4','g4-readiness-receipt.json'),'utf8'));

test('Kinetiq G4 requires ten real professional shadow cases',()=>{
  assert.equal(contract.minimumCaseCount,10);
  assert.ok(contract.caseRequirements.includes('real identifiable business'));
  assert.ok(contract.caseRequirements.includes('model/runtime provenance'));
  assert.equal(contract.passThresholds.minimumCases,10);
  assert.equal(contract.passThresholds.professionalAgreementRate,0.9);
});

test('assistant or fixture substitution is explicitly prohibited',()=>{
  assert.ok(contract.prohibitedSubstitutions.some(x=>/assistant-authored/.test(x)));
  assert.ok(contract.prohibitedSubstitutions.some(x=>/deterministic fixtures/.test(x)));
  assert.ok(contract.prohibitedSubstitutions.some(x=>/synthetic businesses/.test(x)));
});

test('G4 is fail-closed until specialist execution and independent comparison exist',()=>{
  assert.equal(receipt.decision,'BLOCKED');
  assert.equal(receipt.terminalState,'BLOCKED_FACTORY_CAPABILITY');
  assert.equal(receipt.realShadowCasesCompleted,0);
  assert.ok(receipt.reasonCodes.includes('SPECIALIST_EXECUTION_RUNTIME_MISSING'));
  assert.ok(receipt.reasonCodes.includes('TEN_REAL_SHADOW_CASES_NOT_EXECUTED'));
  assert.ok(receipt.reasonCodes.includes('INDEPENDENT_PROFESSIONAL_COMPARISON_NOT_EXECUTED'));
});

test('blocked G4 used zero external authority',()=>{
  assert.equal(receipt.externalActionsPerformed,0);
  assert.equal(receipt.spendCents,0);
  assert.equal(receipt.deploymentsPerformed,0);
});
