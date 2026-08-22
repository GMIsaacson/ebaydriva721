#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const POLICY_PATH = path.join(__dirname, 'a0-policy.json');

function normalizePath(value) {
  return String(value || '').replace(/\\/g, '/').replace(/^\.\//, '');
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--base' && argv[i + 1]) args.base = argv[++i];
  }
  return args;
}

function parseNameStatus(text) {
  if (!String(text || '').trim()) return [];
  return String(text).trim().split(/\r?\n/).map((line) => {
    const fields = line.split('\t');
    const status = fields[0];
    if (status.startsWith('R') || status.startsWith('C')) {
      return { status: status[0], oldPath: normalizePath(fields[1]), path: normalizePath(fields[2]) };
    }
    return { status: status[0], path: normalizePath(fields[1]) };
  });
}

function runNumberFor(filePath) {
  const match = normalizePath(filePath).match(/^agent-factory\/run-([0-9]{3})(?:\/|$)/);
  return match ? Number(match[1]) : null;
}

function evaluate(changes, reservedRunNumbers) {
  const reserved = new Set((reservedRunNumbers || []).map(Number));
  return changes
    .filter((change) => change.status !== 'D')
    .map((change) => ({ ...change, runNumber: runNumberFor(change.path) }))
    .filter((change) => change.runNumber !== null && reserved.has(change.runNumber))
    .map((change) => ({
      ...change,
      reason: `Run ${String(change.runNumber).padStart(3, '0')} is permanently reserved and cannot be created, repurposed, or used as a structural target.`,
    }));
}

function main() {
  const policy = JSON.parse(fs.readFileSync(POLICY_PATH, 'utf8'));
  if (policy.fail_closed !== true) throw new Error('A0 policy must be fail-closed.');
  const reserved = policy.reserved_run_numbers || [];
  if (!Array.isArray(reserved) || reserved.length === 0) {
    console.error('RESERVED-RUN BLOCK: policy must declare reserved_run_numbers.');
    process.exit(2);
  }

  const { base } = parseArgs(process.argv.slice(2));
  const baseRef = base || process.env.A0_BASE_REF || (process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : null);
  if (!baseRef) {
    console.error('RESERVED-RUN BLOCK: base ref is required.');
    process.exit(2);
  }

  let output;
  try {
    output = cp.execFileSync('git', ['diff', '--name-status', '--find-renames', `${baseRef}...HEAD`], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    console.error(`RESERVED-RUN BLOCK: unable to inspect change set against ${baseRef}.`);
    console.error(error.stderr?.toString() || error.message);
    process.exit(2);
  }

  const violations = evaluate(parseNameStatus(output), reserved);
  if (violations.length) {
    console.error(`RESERVED-RUN BLOCK: ${violations.length} prohibited structural path(s).`);
    for (const violation of violations) console.error(`- ${violation.status} ${violation.path}: ${violation.reason}`);
    process.exit(2);
  }
  console.log(`RESERVED-RUN PASS: no structural change targets reserved run number(s): ${reserved.join(', ')}.`);
}

if (require.main === module) main();
module.exports = { normalizePath, parseNameStatus, runNumberFor, evaluate };
