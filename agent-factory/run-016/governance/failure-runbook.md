# Failure runbook

## Fail closed

Stop or isolate an item when its source is unavailable, provenance is missing, claim mode is ambiguous, evidence is stale, the item is a duplicate without a material delta, an untrusted directive is detected, a price lacks basis, a medical claim lacks stage or regulatory status, or defense material contains operational instruction.

## Retries and dead letters

- Retry transient read or extraction failures at most twice with the same idempotency key.
- Do not retry authentication, permission, policy, unsupported-format, or terms-of-use failures automatically.
- Do not retry an external action with an unknown outcome.
- Put exhausted or non-retryable items into the dead-letter queue with source, error class, attempt count, and next human decision.

## Stop, cancel, and recover

The control plane checks cancellation before acquisition, analysis, QA, and handoff. A canceled run writes a terminal receipt and sends nothing. Recovery resumes from the last immutable handoff, not from free-form model memory.

## Escalation

Escalate source outages, unexplained coverage collapse, repeated false alerts, unsafe content, credential ownership gaps, cost-limit exhaustion, and any requested authority expansion to Aberdeen Technologies. OPS-CORE-008 acceptance and execution must be independently recorded before operations are claimed.

