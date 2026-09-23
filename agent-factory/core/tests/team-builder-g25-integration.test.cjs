'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const builder = require('../team-builder.cjs');

function request(decidedAt, extra = {}) {
  return {
    teamName: 'Professional Gate Integration Team',
    purpose: 'Prove the Factory cannot manufacture a post-cutover RUN without professional capability completeness.',
    domain: 'professional-gate-integration',
    governance: {
      mode: 'RUN',
      a0Decision: {
        decisionId: 'A0-G25-INTEGRATION-001',
        status: 'PASS',
        verdict: 'NEW',
        owner: 'Business owner',
        decidedAt,
        reuseEvidence: ['Factory Core reviewed'],
        residualUnownedLoop: 'Integration proof only.',
      },
    },
    existingRunNumbers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 16],
    reservedRunNumbers: [13],
    authority: { maxExternalActions: 0, maxSpendCents: 0, deploy: false },
    capabilities: ['analysis', 'review'],
    ...extra,
  };
}

const strongMatrix = [{
  stageId: 'analysis',
  workProduct: 'Professional analysis',
  requiredDisciplines: ['domain-analysis'],
  assignedSpecialists: ['domain-analysis'],
  evidenceStandards: ['source-backed reasoning'],
  qa: {
    type: 'professional_excellence',
    disciplines: ['domain-analysis'],
    acceptanceCriteria: ['senior-practitioner quality'],
    independent: true,
  },
}];

test('pre-cutover RUN remains explicit G2.5_PENDING rather than silently grandfathered', () => {
  const compiled = builder.compileTeam(request('2026-08-28'));
  assert.equal(compiled.manifest.professionalCapabilityGate.status, 'G2.5_PENDING');
  assert(compiled.manifest.gates.includes('G2.5'));
  assert.equal(compiled.contract.professionalCapabilityStatus, 'G2.5_PENDING');
});

test('post-cutover RUN without a professional capability matrix fails closed', () => {
  assert.throws(
    () => builder.compileTeam(request('2026-08-29')),
    /G2\.5 Professional Capability Completeness BLOCKED/,
  );
});

test('post-cutover RUN with specialist coverage and professional QA passes G2.5', () => {
  const compiled = builder.compileTeam(request('2026-08-29', { professionalCapabilities: strongMatrix }));
  assert.equal(compiled.manifest.professionalCapabilityGate.status, 'PASS');
  assert.equal(compiled.receipt.professionalCapabilityStatus, 'PASS');
  assert(compiled.contract.inputs.includes('professional_capability_matrix_v1'));
});

test('post-cutover RUN with generic-agent substitution fails closed', () => {
  const weak = JSON.parse(JSON.stringify(strongMatrix));
  weak[0].assignedSpecialists = ['generic-agent'];
  assert.throws(
    () => builder.compileTeam(request('2026-08-29', { professionalCapabilities: weak })),
    /G2\.5 Professional Capability Completeness BLOCKED/,
  );
});
