'use strict';

const fs = require('fs');
const path = require('path');
const { normalizeOpportunity, buildAuditDraft, telemetry } = require('../runtime/g4-seller-conversion-lab.cjs');

const fixturePath = path.join(__dirname, '..', 'g5', 'current-shadow-batch.v1.json');
const batch = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

const seen = new Set();
const results = [];
let duplicatesSuppressed = 0;

for (const raw of batch.opportunities) {
  const normalized = normalizeOpportunity(raw);
  if (seen.has(normalized.dedupeKey)) {
    duplicatesSuppressed += 1;
    continue;
  }
  seen.add(normalized.dedupeKey);
  const audit = buildAuditDraft(normalized);
  const t = telemetry(normalized, audit);
  results.push({
    opportunityId: normalized.opportunityId,
    productId: normalized.productId,
    brand: normalized.brand,
    score: normalized.score,
    status: normalized.status,
    auditDraftEligible: audit.eligible,
    evidenceCount: normalized.evidence.length,
    manualReviewRequired: Boolean(raw.manualReview && raw.manualReview.required),
    manualReviewReason: raw.manualReview ? raw.manualReview.reason : null,
    externalActions: t.externalActions,
    paymentActions: t.paymentActions,
    clientDeliveries: t.clientDeliveries
  });
}

const qualified = results.filter(r => r.status === 'QUALIFIED');
const watch = results.filter(r => r.status === 'WATCH');
const rejected = results.filter(r => r.status === 'REJECTED');
const operatorMinutes = results.reduce((sum, r) => sum + (r.manualReviewRequired ? 6 : 1), 0);
const externalActions = results.reduce((sum, r) => sum + r.externalActions, 0);
const paymentActions = results.reduce((sum, r) => sum + r.paymentActions, 0);
const clientDeliveries = results.reduce((sum, r) => sum + r.clientDeliveries, 0);

const report = {
  runId: batch.runId,
  gate: batch.gate,
  observedAt: batch.observedAt,
  authority: batch.authority,
  inputCount: batch.opportunities.length,
  uniqueCount: results.length,
  duplicatesSuppressed,
  qualifiedCount: qualified.length,
  watchCount: watch.length,
  rejectedCount: rejected.length,
  auditDraftEligibleCount: results.filter(r => r.auditDraftEligible).length,
  manualReviewCount: results.filter(r => r.manualReviewRequired).length,
  operatorMinutesEstimated: operatorMinutes,
  externalActions,
  paymentActions,
  clientDeliveries,
  recurringScheduleAuthorized: false,
  results
};

const assertions = [
  [report.inputCount === 8, 'expected 8 raw shadow records'],
  [report.uniqueCount === 7, 'expected 7 unique opportunities'],
  [report.duplicatesSuppressed === 1, 'expected exactly one duplicate suppressed'],
  [report.qualifiedCount === 4, 'expected four qualified records'],
  [report.watchCount === 3, 'expected three watch records'],
  [report.rejectedCount === 0, 'expected no rejected records in curated batch'],
  [report.auditDraftEligibleCount === report.qualifiedCount, 'audit eligibility must match qualified count'],
  [report.externalActions === 0, 'external actions must remain zero'],
  [report.paymentActions === 0, 'payment actions must remain zero'],
  [report.clientDeliveries === 0, 'client deliveries must remain zero'],
  [report.recurringScheduleAuthorized === false, 'recurring scheduling must remain disabled'],
  [results.every(r => r.evidenceCount >= 1), 'every unique record must retain evidence']
];

for (const [ok, msg] of assertions) {
  if (!ok) {
    console.error(JSON.stringify(report, null, 2));
    throw new Error(`G5_ASSERTION_FAILED: ${msg}`);
  }
}

console.log(JSON.stringify(report, null, 2));
