'use strict';

const crypto = require('crypto');

const AUTHORITY = 'INTERNAL_NONPROD_ONLY';
const OUTBOUND_ALLOWED = false;
const PAYMENT_ACTION_ALLOWED = false;
const CLIENT_DELIVERY_ALLOWED = false;

function normalizeOpportunity(input) {
  if (!input || typeof input !== 'object') throw new Error('INVALID_INPUT');
  const required = ['opportunityId','marketplace','productId','brand','listingUrl','observedAt','evidence','score'];
  for (const key of required) if (input[key] === undefined || input[key] === null || input[key] === '') throw new Error(`MISSING_${key}`);
  if (input.marketplace !== 'Amazon US') throw new Error('MARKETPLACE_NOT_ALLOWED');
  if (!Array.isArray(input.evidence) || input.evidence.length === 0) throw new Error('MISSING_EVIDENCE');
  if (!Number.isInteger(input.score) || input.score < 0 || input.score > 100) throw new Error('INVALID_SCORE');

  const status = input.score >= 75 ? 'QUALIFIED' : input.score >= 50 ? 'WATCH' : 'REJECTED';
  const dedupeKey = crypto.createHash('sha256').update(`${input.marketplace}|${input.productId}|${input.brand}`.toLowerCase()).digest('hex');
  return {
    opportunityId: String(input.opportunityId), marketplace: input.marketplace, productId: String(input.productId),
    brand: String(input.brand), listingUrl: String(input.listingUrl), observedAt: String(input.observedAt),
    evidence: input.evidence, score: input.score, status, reasons: input.reasons || [], dedupeKey,
    authority: AUTHORITY, externalActionAuthorized: false
  };
}

function buildAuditDraft(opportunity) {
  if (opportunity.status !== 'QUALIFIED') return { eligible:false, reason:'NOT_QUALIFIED', opportunityId:opportunity.opportunityId };
  return {
    eligible: true,
    opportunityId: opportunity.opportunityId,
    draftId: `AUDIT-${opportunity.opportunityId}-V1`,
    clientIdentityVerified: false,
    paymentVerified: false,
    ownerApprovalRequired: true,
    deliveryAuthorized: false,
    outboundAuthorized: false,
    findings: opportunity.reasons.map((reason, i) => ({ id:`F${i+1}`, finding:reason, evidenceRequired:true })),
    authority: AUTHORITY
  };
}

function telemetry(opportunity, audit) {
  return {
    runId:'KIN-FACTORY-001', gate:'G4', authority:AUTHORITY,
    opportunityId:opportunity.opportunityId, status:opportunity.status,
    auditDraftEligible: Boolean(audit.eligible), externalActions:0, paymentActions:0, clientDeliveries:0,
    outboundAllowed:OUTBOUND_ALLOWED, paymentActionAllowed:PAYMENT_ACTION_ALLOWED, clientDeliveryAllowed:CLIENT_DELIVERY_ALLOWED
  };
}

module.exports = { normalizeOpportunity, buildAuditDraft, telemetry, AUTHORITY };
