'use strict';

const { createHash } = require('node:crypto');
const { FIXED, validateEnvelope } = require('./policy.cjs');

const UNIT_IDS = Object.freeze([
  'SUB-OPS-LEAD-006',
  'SUB-OPS-DISCOVERY-006',
  'SUB-OPS-RECON-006',
  'SUB-OPS-WATCH-006',
  'SUB-OPS-QA-006',
  'WF-SUB-OPS-006-G4-001',
  'SOFT-SUB-OPS-006-001',
]);

class InMemoryEventStore {
  constructor() {
    this.keys = new Set();
  }

  claim(key) {
    if (this.keys.has(key)) return false;
    this.keys.add(key);
    return true;
  }
}

function hash(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function clean(value, fallback) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text || fallback;
}

function normalizeEmail(value) {
  const email = clean(value, '').toLowerCase();
  return email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function isoDate(value) {
  if (value === null || value === undefined || value === '') return null;
  const date = new Date(String(value).length === 10 ? String(value) + 'T00:00:00.000Z' : value);
  if (Number.isNaN(date.valueOf())) return null;
  return date.toISOString().slice(0, 10);
}

function isoDateTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? null : date.toISOString();
}

function daysBetween(from, to) {
  if (!from || !to) return null;
  const left = new Date(from + 'T00:00:00.000Z');
  const right = new Date(to + 'T00:00:00.000Z');
  return Math.floor((right - left) / 86400000);
}

function monthlyEquivalent(amountCents, billingCycle) {
  if (!Number.isInteger(amountCents) || amountCents < 0) return null;
  if (billingCycle === 'Monthly' || billingCycle === 'Usage-based') return amountCents;
  if (billingCycle === 'Annual') return Math.round(amountCents / 12);
  return null;
}

function dedupeKey(item) {
  return [
    clean(item.vendor, 'unknown').toLowerCase(),
    normalizeEmail(item.accountEmail) || 'unknown-email',
    clean(item.productPlan, 'unknown-plan').toLowerCase(),
  ].join('|');
}

function validateItem(item) {
  const errors = [];
  if (!item || typeof item !== 'object') return ['item must be an object'];
  if (!clean(item.evidenceId, '')) errors.push('evidenceId missing');
  if (!clean(item.sourceType, '')) errors.push('sourceType missing');
  if (!clean(item.sourceRef, '')) errors.push('sourceRef missing');
  if (!isoDateTime(item.observedAt)) errors.push('observedAt invalid');
  if (!clean(item.vendor, '')) errors.push('vendor missing');
  if (!clean(item.productPlan, '')) errors.push('productPlan missing');
  if (item.amountCents !== null && item.amountCents !== undefined && (!Number.isInteger(item.amountCents) || item.amountCents < 0)) errors.push('amountCents invalid');
  if (!/^[A-Z]{3}$/.test(clean(item.currency, ''))) errors.push('currency invalid');
  if (!['Monthly', 'Annual', 'Usage-based', 'Other', 'Unknown'].includes(item.billingCycle)) errors.push('billingCycle invalid');
  if (item.renewalDate && !isoDate(item.renewalDate)) errors.push('renewalDate invalid');
  if (item.cancellationDeadline && !isoDate(item.cancellationDeadline)) errors.push('cancellationDeadline invalid');
  if (item.accountEmail && !normalizeEmail(item.accountEmail)) errors.push('accountEmail invalid');
  if (!['verified', 'candidate', 'untrusted'].includes(item.trustLevel)) errors.push('trustLevel invalid');
  return errors;
}

function confidenceFor(item) {
  if (item.trustLevel === 'verified' && normalizeEmail(item.accountEmail) && Number.isInteger(item.amountCents) && isoDate(item.renewalDate)) return 'High';
  if (item.trustLevel !== 'untrusted' && (normalizeEmail(item.accountEmail) || Number.isInteger(item.amountCents))) return 'Medium';
  return 'Low';
}

function statusFor(item) {
  if (item.trustLevel !== 'verified') return item.claimedStatus === 'Trial' ? 'Trial' : 'Candidate';
  const status = clean(item.claimedStatus, 'Unknown');
  if (status === 'Active') return 'Verified Active';
  if (['Trial', 'Paused', 'Cancelled'].includes(status)) return status;
  return 'Unknown';
}

function normalizeItem(item) {
  return {
    evidenceId: clean(item.evidenceId, ''),
    sourceType: clean(item.sourceType, ''),
    sourceRef: clean(item.sourceRef, ''),
    observedAt: isoDateTime(item.observedAt),
    trustLevel: item.trustLevel,
    vendor: clean(item.vendor, 'Unknown'),
    productPlan: clean(item.productPlan, 'Unknown'),
    accountEmail: normalizeEmail(item.accountEmail),
    status: statusFor(item),
    amountCents: Number.isInteger(item.amountCents) ? item.amountCents : null,
    currency: clean(item.currency, 'USD').toUpperCase(),
    billingCycle: item.billingCycle,
    monthlyEquivalentCents: monthlyEquivalent(item.amountCents, item.billingCycle),
    renewalDate: isoDate(item.renewalDate),
    cancellationDeadline: isoDate(item.cancellationDeadline),
    autoRenew: item.autoRenew === true,
    paymentSourceLabel: clean(item.paymentSourceLabel, ''),
    usageState: ['Active', 'Low', 'Unused', 'Unknown'].includes(item.usageState) ? item.usageState : 'Unknown',
    evidenceLink: clean(item.evidenceLink, ''),
    confidence: confidenceFor(item),
  };
}

