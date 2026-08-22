'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const builder = require('../team-builder.cjs');
const runner = require('../team-runner.cjs');

function baseRequest(overrides = {}) {
  return {
    teamName: 'Document Quality Assurance Team',
    purpose: 'Inspect synthetic business-document packages for completeness, contradictions, unsupported claims, formatting defects, and stale evidence.',
    domain: 'document-quality-assurance',
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

test('allocates Run 015 and permanently skips Run 013', () => {
  const compiled = builder.compileTeam(baseRequest(), { now: '2026-08-22T18:00:00Z' });
  assert.equal(compiled.manifest.runNumber, 15);
  assert.equal(compiled.manifest.runLabel, '015');
  assert.match(compiled.manifest.runId, /015$/);
});

test('Run 013 cannot be explicitly requested', () => {
  assert.throws(() => builder.compileTeam(baseRequest({ requestedRunNumber: 13 })), /permanently reserved/);
});

test('duplicate existing run number fails closed', () => {
  assert.throws(() => builder.compileTeam(baseRequest({ requestedRunNumber: 14 })), /already exists/);
});

test('deployment or external authority is rejected at build time', () => {
  assert.throws(() => builder.compileTeam(baseRequest({
    authority: { maxExternalActions: 1, maxSpendCents: 0, deploy: true, allowedActions: ['deploy'] },
  })), /fail-closed/);
});

test('ambiguous request without purpose is rejected', () => {
  assert.throws(() => builder.compileTeam(baseRequest({ purpose: '' })), /purpose is required/);
});

test('neutral-domain build contains no eBay or Alibaba template leakage', () => {
  const compiled = builder.compileTeam(baseRequest(), { now: '2026-08-22T18:00:00Z' });
  const text = JSON.stringify(compiled).toLowerCase();
  assert.equal(text.includes('ebay'), false);
  assert.equal(text.includes('alibaba'), false);
  assert.equal(text.includes('landed cost'), false);
  assert.ok(compiled.manifest.agents.some((agent) => agent.name === 'Completeness Check Agent'));
  assert.ok(compiled.manifest.agents.some((agent) => agent.name === 'Evidence and Quality Auditor'));
});

test('synthetic Document QA team executes through independent QA and DELIVERS clean packet', () => {
  const compiled = builder.compileTeam(baseRequest(), { now: '2026-08-22T18:00:00Z' });
  const result = runner.runTeam(compiled.manifest, goodPacket(), { asOf: '2026-08-22T18:00:00Z', now: '2026-08-22T18:00:00Z' });
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
  const target = path.join(root, 'run-015');
  assert.throws(() => builder.writePackageAtomic(baseRequest({ purpose: '' }), target), /purpose is required/);
  assert.equal(fs.existsSync(target), false);
  fs.rmSync(root, { recursive: true, force: true });
});

test('valid build writes a complete atomic provenance package', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'factory-core-test-'));
  const target = path.join(root, 'run-015');
  const compiled = builder.writePackageAtomic(baseRequest(), target, { now: '2026-08-22T18:00:00Z' });
  assert.equal(compiled.receipt.status, 'BUILT_STAGED');
  assert.ok(fs.existsSync(path.join(target, 'team-manifest.json')));
  assert.ok(fs.existsSync(path.join(target, 'contracts', 'team-contract.json')));
  assert.ok(fs.existsSync(path.join(target, 'evidence', 'build-receipt.json')));
  fs.rmSync(root, { recursive: true, force: true });
});
