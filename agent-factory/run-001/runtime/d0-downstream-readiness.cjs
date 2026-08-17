'use strict';

const crypto = require('crypto');

const AUTHORITY = 'INTERNAL_NONPROD_ONLY';

function buildHandoff(opportunity) {
  if (!opportunity || opportunity.status !== 'QUALIFIED') throw new Error('NOT_QUALIFIED');
  const required = ['opportunityId','productId','brand','marketplace','listingUrl','observedAt','evidence','reasons'];
  for (const key of required) if (!opportunity[key] || (Array.isArray(opportunity[key]) && opportunity[key].length === 0)) throw new Error(`MISSING_${key}`);

  const handoffId = crypto.createHash('sha256').update(`KIN-D0|${opportunity.opportunityId}|1.0`).digest('hex').slice(0,24);
  return {
    handoffId: `KIN-D0-${handoffId}`,
    version: '1.0',
    opportunityId: opportunity.opportunityId,
    productId: opportunity.productId,
    brand: opportunity.brand,
    marketplace: opportunity.marketplace,
    listingUrl: opportunity.listingUrl,
    status: 'INTERNAL_AUDIT_READY',
    sourceObservedAt: opportunity.observedAt,
    evidenceRefs: opportunity.evidence.map((e,i) => typeof e === 'string' ? e : (e.url || e.source || `evidence-${i+1}`)),
    findings: opportunity.reasons.slice(),
    recipientRole: 'Pipeline and Reply Coordinator',
    recordDestination: 'Notion / Run 001 D0 Acceptance Record',
    owner: 'Pipeline and Reply Coordinator',
    nextAction: 'Verify seller identity, public business contactability, current listing state, and do-not-contact history before any C0 outreach approval packet.',
    remediationReasons: [],
    authority: AUTHORITY,
    externalActionAuthorized: false,
    paymentActionAuthorized: false,
    clientDeliveryAuthorized: false
  };
}

function validateReceiver(handoff) {
  const missing = [];
  for (const key of ['handoffId','version','opportunityId','productId','brand','listingUrl','sourceObservedAt','recipientRole','recordDestination','owner','nextAction']) if (!handoff[key]) missing.push(key);
  if (!Array.isArray(handoff.evidenceRefs) || handoff.evidenceRefs.length === 0) missing.push('evidenceRefs');
  if (!Array.isArray(handoff.findings) || handoff.findings.length === 0) missing.push('findings');
  if (handoff.externalActionAuthorized || handoff.paymentActionAuthorized || handoff.clientDeliveryAuthorized) missing.push('authority_violation');
  return { accepted: missing.length === 0, missing, disposition: missing.length ? 'REMEDIATION_REQUIRED' : 'ACCEPTED_INTERNAL_ONLY' };
}

function idempotencyKey(handoff) {
  return crypto.createHash('sha256').update(`${handoff.handoffId}|${handoff.version}`).digest('hex');
}

module.exports = { buildHandoff, validateReceiver, idempotencyKey, AUTHORITY };
