# Run 006 — Subscription Operations Team

Run 006 builds an inactive, non-production subscription-operations team for Aberdeen. It turns authorized billing evidence into deduplicated Subscription Register proposals, renewal and waste exceptions, and a per-agent performance list.

## Contract

- Run ID: SUB-OPS-006
- Workflow ID: WF-SUB-OPS-006-G4-001
- Current target: G4 non-production deployment
- Trigger: manual only
- Authority: Observe, Recommend and Draft
- External actions: 0
- Notion writes during G4: 0
- AI calls required during G4: 0
- Spending authority: $0
- Schedule/webhook: disabled
- Secrets: prohibited from input, output, source and Notion

## Team

1. Subscription Operations Lead
2. Evidence Discovery Agent
3. Subscription Reconciliation Agent
4. Renewal and Spend Watcher
5. Subscription Evidence and QA Agent
6. Subscription Baseline Workflow
7. Subscription Policy and Metrics Engine

## Data boundary

The runtime may process a minimal, structured evidence packet containing vendor, plan, account email, price, billing cadence, renewal/cancellation dates, evidence reference and usage state. It must never retain raw email bodies, passwords, recovery codes, API keys, access tokens, full card numbers or bank details.

## Execution split

- Deterministic software performs schema checks, redaction checks, normalization, idempotency, deduplication, monthly-equivalent calculations, deadline rules and policy enforcement.
- The fixed workflow sequences ingestion, reconciliation, exception generation and the draft performance report.
- Agents may interpret uncertain evidence and recommend a decision in later shadow runs, but G4 requires no model call.
- Only the owner may approve cancellation, purchase, plan changes, payment changes, credential changes, vendor contact or recurring activation.

## Commands

    npm run test:run006
    npm run validate:run006
    npm run demo:run006

## G4 pass criteria

1. All structural, boundary, failure and adversarial tests pass.
2. The workflow remains inactive, manual-only, credential-free and external-action-free.
3. Duplicate events and duplicate subscription evidence are suppressed deterministically.
4. Sensitive data and authority expansion are rejected before processing.
5. Every proposed durable fact retains provenance, observation date and confidence.
6. The output includes a zero-cost performance row for every registered unit.
7. Firestore emulator rules are default-deny.
8. An isolated n8n import, execution and inactive export passes before G4 promotion.

## Not authorized

Real Gmail ingestion, live Notion writes, schedules, vendor messages, cancellations, purchases, account changes and payment actions remain outside G4.