function exception(severity, category, key, evidence, safestNextStep) {
  return {
    severity,
    category,
    dedupeKey: key,
    evidence,
    safestNextStep,
    humanApprovalRequired: category !== 'DUPLICATE_EVIDENCE',
  };
}

function reconcile(items, asOfDate) {
  const groups = new Map();
  const rejected = [];
  items.forEach((item, index) => {
    const errors = validateItem(item);
    if (errors.length) {
      rejected.push({ index, evidenceId: item?.evidenceId || null, errors });
      return;
    }
    const normalized = normalizeItem(item);
    const key = dedupeKey(normalized);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(normalized);
  });

  const records = [];
  const exceptions = [];
  let duplicatesSuppressed = 0;

  for (const [key, evidence] of groups.entries()) {
    evidence.sort((a, b) => a.observedAt.localeCompare(b.observedAt));
    const latest = evidence[evidence.length - 1];
    duplicatesSuppressed += Math.max(0, evidence.length - 1);

    const amountValues = [...new Set(evidence.map((entry) => entry.amountCents).filter(Number.isInteger))];
    if (amountValues.length > 1) {
      exceptions.push(exception('Medium', 'PRICE_CHANGE', key, amountValues, 'Verify the current invoice and decide whether the value remains justified.'));
    }
    const cycles = [...new Set(evidence.map((entry) => entry.billingCycle))];
    if (cycles.length > 1) {
      exceptions.push(exception('High', 'BILLING_CYCLE_CONFLICT', key, cycles, 'Resolve the billing cadence from the newest authoritative receipt.'));
    }
    if (evidence.length > 1) {
      exceptions.push(exception('Info', 'DUPLICATE_EVIDENCE', key, evidence.map((entry) => entry.evidenceId), 'Retain all provenance but create only one subscription record.'));
    }
    if (!latest.accountEmail) {
      exceptions.push(exception('High', 'MISSING_ACCOUNT_EMAIL', key, latest.evidenceId, 'Confirm the login/account email without storing credentials.'));
    }
    if (!latest.renewalDate && latest.billingCycle !== 'Usage-based') {
      exceptions.push(exception('Medium', 'MISSING_RENEWAL_DATE', key, latest.evidenceId, 'Verify the next renewal date before any lifecycle recommendation.'));
    }
    if (latest.billingCycle === 'Unknown' || latest.billingCycle === 'Other') {
      exceptions.push(exception('Medium', 'UNKNOWN_BILLING_CYCLE', key, latest.evidenceId, 'Classify the cadence from authoritative billing evidence.'));
    }
    if (latest.trustLevel !== 'verified') {
      exceptions.push(exception('Medium', 'UNVERIFIED_EVIDENCE', key, latest.evidenceId, 'Corroborate with a vendor receipt, invoice, or owner-confirmed account page.'));
    }
    if (latest.usageState === 'Low' || latest.usageState === 'Unused') {
      exceptions.push(exception(latest.usageState === 'Unused' ? 'High' : 'Medium', 'LOW_USAGE', key, latest.usageState, 'Review value before renewal; do not cancel automatically.'));
    }
    const renewalDays = daysBetween(asOfDate, latest.renewalDate);
    if (renewalDays !== null && renewalDays < 0 && renewalDays >= -30) {
      exceptions.push(exception('High', 'RENEWAL_OVERDUE', key, Math.abs(renewalDays), 'Verify whether the renewal charged, failed, or changed; reconcile the record before making any lifecycle recommendation.'));
    } else if (renewalDays !== null && renewalDays <= 30) {
      exceptions.push(exception(renewalDays <= 7 ? 'High' : 'Medium', 'RENEWAL_DUE', key, renewalDays, 'Prepare a keep, change, or cancel recommendation for owner approval.'));
    }
    const cancellationDays = daysBetween(asOfDate, latest.cancellationDeadline);
    if (cancellationDays !== null && cancellationDays < 0 && cancellationDays >= -30) {
      exceptions.push(exception('High', 'CANCELLATION_DEADLINE_PASSED', key, Math.abs(cancellationDays), 'Escalate that the cancellation window has passed; verify current vendor status and take no vendor action.'));
    } else if (cancellationDays !== null && cancellationDays <= 30) {
      exceptions.push(exception(cancellationDays <= 7 ? 'High' : 'Medium', 'CANCELLATION_DEADLINE', key, cancellationDays, 'Escalate the decision window to the owner; take no vendor action.'));
    }
    const observedDate = latest.observedAt.slice(0, 10);
    const ageDays = daysBetween(observedDate, asOfDate);
    if (ageDays !== null && ageDays > 90) {
      exceptions.push(exception('Medium', 'STALE_EVIDENCE', key, ageDays, 'Refresh the evidence before treating the record as verified.'));
    }

    records.push({
      dedupeKey: key,
      vendor: latest.vendor,
      productPlan: latest.productPlan,
      accountEmail: latest.accountEmail,
      status: latest.status,
      billingCycle: latest.billingCycle,
      amountCents: latest.amountCents,
      currency: latest.currency,
      monthlyEquivalentCents: latest.monthlyEquivalentCents,
      autoRenew: latest.autoRenew,
      renewalDate: latest.renewalDate,
      cancellationDeadline: latest.cancellationDeadline,
      paymentSourceLabel: latest.paymentSourceLabel,
      usageState: latest.usageState,
      confidence: latest.confidence,
      humanReviewNeeded: latest.confidence !== 'High',
      lastVerified: latest.observedAt.slice(0, 10),
      sourceEvidence: evidence.map((entry) => ({
        evidenceId: entry.evidenceId,
        sourceType: entry.sourceType,
        sourceRef: entry.sourceRef,
        observedAt: entry.observedAt,
        evidenceLink: entry.evidenceLink,
      })),
    });
  }

  return { records, exceptions, rejected, duplicatesSuppressed };
}

