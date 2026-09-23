# Run 011 — Opportunity Intelligence Team

Run 011 is Aberdeen's pre-portfolio intelligence layer. It discovers candidate business models from approved sources, normalizes claims into comparable records, underwrites them with a 100-point rubric, checks portfolio overlap, and prepares qualified internal escalation recommendations for the existing Opportunity Portfolio Steward.

## Current bounded contract

- Run ID: `OPP-INTEL-011`
- Workflow ID: `WF-OIT-011-G4-001`
- Workflow version: `1.1.0`
- Boundary contract: `B0-OIT-011-v1.0`
- Current evidence target: G5 Shadow after G4 PASS
- Trigger: manual only
- Workflow source state: inactive
- Incremental paid-tool cost: $0
- External actions: 0
- Canonical Opportunity Portfolio writes: 0
- AI calls in deterministic G4/G5 control runs: 0
- Schedule/webhook: disabled
- Credentials: prohibited from source

## Responsibility split

1. Opportunity Source Scout — probabilistic source interpretation.
2. Business Model Normalizer — facts/claims/assumptions normalization.
3. Opportunity Underwriter — economic reconstruction and dimension ratings.
4. Portfolio Fit Router — semantic overlap, opportunity-cost judgment, and proposed `Escalate / Watch / Archive / Blocked` route.
5. Deterministic Policy Engine — source, schema, score, eligibility, idempotency, cost and authority enforcement. It validates the Router's recommendation; it does not replace semantic judgment.
6. Opportunity Intelligence Workflow — manual internal sequencing only.
7. Owner + existing Opportunity Portfolio Steward — consequential approvals and downstream portfolio authority.

## Scoring

The deterministic score engine owns arithmetic. Ratings are 1–5.

- Speed to revenue: 20
- Strategic fit: 15
- Automation potential: 15
- Evidence strength: 15
- Revenue potential: 15
- Low execution effort: 10 (inverse of execution-effort rating)
- Async operability: 5
- Defensibility: 5

An `Escalate` recommendation is valid only when score >= 80, evidence strength >= 3/5, no fatal unresolved risk remains, the candidate is not a Duplicate/Needs Review, and a Material Variant has an explicitly confirmed material improvement. Duplicate candidates may remain `Watch` when they contribute useful evidence; they can never escalate merely because their raw score is high.

## G4 result

G4 passed on draft PR #27. The source-controlled synthetic fixture proves:

- OIT-001: 92 / Unique / Router Escalate -> Escalate
- OIT-006: 81 / Duplicate / Router Archive -> Archive
- OIT-007: 77 / Unique / Router Watch -> Watch

The workflow imported inactive into isolated n8n, executed internally, exported inactive, contained no credentials/external-action nodes, and retained zero external actions/canonical portfolio writes/model calls/paid-tool cost.

## G5 shadow repair and test

The first real Calibration 001 comparison exposed a policy defect: semantic duplicate/variant disposition was being over-determined by software. The v1.1 routing contract fixes that by making the Portfolio Fit Router propose the semantic route while deterministic software enforces the recommendation ceiling.

The G5 fixture contains all 10 real, previously supervised Koerner Calibration 001 records. Required parity is exactly:

- 2 Escalate
- 7 Watch
- 1 Archive
- 0 Blocked
- 3 Duplicate candidates suppressed from escalation
- 10/10 exact route parity
- $0 incremental paid-tool cost
- 0 external actions
- 0 canonical Opportunity Portfolio writes
- 0 model calls in the deterministic replay

This proves post-normalization routing parity. It does **not** claim autonomous source interpretation is already production-ready.

## Commands

    node --test agent-factory/run-011/tests/*.test.cjs
    node agent-factory/run-011/scripts/validate-package.cjs
    node agent-factory/run-011/scripts/run-demo.cjs
    node agent-factory/run-011/scripts/run-g5-shadow.cjs

## Not authorized

Recurring monitoring, paid APIs/tools, prospect/vendor contact, messages, form submissions, account creation, publishing, production deployment, canonical Opportunity Portfolio insertion/stage changes, purchases, or any other external business action remain unauthorized.
