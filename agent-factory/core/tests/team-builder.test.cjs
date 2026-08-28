'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const builder = require('../team-builder.cjs');
const runner = require('../team-runner.cjs');

function a0Decision(overrides = {}) {
  return {
    decisionId: 'A0-DOCQA-015',
    status: 'PASS',
    verdict: 'NEW',
    owner: 'Aberdeen Technologies',
    decidedAt: '2026-08-22',
    reuseEvidence: ['Run 007 reviewed', 'Run 014 reviewed'],
    residualUnownedLoop: 'A bounded document-QA loop remains unowned.',
    ...overrides,
  };
}

function baseRequest(overrides = {}) {
  return {
    teamName: 'Document Quality Assurance Team',
    purpose: 'Inspect synthetic business-document packages for completeness, contradictions, unsupported claims, formatting defects, and stale evidence.',
    domain: 'document-quality-assurance',
    governance: { mode: 'TEST', testId: 'F1-ACCEPT-DOCQA-001' },
    existingRunNumbers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14],
    reservedRunNumbers: [13],
    authority: { maxExternalActions: 0, maxSpendCents: 0, deploy: false, allowedActions: ['read synthetic inputs', 'write local evidence'] },
    capabilities: [
      {
        id: 'completeness',
        name: 'Completeness Check',
        responsibility: 'Verify required fields exist in the primary document.',
        check: { type: 'required_fields', document: 'application', fields: ['companyName', 'amount', 'contactEmail'] },
      },
      {
        id: 'consistency',
        name: 'Cross Document Consistency',
        responsibility: 'Verify repeated business facts agree across documents.',
        check: { type: 'cross_document_equal', left: 'application.companyName', right: 'invoice.companyName' },
      },
      {
        id: 'evidence',
        name: 'Evidence Verification',
        responsibility: 'Verify factual claims carry a source URL.',
        check: { type: 'required_url', path: 'claims.sourceUrl' },
      },
      {
        id: 'formatting',
        name: 'Formatting Review',
        responsibility: 'Verify contact fields match the required format.',
        check: { type: 'regex', path: 'application.contactEmail', pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$' },
      },
      {
        id: 'freshness',
        name: 'Evidence Freshness Review',
        responsibility: 'Reject evidence older than the accepted freshness window.',
        check: { type: 'freshness', path: 'claims.verifiedAt', maxAgeDays: 30 },
      },
    ],
    ...overrides,
  };
}

function runRequest(overrides = {}) {
  return baseRequest({
    governance: { mode: 'RUN', a0Decision: a0Decision() },
    ...overrides,
  });
}

function goodPacket() {
  return {
    asOf: '2026-08-22T18:00:00Z',
    application: {
      companyName: 'Northstar Demo LLC',
      amount: '12500',
      contactEmail: 'ops@northstar.example',
    },
    invoice: { companyName: 'Northstar Demo LLC' },
    claims: {
      sourceUrl: 'https://example.test/source/123',
      verifiedAt: '2026-08-20T12:00:00Z',
    },
  };
}

test('TEST mode uses a Test ID and does not mint a Factory Run number', () => {
  const compiled = builder.compileTeam(baseRequest(), { now: '2026-08-22T18:00:00Z' });
  assert.equal(compiled.manifest.governanceMode, 'TEST');
  assert.equal(compiled.manifest.testId, 'F1-ACCEPT-DOCQA-001');
  assert.equal(compiled.manifest.structuralRunCreated, false);
  assert.equal(compiled.manifest.runNumber, null);
  assert.equal(compiled.manifest.runId, null);
  assert.equal(compiled.receipt.status, 'BUILT_TEST_STAGED');
});

test('RUN mode is blocked without a current team-specific A0 decision', () => {
  assert.throws(() => builder.compileTeam(baseRequest({ governance: { mode: 'RUN' } })), /requires a current team-specific A0 decision/);
});

test('RUN mode with current PASS A0 allocates Run 015 and skips reserved Run 013', () => {
  const compiled = builder.compileTeam(runRequest(), { now: '2026-08-22T18:00:00Z' });
  assert.equal(compiled.manifest.runNumber, 15);
  assert.equal(compiled.manifest.runLabel, '015');
  assert.match(compiled.manifest.runId, /015$/);
  assert.equal(compiled.manifest.a0DecisionId, 'A0-DOCQA-015');
  assert.equal(compiled.manifest.structuralRunCreated, true);
});

test('Run 013 cannot be explicitly requested even with valid A0', () => {
  assert.throws(() => builder.compileTeam(runRequest({ requestedRunNumber: 13 })), /permanently reserved/);
});

test('duplicate existing run number fails closed even with valid A0', () => {
  assert.throws(() => builder.compileTeam(runRequest({ requestedRunNumber: 14 })), /already exists/);
});

