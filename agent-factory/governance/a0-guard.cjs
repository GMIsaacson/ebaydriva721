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

function loadPolicy(policyPath = POLICY_PATH) {
  const policy = JSON.parse(fs.readFileSync(policyPath, 'utf8'));
  if (policy.fail_closed !== true) throw new Error('A0 policy must be fail-closed.');
  return policy;
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) if (argv[i] === '--base' && argv[i + 1]) args.base = argv[++i];
  return args;
}

function runGit(args, cwd = REPO_ROOT) {
  return cp.execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function parseNameStatus(text) {
  if (!text.trim()) return [];
  return text.trim().split(/\r?\n/).map((line) => {
    const fields = line.split('\t');
    const status = fields[0];
    if (status.startsWith('R') || status.startsWith('C')) return { status: status[0], oldPath: normalizePath(fields[1]), path: normalizePath(fields[2]) };
    return { status: status[0], path: normalizePath(fields[1]) };
  });
}

function getChanges(baseRef) {
  return parseNameStatus(runGit(['diff', '--name-status', '--find-renames', `${baseRef}...HEAD`]));
}

function runRootFor(filePath, policy) {
  const match = normalizePath(filePath).match(new RegExp(policy.protected_run_root_regex));
  return match ? match[0].replace(/\/$/, '') : null;
}

function pathExistsAtRef(baseRef, repoPath) {
  try { runGit(['cat-file', '-e', `${baseRef}:${repoPath}`]); return true; } catch { return false; }
}

function isExempt(filePath, policy) {
  const p = normalizePath(filePath);
  return policy.exempt_prefixes.some((prefix) => p.startsWith(normalizePath(prefix)));
}

function isNonStructuralSupportPath(filePath, policy) {
  const parts = normalizePath(filePath).split('/');
  return policy.non_structural_segments.some((segment) => parts.includes(segment));
}

function isProtectedChange(change, context) {
  const { policy, baseRef, baseRunExistence = new Map() } = context;
  const p = normalizePath(change.path);
  if (!p || isExempt(p, policy)) return false;
  const runRoot = runRootFor(p, policy);
  if (runRoot) {
    let existed = baseRunExistence.get(runRoot);
    if (existed === undefined) {
      existed = baseRef ? pathExistsAtRef(baseRef, runRoot) : false;
      baseRunExistence.set(runRoot, existed);
    }
    if (!existed) return true;
  }
  const parts = p.split('/');
  const structuralSegment = policy.protected_segments.some((segment) => parts.includes(segment));
  if (structuralSegment && !isNonStructuralSupportPath(p, policy)) return true;
  if (isNonStructuralSupportPath(p, policy)) return false;
  const filename = parts[parts.length - 1] || '';
  return new RegExp(policy.protected_filename_regex, 'i').test(filename);
}

function listDecisionFiles(repoRoot, policy) {
  const dir = path.join(repoRoot, policy.decision_directory);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(policy.decision_suffix))
    .map((entry) => ({ absolutePath: path.join(dir, entry.name), repoPath: normalizePath(path.posix.join(policy.decision_directory, entry.name)) }));
}

function isNonEmptyString(value) { return typeof value === 'string' && value.trim().length > 0; }

function validateDecision(decision, policy) {
  const errors = [];
  for (const field of policy.required_decision_fields) if (!(field in decision)) errors.push(`missing ${field}`);
  if (!isNonEmptyString(decision.decision_id) || !decision.decision_id.startsWith('A0-')) errors.push('decision_id must be a non-empty A0-* identifier');
  if (decision.status !== 'PASS') errors.push('status must equal PASS');
  if (!policy.creation_verdicts.includes(decision.verdict)) errors.push(`verdict must be one of ${policy.creation_verdicts.join(', ')}`);
  for (const field of ['owner','decided_at','business_outcome','existing_owner_scan','duplication_analysis','residual_unowned_loop','evidence_ref']) if (!isNonEmptyString(decision[field])) errors.push(`${field} must be non-empty`);
  if (!Array.isArray(decision.reuse_candidates_checked) || decision.reuse_candidates_checked.length === 0) errors.push('reuse_candidates_checked must contain at least one candidate');
  if (!Array.isArray(decision.covers_paths) || decision.covers_paths.length === 0) errors.push('covers_paths must contain at least one path');
  return errors;
}

function loadDecisions(repoRoot, policy, changedPaths) {
  return listDecisionFiles(repoRoot, policy).map((file) => {
    let decision; let parseError = null;
    try { decision = JSON.parse(fs.readFileSync(file.absolutePath, 'utf8')); } catch (error) { decision = {}; parseError = error.message; }
    const validationErrors = parseError ? [`invalid JSON: ${parseError}`] : validateDecision(decision, policy);
    return { ...file, decision, validationErrors, touchedInChange: changedPaths.has(file.repoPath) };
  });
}

function pathCovered(filePath, prefix) {
  const p = normalizePath(filePath); const cover = normalizePath(prefix).replace(/\/$/, '');
  if (!cover) return false;
  return p === cover || p.startsWith(`${cover}/`);
}

function evaluateChanges({ changes, decisions, policy, baseRef = null, baseRunExistence = new Map() }) {
  const violations = [];
  const protectedChanges = changes.filter((change) => isProtectedChange(change, { policy, baseRef, baseRunExistence }));
  for (const change of protectedChanges) {
    const candidates = decisions.filter(({ decision, touchedInChange }) => touchedInChange && Array.isArray(decision.covers_paths) && decision.covers_paths.some((cover) => pathCovered(change.path, cover)));
    const valid = candidates.find((candidate) => candidate.validationErrors.length === 0);
    if (!valid) {
      const detail = candidates.length ? candidates.map((candidate) => `${candidate.repoPath}: ${candidate.validationErrors.join('; ')}`).join(' | ') : 'no changed A0 decision covers this path';
      violations.push({ path: change.path, status: change.status, reason: detail });
    }
  }
  return { protectedChanges, violations };
}

function main() {
  const policy = loadPolicy();
  const { base } = parseArgs(process.argv.slice(2));
  const baseRef = base || process.env.A0_BASE_REF || (process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : null);
  if (!baseRef) { console.error('A0 BLOCK: base ref is required (--base <ref> or GITHUB_BASE_REF).'); process.exit(2); }
  let changes;
  try { changes = getChanges(baseRef); } catch (error) { console.error(`A0 BLOCK: unable to inspect change set against ${baseRef}.`); console.error(error.stderr?.toString() || error.message); process.exit(2); }
  const changedPaths = new Set(changes.map((change) => change.path));
  const decisions = loadDecisions(REPO_ROOT, policy, changedPaths);
  const result = evaluateChanges({ changes, decisions, policy, baseRef });
  if (result.violations.length > 0) {
    console.error(`A0 BLOCK: ${result.violations.length} protected structural change(s) lack current PASS evidence.`);
    for (const violation of result.violations) console.error(`- ${violation.status} ${violation.path}: ${violation.reason}`);
    console.error(`Add or update a ${policy.decision_suffix} record under ${policy.decision_directory} in this same change set.`);
    process.exit(2);
  }
  console.log(`A0 PASS: ${result.protectedChanges.length} protected structural change(s) are covered by current A0 evidence.`);
}

if (require.main === module) main();
module.exports = { normalizePath, parseNameStatus, runRootFor, isProtectedChange, validateDecision, pathCovered, evaluateChanges };
