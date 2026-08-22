#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SUPPORTED_CHECKS = new Set(['required_fields', 'cross_document_equal', 'required_url', 'regex', 'freshness']);

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function getPath(object, dottedPath) {
  const parts = String(dottedPath || '').split('.').filter(Boolean);
  let current = object;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object' || !(part in current)) return undefined;
    current = current[part];
  }
  return current;
}

function executeCheck(check, packet, context = {}) {
  if (!check || typeof check !== 'object') throw new Error('capability check definition is required');
  if (!SUPPORTED_CHECKS.has(check.type)) throw new Error(`unsupported check type: ${check.type}`);

  if (check.type === 'required_fields') {
    const document = getPath(packet, check.document);
    if (!document || typeof document !== 'object') {
      return { status: 'FAIL', observed: { missingDocument: check.document } };
    }
    const missing = (check.fields || []).filter((field) => {
      const value = document[field];
      return value === undefined || value === null || String(value).trim() === '';
    });
    return { status: missing.length ? 'FAIL' : 'PASS', observed: { document: check.document, missing } };
  }

  if (check.type === 'cross_document_equal') {
    const left = getPath(packet, check.left);
    const right = getPath(packet, check.right);
    return { status: left !== undefined && right !== undefined && left === right ? 'PASS' : 'FAIL', observed: { left, right } };
  }

  if (check.type === 'required_url') {
    const value = getPath(packet, check.path);
    const valid = typeof value === 'string' && /^https:\/\//i.test(value);
    return { status: valid ? 'PASS' : 'FAIL', observed: { path: check.path, value: value ?? null } };
  }

  if (check.type === 'regex') {
    const value = getPath(packet, check.path);
    const expression = new RegExp(check.pattern);
    return { status: typeof value === 'string' && expression.test(value) ? 'PASS' : 'FAIL', observed: { path: check.path, value: value ?? null } };
  }

  if (check.type === 'freshness') {
    const raw = getPath(packet, check.path);
    const asOf = new Date(context.asOf || packet.asOf || Date.now());
    const observed = new Date(raw);
    if (!raw || Number.isNaN(asOf.getTime()) || Number.isNaN(observed.getTime())) {
      return { status: 'FAIL', observed: { path: check.path, value: raw ?? null, reason: 'invalid-date' } };
    }
    const ageDays = Math.floor((asOf.getTime() - observed.getTime()) / 86400000);
    return { status: ageDays <= Number(check.maxAgeDays) ? 'PASS' : 'FAIL', observed: { path: check.path, value: raw, ageDays, maxAgeDays: Number(check.maxAgeDays) } };
  }

  throw new Error(`unsupported check type: ${check.type}`);
}

function runTeam(manifest, packet, options = {}) {
  if (!manifest || typeof manifest !== 'object') throw new Error('manifest is required');
  if (manifest.externalAuthority !== 'None') throw new Error('synthetic runner requires externalAuthority=None');
  if (!manifest.authority || Number(manifest.authority.maxExternalActions) !== 0 || Number(manifest.authority.maxSpendCents) !== 0) {
    throw new Error('synthetic runner requires zero external-action and spend authority');
  }
  const capabilityAgents = (manifest.agents || []).filter((agent) => agent.role === 'capability');
  if (capabilityAgents.length < 2) throw new Error('at least two capability agents are required');
  const qaAgents = (manifest.agents || []).filter((agent) => agent.role === 'qa');
  if (qaAgents.length !== 1) throw new Error('exactly one independent QA agent is required');

  const startedAt = options.now || new Date().toISOString();
  const packetHash = sha256(JSON.stringify(packet));
  const results = capabilityAgents.map((agent, index) => {
    const result = executeCheck(agent.check, packet, options);
    return {
      agentId: agent.id,
      capabilityId: agent.capabilityId,
      status: result.status,
      evidenceId: `EV-${manifest.runLabel}-${String(index + 1).padStart(3, '0')}`,
      observed: result.observed,
      externalActionsPerformed: 0,
      spendCents: 0,
    };
  });

  const evidenceComplete = results.every((result) => typeof result.evidenceId === 'string' && result.evidenceId.length > 0);
  const authorityClean = results.every((result) => result.externalActionsPerformed === 0 && result.spendCents === 0);
  const allPassed = results.every((result) => result.status === 'PASS');
  const qa = {
    agentId: qaAgents[0].id,
    status: evidenceComplete && authorityClean ? 'PASS' : 'FAIL',
    evidenceComplete,
    authorityClean,
    unsupportedSuccessClaims: 0,
  };

  const terminalState = allPassed && qa.status === 'PASS' ? 'DELIVERED' : 'FAILED';
  return {
    schemaVersion: '1.0',
    runId: manifest.runId,
    teamId: manifest.teamId,
    packetSha256: packetHash,
    startedAt,
    terminalState,
    capabilityResults: results,
    qa,
    externalActionsPerformed: 0,
    spendCents: 0,
  };
}

function writeRunAtomic(manifest, packet, outFile, options = {}) {
  const result = runTeam(manifest, packet, options);
  const target = path.resolve(outFile);
  const dir = path.dirname(target);
  fs.mkdirSync(dir, { recursive: true });
  const temp = `${target}.tmp-${process.pid}-${Date.now()}`;
  try {
    fs.writeFileSync(temp, `${JSON.stringify(result, null, 2)}\n`);
    fs.renameSync(temp, target);
    return result;
  } catch (error) {
    fs.rmSync(temp, { force: true });
    throw error;
  }
}

function main() {
  const argv = process.argv.slice(2);
  const manifestIndex = argv.indexOf('--manifest');
  const packetIndex = argv.indexOf('--packet');
  const outIndex = argv.indexOf('--out');
  if (manifestIndex < 0 || packetIndex < 0 || outIndex < 0 || !argv[manifestIndex + 1] || !argv[packetIndex + 1] || !argv[outIndex + 1]) {
    console.error('Usage: node team-runner.cjs --manifest <team-manifest.json> --packet <packet.json> --out <run-receipt.json>');
    process.exit(2);
  }
  try {
    const manifest = JSON.parse(fs.readFileSync(argv[manifestIndex + 1], 'utf8'));
    const packet = JSON.parse(fs.readFileSync(argv[packetIndex + 1], 'utf8'));
    const result = writeRunAtomic(manifest, packet, argv[outIndex + 1]);
    console.log(JSON.stringify({ status: result.terminalState === 'DELIVERED' ? 'PASS' : 'FAIL', terminalState: result.terminalState, runId: result.runId }));
    process.exit(result.terminalState === 'DELIVERED' ? 0 : 1);
  } catch (error) {
    console.error(JSON.stringify({ status: 'BLOCKED', error: error.message }));
    process.exit(2);
  }
}

if (require.main === module) main();
module.exports = { SUPPORTED_CHECKS, getPath, executeCheck, runTeam, writeRunAtomic };
