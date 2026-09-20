const crypto = require('node:crypto');

const SCHEMA_VERSION = '1.0';
const PROJECT_ID = 'SourceMargin';

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

function sha256(value) {
  return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

function hasRefs(entry) {
  return Array.isArray(entry?.refs) && entry.refs.length > 0 && entry.refs.every((ref) => typeof ref === 'string' && ref.length > 0);
}

function requireWriteback(violations, code, entry) {
  if (entry?.present !== true || !hasRefs(entry)) violations.push(code);
}

function requireQa(violations, label, entry) {
  if (entry?.required !== true) return;
  if (entry?.status !== 'PASS' || !hasRefs(entry)) violations.push(`${label}_REQUIRED_NOT_PASS`);
}

function evaluateCompletionGuard(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('completion guard input object required');
  }

  const violations = [];
  if (input.projectId !== PROJECT_ID) violations.push('PROJECT_ID_INVALID');
  if (input.material !== true) violations.push('MATERIAL_WORK_ORDER_REQUIRED');
  if (!input.workOrderId || typeof input.workOrderId !== 'string') violations.push('WORK_ORDER_ID_MISSING');
  if (!input.checkedAt || !Number.isFinite(Date.parse(input.checkedAt))) violations.push('CHECKED_AT_INVALID');

  const writebacks = input.writebacks || {};
  requireWriteback(violations, 'SUPABASE_WRITEBACK_MISSING', writebacks.supabase);
  requireWriteback(violations, 'WORK_CONTROL_HANDOFF_MISSING', writebacks.workControl);
  if (writebacks.github?.required === true) {
    requireWriteback(violations, 'GITHUB_WRITEBACK_MISSING', writebacks.github);
  }

  const reconciliation = input.reconciliation || {};
  if (!reconciliation.receiptId || typeof reconciliation.receiptId !== 'string') {
    violations.push('RECONCILIATION_RECEIPT_MISSING');
  }
  if (reconciliation.status !== 'CONSISTENT') {
    violations.push('RECONCILIATION_NOT_CONSISTENT');
  }

  const qa = input.qa || {};
  requireQa(violations, 'Q1', qa.q1);
  requireQa(violations, 'Q2', qa.q2);

  const completionStatus = violations.length === 0 ? 'DONE' : 'BLOCKED_WRITEBACK';
  const receipt = {
    schemaVersion: SCHEMA_VERSION,
    authority: 'Observe',
    projectId: input.projectId || null,
    workOrderId: input.workOrderId || null,
    checkedAt: input.checkedAt || null,
    completionStatus,
    completionEligible: completionStatus === 'DONE',
    violations,
    evidenceRefs: [...new Set([
      ...(hasRefs(writebacks.supabase) ? writebacks.supabase.refs : []),
      ...(hasRefs(writebacks.workControl) ? writebacks.workControl.refs : []),
      ...(hasRefs(writebacks.github) ? writebacks.github.refs : []),
      ...(hasRefs(qa.q1) ? qa.q1.refs : []),
      ...(hasRefs(qa.q2) ? qa.q2.refs : []),
      ...(Array.isArray(reconciliation.refs) ? reconciliation.refs : []),
    ])],
  };
  receipt.receiptId = `SM-COMPLETE-${sha256(receipt).slice(0, 16)}`;
  return Object.freeze(receipt);
}

function assertCompletionAllowed(input) {
  const receipt = evaluateCompletionGuard(input);
  if (!receipt.completionEligible) {
    const error = new Error(`SourceMargin completion blocked: ${receipt.violations.join(', ')}`);
    error.code = 'BLOCKED_WRITEBACK';
    error.receipt = receipt;
    throw error;
  }
  return receipt;
}

module.exports = {
  PROJECT_ID,
  assertCompletionAllowed,
  evaluateCompletionGuard,
};
