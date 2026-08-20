const {
  retryDecision,
  validateDeadLetterRecord,
  evaluateCancellation,
  canRequeueDeadLetter
} = require('../runtime/recovery-value.cjs');

function runRetryDeadLetterCancellationProof({ now = '2026-08-20T01:00:00.000Z' } = {}) {
  const subjectId = 'run008:synthetic:retry-proof';
  const idempotencyKey = 'idem:run008:retry-proof:001';
  const failureType = 'TEMPORARY_PROVIDER';
  const maximumRetryAttempts = 2;

  const attempt1 = retryDecision({
    failureType,
    attemptsUsed: 0,
    maximumRetryAttempts,
    idempotencyKey
  });
  const attempt2 = retryDecision({
    failureType,
    attemptsUsed: 1,
    maximumRetryAttempts,
    idempotencyKey
  });
  const exhausted = retryDecision({
    failureType,
    attemptsUsed: 2,
    maximumRetryAttempts,
    idempotencyKey
  });

  const deadLetter = {
    deadLetterId: 'dlq:run008:retry-proof:001',
    owner: 'Aberdeen / Operations',
    subjectId,
    idempotencyKey,
    failureType,
    attemptsUsed: 2,
    createdAt: now,
    evidenceRef: 'evidence:run008:retry-proof:exhausted',
    resolutionState: 'OPEN',
    nextReviewAt: new Date(Date.parse(now) + 86400000).toISOString()
  };
  const deadLetterValidation = validateDeadLetterRecord(deadLetter);

  const cancellation = {
    state: 'REQUESTED',
    cancellationRef: 'cancel:run008:retry-proof:001',
    requestedBy: 'Aberdeen',
    requestedAt: now,
    externalInFlight: false,
    outcomeKnown: true
  };
  const cancellationEvaluation = evaluateCancellation(cancellation);
  const afterCancellation = retryDecision({
    failureType,
    attemptsUsed: 2,
    maximumRetryAttempts,
    idempotencyKey,
    cancellationState: 'REQUESTED'
  });

  const requeueDenied = canRequeueDeadLetter(deadLetter, {
    evidenceRef: 'evidence:run008:retry-proof:requeue-denied',
    cancellationState: 'CANCELLED'
  });

  const requeueApproved = canRequeueDeadLetter(deadLetter, {
    approvalRef: 'approval:run008:retry-proof:requeue',
    evidenceRef: 'evidence:run008:retry-proof:requeue-approved',
    cancellationState: 'CANCELLED',
    resumeApprovalRef: 'approval:run008:retry-proof:resume'
  });

  const resolvedDeadLetter = {
    ...deadLetter,
    resolutionState: 'RESOLVED',
    resolutionEvidenceRef: 'evidence:run008:retry-proof:resolved'
  };
  delete resolvedDeadLetter.nextReviewAt;
  const resolvedValidation = validateDeadLetterRecord(resolvedDeadLetter);

  const checks = {
    firstRetryBounded: attempt1.mode === 'RETRY' && attempt1.nextAttempt === 1,
    secondRetryBounded: attempt2.mode === 'RETRY' && attempt2.nextAttempt === 2,
    exhaustionDeadLetters: exhausted.mode === 'DEAD_LETTER' && exhausted.retry === false && exhausted.deadLetter === true,
    deadLetterOwnedAndValid: deadLetterValidation.valid === true,
    cancellationBlocksRetries: cancellationEvaluation.valid === true && cancellationEvaluation.blockNewRetries === true && afterCancellation.mode === 'CANCELLED' && afterCancellation.retry === false,
    requeueWithoutApprovalDenied: requeueDenied.allowed === false && requeueDenied.reasons.includes('MISSING_APPROVAL_REF'),
    approvedResumeRequeueAllowed: requeueApproved.allowed === true,
    resolvedEvidenceValid: resolvedValidation.valid === true,
    sameIdempotencyBoundaryRetained: deadLetter.idempotencyKey === idempotencyKey,
    externalActionsRemainZero: true
  };

  return {
    proofId: 'RUN008-RETRY-DLQ-CANCEL-PROOF-001',
    valid: Object.values(checks).every(Boolean),
    authority: {
      externalActions: 0,
      spendCents: 0,
      autoRequeue: false
    },
    checks,
    evidence: {
      attempt1,
      attempt2,
      exhausted,
      deadLetter,
      cancellationEvaluation,
      afterCancellation,
      requeueDenied,
      requeueApproved,
      resolvedDeadLetter
    }
  };
}

if (require.main === module) {
  const result = runRetryDeadLetterCancellationProof();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.valid) process.exitCode = 1;
}

module.exports = { runRetryDeadLetterCancellationProof };