test('TEST mode cannot request a Factory Run number', () => {
  assert.throws(() => builder.compileTeam(baseRequest({ requestedRunNumber: 15 })), /TEST mode cannot request or allocate/);
});

test('invalid A0 verdict cannot authorize structural creation', () => {
  assert.throws(() => builder.compileTeam(runRequest({ governance: { mode: 'RUN', a0Decision: a0Decision({ verdict: 'REUSE' }) } })), /verdict must be NEW or EXTEND/);
});

test('deployment or external authority is rejected at build time', () => {
  assert.throws(() => builder.compileTeam(baseRequest({
    authority: { maxExternalActions: 1, maxSpendCents: 0, deploy: true, allowedActions: ['deploy'] },
  })), /fail-closed/);
});

test('ambiguous request without purpose is rejected', () => {
  assert.throws(() => builder.compileTeam(baseRequest({ purpose: '' })), /purpose is required/);
});

test('neutral-domain TEST build contains no eBay or Alibaba template leakage', () => {
  const compiled = builder.compileTeam(baseRequest(), { now: '2026-08-22T18:00:00Z' });
  const text = JSON.stringify(compiled).toLowerCase();
  assert.equal(text.includes('ebay'), false);
  assert.equal(text.includes('alibaba'), false);
  assert.equal(text.includes('landed cost'), false);
  assert.ok(compiled.manifest.agents.some((agent) => agent.name === 'Completeness Check Agent'));
  assert.ok(compiled.manifest.agents.some((agent) => agent.name === 'Evidence and Quality Auditor'));
});

test('hybrid mode compiles explicit component types without converting deterministic work into agents', () => {
  const compiled = builder.compileTeam(baseRequest({
    topologyMode: 'hybrid',
    capabilities: [
      { id: 'control', name: 'Pipeline Control', componentType: 'workflow', role: 'orchestrator', responsibility: 'Route typed work and terminal states.' },
      { id: 'collect', name: 'Source Collector', componentType: 'software', role: 'capability', responsibility: 'Collect approved public source records deterministically.' },
      { id: 'store', name: 'Evidence Store', componentType: 'data-store', role: 'capability', responsibility: 'Retain source-attributed evidence and provenance.' },
      { id: 'analyst', name: 'Technology Analyst', componentType: 'agent', role: 'capability', responsibility: 'Interpret verified evidence within the bounded assignment.' },
      { id: 'qa', name: 'Independent Evidence QA', componentType: 'decision-support', role: 'assurance', independentAssurance: true, responsibility: 'Fail closed on unsupported, stale, duplicated, or low-value claims.' },
      { id: 'approval', name: 'Owner Approval', componentType: 'human-gate', role: 'approval', responsibility: 'Approve any later expansion of authority.' },
    ],
    handoffs: [
      { from: 'control', to: 'collect', contract: 'source_request_v1' },
      { from: 'collect', to: 'store', contract: 'evidence_record_v1' },
      { from: 'store', to: 'analyst', contract: 'verified_evidence_pack_v1' },
      { from: 'analyst', to: 'qa', contract: 'candidate_brief_v1' },
      { from: 'qa', to: 'approval', contract: 'approval_packet_v1' },
    ],
  }), { now: '2026-08-28T00:00:00Z' });
  assert.equal(compiled.manifest.topologyMode, 'hybrid');
  assert.equal(compiled.manifest.components.length, 6);
  assert.equal(compiled.manifest.agents.length, 1);
  assert.equal(compiled.manifest.agents[0].name, 'Technology Analyst');
  assert.equal(compiled.manifest.components.find((item) => item.capabilityId === 'collect').componentType, 'software');
  assert.equal(compiled.manifest.components.find((item) => item.capabilityId === 'qa').componentType, 'decision-support');
  assert.equal(compiled.receipt.componentCount, 6);
  assert.equal(compiled.receipt.agentCount, 1);
  assert.deepEqual(compiled.contract.componentTypes, ['workflow', 'software', 'data-store', 'agent', 'decision-support', 'human-gate']);
});

test('hybrid mode fails closed when component classification is omitted', () => {
  assert.throws(() => builder.compileTeam(baseRequest({
    topologyMode: 'hybrid',
    capabilities: [
      { id: 'control', name: 'Control', componentType: 'workflow', role: 'orchestrator' },
      { id: 'mystery', name: 'Mystery Work', role: 'capability' },
    ],
    handoffs: [{ from: 'control', to: 'mystery', contract: 'bounded_task_v1' }],
  })), /componentType must be one of/);
});

