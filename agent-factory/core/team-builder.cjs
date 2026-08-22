#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const FACTORY_CORE_VERSION = '1.0.0';
const DEFAULT_RESERVED_RUNS = [13];
const LEAKAGE_TERMS = ['ebay', 'alibaba', 'seller scout', 'landed cost', 'source-matching', 'sourcing specialist'];

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function slug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'team';
}

function title(value) {
  return String(value || '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function normalizeCapability(capability, index) {
  if (typeof capability === 'string') {
    if (!nonEmpty(capability)) throw new Error(`capabilities[${index}] must be non-empty`);
    const id = slug(capability);
    return { id, name: title(capability), responsibility: `Perform ${capability} within the approved scope.`, check: null };
  }
  if (!capability || typeof capability !== 'object') throw new Error(`capabilities[${index}] must be a string or object`);
  const name = capability.name || capability.id;
  if (!nonEmpty(name)) throw new Error(`capabilities[${index}].name or id is required`);
  const id = slug(capability.id || name);
  return {
    id,
    name: title(name),
    responsibility: nonEmpty(capability.responsibility)
      ? capability.responsibility.trim()
      : `Perform ${title(name).toLowerCase()} within the approved scope.`,
    check: capability.check || null,
  };
}

function validateRequest(request) {
  if (!request || typeof request !== 'object' || Array.isArray(request)) throw new Error('request must be an object');
  for (const field of ['teamName', 'purpose', 'domain']) {
    if (!nonEmpty(request[field])) throw new Error(`${field} is required and must be non-empty`);
  }
  if (!Array.isArray(request.capabilities) || request.capabilities.length < 2) {
    throw new Error('capabilities must contain at least two bounded capabilities');
  }
  const capabilities = request.capabilities.map(normalizeCapability);
  const ids = capabilities.map((item) => item.id);
  if (new Set(ids).size !== ids.length) throw new Error('capability ids must be unique');

  const authority = request.authority || {};
  const externalActions = Number(authority.maxExternalActions ?? 0);
  const spendCents = Number(authority.maxSpendCents ?? 0);
  const deployAllowed = authority.deploy === true || (authority.allowedActions || []).some((x) => /deploy|publish|message|contact|spend|purchase|delete/i.test(String(x)));
  if (externalActions !== 0 || spendCents !== 0 || deployAllowed) {
    throw new Error('acceptance team build is fail-closed: external actions, deployment, publishing, messaging, spending, purchasing, and deletion must remain disabled');
  }

  const existingRunNumbers = Array.isArray(request.existingRunNumbers) ? request.existingRunNumbers.map(Number) : [];
  if (existingRunNumbers.some((n) => !Number.isInteger(n) || n < 1 || n > 999)) throw new Error('existingRunNumbers must contain integers 1..999');
  const reservedRunNumbers = Array.isArray(request.reservedRunNumbers)
    ? request.reservedRunNumbers.map(Number)
    : DEFAULT_RESERVED_RUNS.slice();
  if (reservedRunNumbers.some((n) => !Number.isInteger(n) || n < 1 || n > 999)) throw new Error('reservedRunNumbers must contain integers 1..999');

  return { capabilities, authority, existingRunNumbers, reservedRunNumbers };
}

function allocateRunNumber({ existingRunNumbers, reservedRunNumbers, requestedRunNumber }) {
  const existing = new Set(existingRunNumbers.map(Number));
  const reserved = new Set(reservedRunNumbers.map(Number));
  if (requestedRunNumber !== undefined && requestedRunNumber !== null) {
    const requested = Number(requestedRunNumber);
    if (!Number.isInteger(requested) || requested < 1 || requested > 999) throw new Error('requestedRunNumber must be an integer 1..999');
    if (reserved.has(requested)) throw new Error(`Run ${String(requested).padStart(3, '0')} is permanently reserved`);
    if (existing.has(requested)) throw new Error(`Run ${String(requested).padStart(3, '0')} already exists`);
    return requested;
  }
  let candidate = existing.size ? Math.max(...existing) + 1 : 1;
  while (reserved.has(candidate) || existing.has(candidate)) candidate += 1;
  if (candidate > 999) throw new Error('no run number available');
  return candidate;
}

function compileTeam(request, options = {}) {
  const normalized = validateRequest(request);
  const runNumber = allocateRunNumber({
    existingRunNumbers: normalized.existingRunNumbers,
    reservedRunNumbers: normalized.reservedRunNumbers,
    requestedRunNumber: request.requestedRunNumber,
  });
  const runLabel = String(runNumber).padStart(3, '0');
  const domainSlug = slug(request.domain);
  const teamId = `${domainSlug.toUpperCase()}-TEAM-${runLabel}`;
  const runId = `${domainSlug.toUpperCase()}-${runLabel}`;
  const now = options.now || new Date().toISOString();
  const requestCanonical = JSON.stringify(request);
  const requestHash = sha256(requestCanonical);

  const agents = [
    {
      id: `${domainSlug}-lead-${runLabel}`,
      name: 'Team Lead and Orchestrator',
      role: 'lead',
      responsibility: 'Own scope, sequencing, typed handoffs, failure-state escalation, and terminal-state integrity.',
      canSelfApprove: false,
    },
    ...normalized.capabilities.map((capability) => ({
      id: `${domainSlug}-${capability.id}-${runLabel}`,
      name: `${capability.name} Agent`,
      role: 'capability',
      capabilityId: capability.id,
      responsibility: capability.responsibility,
      check: capability.check,
      canSelfApprove: false,
    })),
    {
      id: `${domainSlug}-qa-${runLabel}`,
      name: 'Evidence and Quality Auditor',
      role: 'qa',
      responsibility: 'Independently verify evidence completeness, unsupported claims, authority compliance, and terminal-state eligibility.',
      canSelfApprove: false,
    },
  ];

  const handoffs = [];
  let prior = agents[0].id;
  for (const agent of agents.slice(1, -1)) {
    handoffs.push({ from: prior, to: agent.id, contract: 'bounded_task_v1' });
    prior = agent.id;
  }
  handoffs.push({ from: prior, to: agents[agents.length - 1].id, contract: 'evidence_pack_v1' });

  const manifest = {
    schemaVersion: '1.0',
    factoryCoreVersion: FACTORY_CORE_VERSION,
    runNumber,
    runLabel,
    runId,
    teamId,
    teamName: request.teamName.trim(),
    domain: request.domain.trim(),
    purpose: request.purpose.trim(),
    lifecycle: 'Testing',
    operatingState: 'Design/Validation',
    externalAuthority: 'None',
    authority: {
      maxExternalActions: 0,
      maxSpendCents: 0,
      deploy: false,
      publish: false,
      message: false,
      destructiveActions: false,
    },
    gates: ['A0', 'B0', 'G0', 'G1', 'G2', 'G3'],
    agents,
    handoffs,
    provenance: {
      requestSha256: requestHash,
      builtAt: now,
      builder: 'agent-factory/core/team-builder.cjs',
      builderVersion: FACTORY_CORE_VERSION,
    },
  };

  const contract = {
    schemaVersion: '1.0',
    runId,
    teamId,
    inputs: ['bounded_input_package_v1'],
    outputs: ['evidence_pack_v1', 'qa_decision_v1', 'terminal_receipt_v1'],
    terminalStates: ['DELIVERED', 'BLOCKED_OWNER', 'BLOCKED_EXTERNAL', 'KILLED', 'FAILED'],
    successRule: 'DELIVERED requires every required capability result, evidence references, independent QA PASS, and zero authority violations.',
    failureRule: 'Unknown, unsupported, ambiguous, stale, duplicate, or unauthorized conditions fail closed.',
  };

  const receipt = {
    schemaVersion: '1.0',
    status: 'BUILT_STAGED',
    runId,
    teamId,
    runNumber,
    requestSha256: requestHash,
    roleCount: agents.length,
    capabilityCount: normalized.capabilities.length,
    externalActionsPerformed: 0,
    spendCents: 0,
    builtAt: now,
  };

  const outputText = JSON.stringify({ manifest, contract, receipt }).toLowerCase();
  const requestText = requestCanonical.toLowerCase();
  const leakage = LEAKAGE_TERMS.filter((term) => outputText.includes(term) && !requestText.includes(term));
  if (leakage.length) throw new Error(`domain leakage detected: ${leakage.join(', ')}`);

  return { manifest, contract, receipt };
}

function writePackageAtomic(request, outDir, options = {}) {
  const output = compileTeam(request, options);
  const target = path.resolve(outDir);
  if (fs.existsSync(target)) throw new Error(`output already exists: ${target}`);
  const temp = `${target}.tmp-${process.pid}-${Date.now()}`;
  try {
    fs.mkdirSync(path.join(temp, 'contracts'), { recursive: true });
    fs.mkdirSync(path.join(temp, 'evidence'), { recursive: true });
    fs.writeFileSync(path.join(temp, 'team-manifest.json'), `${JSON.stringify(output.manifest, null, 2)}\n`);
    fs.writeFileSync(path.join(temp, 'contracts', 'team-contract.json'), `${JSON.stringify(output.contract, null, 2)}\n`);
    fs.writeFileSync(path.join(temp, 'evidence', 'build-receipt.json'), `${JSON.stringify(output.receipt, null, 2)}\n`);
    fs.renameSync(temp, target);
    return output;
  } catch (error) {
    fs.rmSync(temp, { recursive: true, force: true });
    throw error;
  }
}

function main() {
  const argv = process.argv.slice(2);
  const requestIndex = argv.indexOf('--request');
  const outIndex = argv.indexOf('--out');
  if (requestIndex < 0 || !argv[requestIndex + 1] || outIndex < 0 || !argv[outIndex + 1]) {
    console.error('Usage: node team-builder.cjs --request <request.json> --out <directory>');
    process.exit(2);
  }
  try {
    const request = JSON.parse(fs.readFileSync(argv[requestIndex + 1], 'utf8'));
    const output = writePackageAtomic(request, argv[outIndex + 1]);
    console.log(JSON.stringify({ status: 'PASS', runNumber: output.manifest.runNumber, runId: output.manifest.runId, teamId: output.manifest.teamId }));
  } catch (error) {
    console.error(JSON.stringify({ status: 'BLOCKED', error: error.message }));
    process.exit(2);
  }
}

if (require.main === module) main();
module.exports = { FACTORY_CORE_VERSION, DEFAULT_RESERVED_RUNS, validateRequest, allocateRunNumber, compileTeam, writePackageAtomic };
