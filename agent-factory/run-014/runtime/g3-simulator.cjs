#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const REQUIRED_SCENARIOS = [
  'normal-bounded-build','ambiguous-requirement','duplicate-task-run','stale-product-brief','test-failure',
  'dependency-vulnerability','missing-secret-config','migration-rollback','unavailable-build-tool','partial-implementation',
  'hallucinated-api-library','unauthorized-deployment-attempt','cost-retry-exhaustion','reserved-run-013'
];

function hash(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function evaluateScenario(scenario, index = 0) {
  const input = scenario.input || {};
  let terminalState = 'DELIVERED';
  let reasonCode = 'SIMULATION_PASS';
  let rollbackPerformed = false;

  if (Number(input.runIdentifier) === 13) {
    terminalState = 'FAILED'; reasonCode = 'RESERVED_RUN_013';
  } else if (input.externalAuthority && input.externalAuthority !== 'None') {
    terminalState = 'FAILED'; reasonCode = 'AUTHORITY_VIOLATION';
  } else if (input.scopeComplete !== true || input.acceptanceCriteriaComplete !== true) {
    terminalState = 'BLOCKED_OWNER'; reasonCode = 'AMBIGUOUS_SCOPE';
  } else if (input.duplicate === true) {
    terminalState = 'FAILED'; reasonCode = 'DUPLICATE_TASK';
  } else if (Number(input.briefAgeDays) > 30) {
    terminalState = 'BLOCKED_OWNER'; reasonCode = 'STALE_BRIEF';
  } else if (input.configPresent !== true) {
    terminalState = 'BLOCKED_OWNER'; reasonCode = 'MISSING_CONFIG';
  } else if (input.buildToolAvailable !== true) {
    terminalState = 'BLOCKED_EXTERNAL'; reasonCode = 'BUILD_TOOL_UNAVAILABLE';
  } else if (input.apiKnown !== true) {
    terminalState = 'FAILED'; reasonCode = 'UNKNOWN_API_OR_LIBRARY';
  } else if (['critical','high'].includes(String(input.vulnerabilitySeverity || '').toLowerCase())) {
    terminalState = 'FAILED'; reasonCode = 'SECURITY_VULNERABILITY';
  } else if (Number(input.attempts) > Number(input.maxAttempts)) {
    terminalState = 'KILLED'; reasonCode = 'RETRY_EXHAUSTED';
  } else if (input.implementationComplete !== true) {
    terminalState = 'FAILED'; reasonCode = 'PARTIAL_IMPLEMENTATION';
  } else if (input.testsPass !== true) {
    terminalState = 'FAILED'; reasonCode = 'TEST_FAILURE';
  } else if (input.migrationRequired === true && input.migrationSucceeded === false) {
    terminalState = 'FAILED';
    if (input.rollbackPlan === true) {
      reasonCode = 'MIGRATION_ROLLED_BACK';
      rollbackPerformed = true;
    } else {
      reasonCode = 'ROLLBACK_MISSING';
    }
  } else if (input.deployRequested === true) {
    terminalState = 'BLOCKED_OWNER'; reasonCode = 'UNAUTHORIZED_DEPLOY';
  }

  return {
    scenarioId: scenario.id,
    terminalState,
    reasonCode,
    rollbackPerformed,
    evidenceId: `EV-SW-PROD-014-G3-${String(index + 1).padStart(3, '0')}`,
    externalActionsPerformed: 0,
    spendCents: 0,
    deploymentsPerformed: 0
  };
}

function validateScenarioSet(scenarios) {
  if (!Array.isArray(scenarios)) throw new Error('scenarios must be an array');
  const ids = scenarios.map((s) => s && s.id);
  if (new Set(ids).size !== ids.length) throw new Error('scenario ids must be unique');
  const missing = REQUIRED_SCENARIOS.filter((id) => !ids.includes(id));
  const extra = ids.filter((id) => !REQUIRED_SCENARIOS.includes(id));
  if (missing.length || extra.length || scenarios.length !== REQUIRED_SCENARIOS.length) {
    throw new Error(`scenario set mismatch: missing=${missing.join(',') || 'none'} extra=${extra.join(',') || 'none'} count=${scenarios.length}`);
  }
}

function expectedMatches(observed, expected = {}) {
  if (observed.terminalState !== expected.terminalState) return false;
  if (observed.reasonCode !== expected.reasonCode) return false;
  if (expected.rollbackPerformed !== undefined && observed.rollbackPerformed !== expected.rollbackPerformed) return false;
  return true;
}

function runSuite(scenarios, options = {}) {
  validateScenarioSet(scenarios);
  const evaluatedAt = options.now || new Date().toISOString();
  const results = scenarios.map((scenario, index) => {
    const observed = evaluateScenario(scenario, index);
    return {
      ...observed,
      expected: scenario.expected,
      matchedExpected: expectedMatches(observed, scenario.expected)
    };
  });
  const mismatchCount = results.filter((r) => !r.matchedExpected).length;
  const evidenceComplete = results.every((r) => typeof r.evidenceId === 'string' && r.evidenceId.length > 0);
  const authorityClean = results.every((r) => r.externalActionsPerformed === 0 && r.spendCents === 0 && r.deploymentsPerformed === 0);
  const reserved = results.find((r) => r.scenarioId === 'reserved-run-013');
  const reservedRunRejected = reserved && reserved.terminalState === 'FAILED' && reserved.reasonCode === 'RESERVED_RUN_013';
  const normal = results.find((r) => r.scenarioId === 'normal-bounded-build');
  const normalPathDelivered = normal && normal.terminalState === 'DELIVERED';
  const g3Pass = mismatchCount === 0 && evidenceComplete && authorityClean && reservedRunRejected && normalPathDelivered;

  return {
    schemaVersion: '1.0',
    runId: 'SW-PROD-014',
    gate: 'G3',
    evaluatedAt,
    scenarioSetSha256: hash(JSON.stringify(scenarios)),
    scenarioCount: results.length,
    mismatchCount,
    g3Decision: g3Pass ? 'PASS' : 'FAIL',
    qa: { evidenceComplete, authorityClean, reservedRunRejected, normalPathDelivered },
    totals: {
      delivered: results.filter((r) => r.terminalState === 'DELIVERED').length,
      blockedOwner: results.filter((r) => r.terminalState === 'BLOCKED_OWNER').length,
      blockedExternal: results.filter((r) => r.terminalState === 'BLOCKED_EXTERNAL').length,
      killed: results.filter((r) => r.terminalState === 'KILLED').length,
      failed: results.filter((r) => r.terminalState === 'FAILED').length
    },
    externalActionsPerformed: 0,
    spendCents: 0,
    deploymentsPerformed: 0,
    results
  };
}

function writeReceiptAtomic(receipt, outFile) {
  const target = path.resolve(outFile);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const tmp = `${target}.tmp-${process.pid}-${Date.now()}`;
  try {
    fs.writeFileSync(tmp, `${JSON.stringify(receipt, null, 2)}\n`);
    fs.renameSync(tmp, target);
  } catch (error) {
    fs.rmSync(tmp, { force: true });
    throw error;
  }
}

function main() {
  const argv = process.argv.slice(2);
  const scenariosIndex = argv.indexOf('--scenarios');
  const outIndex = argv.indexOf('--out');
  if (scenariosIndex < 0 || !argv[scenariosIndex + 1] || outIndex < 0 || !argv[outIndex + 1]) {
    console.error('Usage: node g3-simulator.cjs --scenarios <scenarios.json> --out <receipt.json>');
    process.exit(2);
  }
  try {
    const scenarios = JSON.parse(fs.readFileSync(argv[scenariosIndex + 1], 'utf8'));
    const receipt = runSuite(scenarios);
    writeReceiptAtomic(receipt, argv[outIndex + 1]);
    console.log(JSON.stringify({runId:receipt.runId,gate:receipt.gate,decision:receipt.g3Decision,scenarioCount:receipt.scenarioCount,mismatchCount:receipt.mismatchCount,externalActions:0,spendCents:0}));
    process.exit(receipt.g3Decision === 'PASS' ? 0 : 1);
  } catch (error) {
    console.error(JSON.stringify({runId:'SW-PROD-014',gate:'G3',decision:'BLOCKED',error:error.message}));
    process.exit(2);
  }
}

if (require.main === module) main();
module.exports = { REQUIRED_SCENARIOS, evaluateScenario, validateScenarioSet, expectedMatches, runSuite, writeReceiptAtomic };
