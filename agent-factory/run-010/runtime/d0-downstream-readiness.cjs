'use strict';

const crypto = require('crypto');

const AUTHORITY = 'INTERNAL_REVIEW_ONLY';
const RECIPIENT = 'Aberdeen Owner Review Queue';
const DESTINATION = 'Notion / Run 010 D0 Downstream Acceptance Record';
const OWNER = 'Aberdeen Technologies';

function stableHandoffId(finding) {
  return `AP-D0-${crypto.createHash('sha256').update(`${finding.idempotencyKey}|1.0`).digest('hex').slice(0, 24)}`;
}

function requiredFindingGaps(finding) {
  const gaps = [];
  for (const key of ['findingId','engagementId','vendorId','issueClass','calculation','idempotencyKey','qaVerdict']) {
    if (!finding?.[key]) gaps.push(key);
  }
  if (!Array.isArray(finding?.affectedRecordIds) || finding.affectedRecordIds.length === 0) gaps.push('affectedRecordIds');
  if (!Array.isArray(finding?.governingEvidenceIds) || finding.governingEvidenceIds.length === 0) gaps.push('governingEvidenceIds');
  if (!Number.isInteger(finding?.reviewAmountCents) || finding.reviewAmountCents < 0) gaps.push('reviewAmountCents');
  if (typeof finding?.confidence !== 'number' || finding.confidence < 0 || finding.confidence > 1) gaps.push('confidence');
  if (finding?.authority !== AUTHORITY) gaps.push('authority');
  return gaps;
}

function buildHandoff(finding) {
  const gaps = requiredFindingGaps(finding);
  const qaReady = finding?.qaVerdict === 'PASS';
  const remediationReasons = [...gaps];
  if (!qaReady) remediationReasons.push(`qaVerdict:${finding?.qaVerdict || 'MISSING'}`);

  return {
    handoffId: finding?.idempotencyKey ? stableHandoffId(finding) : 'AP-D0-REMEDIATION',
    version: '1.0',
    engagementId: finding?.engagementId || 'UNKNOWN',
    vendorId: finding?.vendorId || 'UNKNOWN',
    findingId: finding?.findingId || 'UNKNOWN',
    issueClass: finding?.issueClass || 'RECONCILIATION_GAP',
    affectedRecordIds: Array.isArray(finding?.affectedRecordIds) ? finding.affectedRecordIds.slice() : [],
    reviewAmountCents: Number.isInteger(finding?.reviewAmountCents) && finding.reviewAmountCents >= 0 ? finding.reviewAmountCents : 0,
    calculation: finding?.calculation || 'Missing reproducible calculation',
    governingEvidenceIds: Array.isArray(finding?.governingEvidenceIds) ? finding.governingEvidenceIds.slice() : [],
    confidence: typeof finding?.confidence === 'number' ? finding.confidence : 0,
    unresolvedQuestions: Array.isArray(finding?.unresolvedQuestions) ? finding.unresolvedQuestions.slice() : [],
    qaVerdict: ['PASS','REMEDIATE','REJECT'].includes(finding?.qaVerdict) ? finding.qaVerdict : 'REMEDIATE',
    findingIdempotencyKey: finding?.idempotencyKey || 'MISSING',
    status: gaps.length === 0 && qaReady ? 'OWNER_REVIEW_READY' : 'REMEDIATION_REQUIRED',
    recipientRole: RECIPIENT,
    recordDestination: DESTINATION,
    owner: OWNER,
    nextAction: gaps.length === 0 && qaReady
      ? 'Owner reviews evidence and decides whether a separately authorized recovery action should be prepared.'
      : 'Return to Evidence & QA Agent for correction and independent revalidation.',
    remediationReasons,
    authority: AUTHORITY,
    externalActionAuthorized: false,
    accountingWriteAuthorized: false,
    paymentActionAuthorized: false,
    moneyMovementAuthorized: false
  };
}

function validateReceiver(handoff) {
  const missing = [];
  for (const key of ['handoffId','version','engagementId','vendorId','findingId','issueClass','calculation','findingIdempotencyKey','status','recipientRole','recordDestination','owner','nextAction','authority']) {
    if (!handoff?.[key]) missing.push(key);
  }
  if (!Array.isArray(handoff?.affectedRecordIds) || handoff.affectedRecordIds.length === 0) missing.push('affectedRecordIds');
  if (!Array.isArray(handoff?.governingEvidenceIds) || handoff.governingEvidenceIds.length === 0) missing.push('governingEvidenceIds');
  if (handoff?.recipientRole !== RECIPIENT) missing.push('recipientRole');
  if (handoff?.recordDestination !== DESTINATION) missing.push('recordDestination');
  if (handoff?.owner !== OWNER) missing.push('owner');
  if (handoff?.authority !== AUTHORITY) missing.push('authority');
  if (handoff?.externalActionAuthorized || handoff?.accountingWriteAuthorized || handoff?.paymentActionAuthorized || handoff?.moneyMovementAuthorized) missing.push('authority_violation');
  if (handoff?.status === 'OWNER_REVIEW_READY' && handoff?.qaVerdict !== 'PASS') missing.push('qa_not_pass');
  return {
    accepted: missing.length === 0 && handoff?.status === 'OWNER_REVIEW_READY',
    missing,
    disposition: missing.length === 0 && handoff?.status === 'OWNER_REVIEW_READY' ? 'ACCEPTED_INTERNAL_ONLY' : 'REMEDIATION_REQUIRED'
  };
}

function receiverIdempotencyKey(handoff) {
  return crypto.createHash('sha256').update(`${handoff.handoffId}|${handoff.version}|${handoff.findingIdempotencyKey}`).digest('hex');
}

module.exports = {
  AUTHORITY,
  RECIPIENT,
  DESTINATION,
  OWNER,
  stableHandoffId,
  requiredFindingGaps,
  buildHandoff,
  validateReceiver,
  receiverIdempotencyKey
};