function buildPerformance(inputCount, reconciliation, elapsedMs) {
  const values = {
    'SUB-OPS-LEAD-006': { packets: 1, outputs: 1 },
    'SUB-OPS-DISCOVERY-006': { packets: inputCount, outputs: inputCount - reconciliation.rejected.length },
    'SUB-OPS-RECON-006': { packets: inputCount - reconciliation.rejected.length, outputs: reconciliation.records.length },
    'SUB-OPS-WATCH-006': { packets: reconciliation.records.length, outputs: reconciliation.exceptions.length },
    'SUB-OPS-QA-006': { packets: reconciliation.records.length + reconciliation.rejected.length, outputs: reconciliation.rejected.length },
    'WF-SUB-OPS-006-G4-001': { packets: 1, outputs: 1 },
    'SOFT-SUB-OPS-006-001': { packets: inputCount, outputs: reconciliation.records.length },
  };
  return UNIT_IDS.map((unitId) => ({
    unitId,
    status: 'Pass',
    packetsProcessed: values[unitId].packets,
    outputsProduced: values[unitId].outputs,
    elapsedMs,
    externalActions: 0,
    notionWrites: 0,
    aiCalls: 0,
    costCents: 0,
  }));
}

function runBatch(packet, store = new InMemoryEventStore()) {
  const started = Date.now();
  const violations = validateEnvelope(packet);
  if (violations.length) {
    return {
      runId: packet?.runId || null,
      gate: packet?.gate || null,
      status: 'Review',
      humanReviewRequired: true,
      retryAllowed: false,
      violations,
      records: [],
      exceptions: [],
      performance: [],
      externalActionsPerformed: 0,
      notionWritesPerformed: 0,
      spendingCents: 0,
      aiCalls: 0,
    };
  }

  if (!store.claim(packet.eventId)) {
    return {
      runId: packet.runId,
      gate: packet.gate,
      workflowId: packet.workflowId,
      traceId: packet.traceId,
      status: 'DuplicateSuppressed',
      humanReviewRequired: false,
      retryAllowed: false,
      records: [],
      exceptions: [],
      performance: [],
      externalActionsPerformed: 0,
      notionWritesPerformed: 0,
      spendingCents: 0,
      aiCalls: 0,
    };
  }

  const result = reconcile(packet.items, packet.asOfDate);
  const monthlyEquivalentCents = result.records.reduce((sum, record) => sum + (record.monthlyEquivalentCents || 0), 0);
  const elapsedMs = Math.max(0, Date.now() - started);
  const performance = buildPerformance(packet.items.length, result, elapsedMs);
  const status = result.rejected.length ? 'Review' : 'Pass';

  return {
    schemaVersion: '1.0',
    runId: FIXED.runId,
    gate: FIXED.gate,
    workflowId: FIXED.workflowId,
    workflowVersion: FIXED.workflowVersion,
    eventId: packet.eventId,
    traceId: packet.traceId,
    status,
    humanReviewRequired: result.rejected.length > 0 || result.exceptions.some((item) => item.humanApprovalRequired),
    retryAllowed: false,
    packetHash: hash(packet),
    inputEvidenceCount: packet.items.length,
    records: result.records,
    exceptions: result.exceptions,
    rejected: result.rejected,
    duplicatesSuppressed: result.duplicatesSuppressed,
    summary: {
      proposedSubscriptionCount: result.records.length,
      monthlyEquivalentCents,
      exceptionCount: result.exceptions.length,
      highSeverityExceptions: result.exceptions.filter((item) => item.severity === 'High').length,
    },
    performance,
    writeMode: 'DraftOnly',
    externalActionsPerformed: 0,
    notionWritesPerformed: 0,
    spendingCents: 0,
    aiCalls: 0,
  };
}

module.exports = {
  InMemoryEventStore,
  UNIT_IDS,
  buildPerformance,
  dedupeKey,
  monthlyEquivalent,
  normalizeItem,
  reconcile,
  runBatch,
  validateItem,
};