test('hybrid mode requires independent assurance and an acyclic reachable graph', () => {
  const request = baseRequest({
    topologyMode: 'hybrid',
    capabilities: [
      { id: 'control', name: 'Control', componentType: 'workflow', role: 'orchestrator' },
      { id: 'build', name: 'Build', componentType: 'software', role: 'capability' },
      { id: 'qa', name: 'QA', componentType: 'software', role: 'assurance', independentAssurance: true },
    ],
    handoffs: [
      { from: 'control', to: 'build', contract: 'task_v1' },
      { from: 'build', to: 'qa', contract: 'evidence_v1' },
      { from: 'qa', to: 'build', contract: 'repair_v1' },
    ],
  });
  assert.throws(() => builder.compileTeam(request), /must be acyclic/);
  request.capabilities[2].independentAssurance = false;
  request.handoffs.pop();
  assert.throws(() => builder.compileTeam(request), /independent assurance/);
});

test('generic synthetic runner refuses to impersonate a hybrid runtime', () => {
  const compiled = builder.compileTeam(baseRequest({
    topologyMode: 'hybrid',
    capabilities: [
      { id: 'control', name: 'Control', componentType: 'workflow', role: 'orchestrator' },
      { id: 'check', name: 'Check', componentType: 'software', role: 'capability' },
      { id: 'qa', name: 'QA', componentType: 'software', role: 'assurance', independentAssurance: true },
    ],
    handoffs: [
      { from: 'control', to: 'check', contract: 'task_v1' },
      { from: 'check', to: 'qa', contract: 'evidence_v1' },
    ],
  }));
  assert.throws(() => runner.runTeam(compiled.manifest, goodPacket()), /run-specific runtime/);
});

test('synthetic Document QA TEST team executes through independent QA and DELIVERS clean packet', () => {
  const compiled = builder.compileTeam(baseRequest(), { now: '2026-08-22T18:00:00Z' });
  const result = runner.runTeam(compiled.manifest, goodPacket(), { asOf: '2026-08-22T18:00:00Z', now: '2026-08-22T18:00:00Z' });
  assert.equal(result.governanceMode, 'TEST');
  assert.equal(result.testId, 'F1-ACCEPT-DOCQA-001');
  assert.equal(result.runId, null);
  assert.equal(result.terminalState, 'DELIVERED');
  assert.equal(result.qa.status, 'PASS');
  assert.equal(result.capabilityResults.length, 5);
  assert.ok(result.capabilityResults.every((item) => item.status === 'PASS' && item.evidenceId));
  assert.equal(result.externalActionsPerformed, 0);
  assert.equal(result.spendCents, 0);
});

test('contradictory documents cause FAILED rather than unsupported success', () => {
  const compiled = builder.compileTeam(baseRequest());
  const packet = goodPacket();
  packet.invoice.companyName = 'Different Company LLC';
  const result = runner.runTeam(compiled.manifest, packet, { asOf: '2026-08-22T18:00:00Z' });
  assert.equal(result.terminalState, 'FAILED');
  const consistency = result.capabilityResults.find((item) => item.capabilityId === 'consistency');
  assert.equal(consistency.status, 'FAIL');
  assert.equal(result.qa.unsupportedSuccessClaims, 0);
});

test('stale evidence causes FAILED', () => {
  const compiled = builder.compileTeam(baseRequest());
  const packet = goodPacket();
  packet.claims.verifiedAt = '2026-01-01T00:00:00Z';
  const result = runner.runTeam(compiled.manifest, packet, { asOf: '2026-08-22T18:00:00Z' });
  assert.equal(result.terminalState, 'FAILED');
  const freshness = result.capabilityResults.find((item) => item.capabilityId === 'freshness');
  assert.equal(freshness.status, 'FAIL');
  assert.ok(freshness.observed.ageDays > 30);
});

test('unsupported execution check fails closed', () => {
  const request = baseRequest();
  request.capabilities[0].check = { type: 'invented_magic_check' };
  const compiled = builder.compileTeam(request);
  assert.throws(() => runner.runTeam(compiled.manifest, goodPacket()), /unsupported check type/);
});

test('invalid build leaves no partial package on disk', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'factory-core-test-'));
  const target = path.join(root, 'docqa-test');
  assert.throws(() => builder.writePackageAtomic(baseRequest({ purpose: '' }), target), /purpose is required/);
  assert.equal(fs.existsSync(target), false);
  fs.rmSync(root, { recursive: true, force: true });
});

test('valid TEST build writes a complete atomic provenance package', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'factory-core-test-'));
  const target = path.join(root, 'docqa-test');
  const compiled = builder.writePackageAtomic(baseRequest(), target, { now: '2026-08-22T18:00:00Z' });
  assert.equal(compiled.receipt.status, 'BUILT_TEST_STAGED');
  assert.ok(fs.existsSync(path.join(target, 'team-manifest.json')));
  assert.ok(fs.existsSync(path.join(target, 'contracts', 'team-contract.json')));
  assert.ok(fs.existsSync(path.join(target, 'evidence', 'build-receipt.json')));
  fs.rmSync(root, { recursive: true, force: true });
});
