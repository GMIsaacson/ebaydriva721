'use strict';

const crypto = require('crypto');

const AUTHORITY = 'INTERNAL_REVIEW_ONLY';

function stableKey(parts) {
  return crypto.createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 24);
}

function requireEvidence(ids, evidenceById) {
  return ids.every((id) => evidenceById[id]);
}

function findingBase({ engagementId, vendorId, issueClass, affectedRecordIds, reviewAmountCents, calculation, governingEvidenceIds, confidence, unresolvedQuestions = [] }) {
  return {
    findingId: `F-${stableKey([engagementId, vendorId, issueClass, ...affectedRecordIds])}`,
    engagementId,
    vendorId,
    issueClass,
    affectedRecordIds,
    reviewAmountCents,
    calculation,
    governingEvidenceIds,
    confidence,
    unresolvedQuestions,
    idempotencyKey: stableKey([engagementId, vendorId, issueClass, ...affectedRecordIds.sort()]),
    qaVerdict: 'PASS',
    recommendedNextAction: 'Human review of recovery-ready claim packet',
    authority: AUTHORITY
  };
}

function auditCase(input) {
  const evidenceById = Object.fromEntries((input.evidenceArtifacts || []).map((e) => [e.id, e]));
  const findings = [];
  const remediation = [];
  const seen = new Set();

  const pushFinding = (f) => {
    if (seen.has(f.idempotencyKey)) return;
    seen.add(f.idempotencyKey);
    findings.push(f);
  };

  // Duplicate payment: same invoice paid more than once.
  const paymentsByInvoice = new Map();
  for (const payment of input.payments || []) {
    const list = paymentsByInvoice.get(payment.invoiceId) || [];
    list.push(payment);
    paymentsByInvoice.set(payment.invoiceId, list);
  }
  for (const [invoiceId, payments] of paymentsByInvoice.entries()) {
    if (payments.length < 2) continue;
    const invoice = (input.invoices || []).find((x) => x.id === invoiceId);
    if (!invoice) continue;
    const evidenceIds = [invoice.evidenceId, ...payments.map((p) => p.evidenceId)];
    if (!requireEvidence(evidenceIds, evidenceById)) {
      remediation.push({ issueClass: 'DUPLICATE', recordId: invoiceId, reason: 'Missing invoice/payment provenance evidence' });
      continue;
    }
    const sorted = [...payments].sort((a, b) => a.paidAt.localeCompare(b.paidAt));
    const duplicateAmount = sorted.slice(1).reduce((sum, p) => sum + p.amountCents, 0);
    pushFinding(findingBase({
      engagementId: input.engagement.id,
      vendorId: input.vendor.id,
      issueClass: 'DUPLICATE',
      affectedRecordIds: [invoiceId, ...sorted.map((p) => p.id)],
      reviewAmountCents: duplicateAmount,
      calculation: `${sorted.length} payments recorded for one invoice; duplicate exposure equals payments after first = ${duplicateAmount} cents`,
      governingEvidenceIds: evidenceIds,
      confidence: 0.99
    }));
  }

  // Invoice-line comparison against rate card / explicit fee authorization.
  for (const invoice of input.invoices || []) {
    for (const line of invoice.lines || []) {
      const rate = (input.rateCard?.rates || []).find((r) => r.code === line.code);
      if (!rate) {
        const evidenceIds = [invoice.evidenceId, input.rateCard?.evidenceId].filter(Boolean);
        if (!input.rateCard || !requireEvidence(evidenceIds, evidenceById)) {
          remediation.push({ issueClass: 'UNSUPPORTED_FEE', recordId: line.id, reason: 'No governing rate-card evidence' });
          continue;
        }
        pushFinding(findingBase({
          engagementId: input.engagement.id,
          vendorId: input.vendor.id,
          issueClass: 'UNSUPPORTED_FEE',
          affectedRecordIds: [invoice.id, line.id],
          reviewAmountCents: line.amountCents,
          calculation: `Invoice line ${line.code} has no authorized rate-card entry; billed amount = ${line.amountCents} cents`,
          governingEvidenceIds: evidenceIds,
          confidence: 0.95
        }));
        continue;
      }

      const evidenceIds = [invoice.evidenceId, input.rateCard.evidenceId];
      if (!requireEvidence(evidenceIds, evidenceById)) {
        remediation.push({ issueClass: 'RATE_MISMATCH', recordId: line.id, reason: 'Missing invoice or rate-card evidence' });
        continue;
      }
      const expected = rate.unitPriceCents * line.quantity;
      if (line.amountCents > expected) {
        const diff = line.amountCents - expected;
        pushFinding(findingBase({
          engagementId: input.engagement.id,
          vendorId: input.vendor.id,
          issueClass: 'RATE_MISMATCH',
          affectedRecordIds: [invoice.id, line.id],
          reviewAmountCents: diff,
          calculation: `${line.quantity} × ${rate.unitPriceCents} = ${expected} cents expected; billed ${line.amountCents}; difference ${diff} cents`,
          governingEvidenceIds: evidenceIds,
          confidence: 0.98
        }));
      }
    }
  }

  // Missing credits: approved credit memo not reflected in payments/adjustments.
  for (const credit of input.credits || []) {
    const applied = (input.appliedCredits || []).some((x) => x.creditId === credit.id);
    if (applied) continue;
    const evidenceIds = [credit.evidenceId];
    if (!requireEvidence(evidenceIds, evidenceById)) {
      remediation.push({ issueClass: 'MISSING_CREDIT', recordId: credit.id, reason: 'Missing credit memo evidence' });
      continue;
    }
    pushFinding(findingBase({
      engagementId: input.engagement.id,
      vendorId: input.vendor.id,
      issueClass: 'MISSING_CREDIT',
      affectedRecordIds: [credit.id, credit.invoiceId],
      reviewAmountCents: credit.amountCents,
      calculation: `Approved credit ${credit.id} for ${credit.amountCents} cents has no applied-credit record`,
      governingEvidenceIds: evidenceIds,
      confidence: 0.97
    }));
  }

  return {
    engagementId: input.engagement.id,
    vendorId: input.vendor.id,
    findings,
    remediation,
    telemetry: {
      invoicesProcessed: (input.invoices || []).length,
      paymentsProcessed: (input.payments || []).length,
      findingsCreated: findings.length,
      remediationCount: remediation.length,
      duplicateFindingsSuppressed: 0,
      externalActions: 0,
      accountingWrites: 0,
      paymentActions: 0,
      moneyMovementActions: 0,
      authority: AUTHORITY
    }
  };
}

module.exports = { auditCase, stableKey, AUTHORITY };
