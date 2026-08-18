# Run 011 — Opportunity Intelligence Team

Run 011 is the pre-portfolio intelligence layer for Aberdeen. It discovers candidate business models from approved sources, normalizes claims into comparable records, underwrites them with a deterministic 100-point rubric, suppresses duplicates, and prepares qualified internal escalation recommendations for the existing Opportunity Portfolio Steward.

## G4 contract

- Run ID: `OPP-INTEL-011`
- Workflow ID: `WF-OIT-011-G4-001`
- Boundary contract: `B0-OIT-011-v1.0`
- Current target: G4 non-production deployment
- Trigger: manual only
- Workflow source state: inactive
- Incremental paid-tool cost: $0
- External actions: 0
- Canonical Opportunity Portfolio writes: 0
- AI calls required for G4 acceptance: 0
- Schedule/webhook: disabled
- Credentials: prohibited from source

## Responsibility split

1. Opportunity Source Scout — probabilistic source interpretation.
2. Business Model Normalizer — facts/claims/assumptions normalization.
3. Opportunity Underwriter — economic reconstruction and dimension ratings.
4. Portfolio Fit Router — semantic overlap and opportunity-cost recommendation.
5. Deterministic Policy Engine — source, schema, score, threshold, duplicate, idempotency, cost and authority guards.
6. Opportunity Intelligence Workflow — manual internal sequencing only.
7. Owner + existing Opportunity Portfolio Steward — consequential approvals and downstream portfolio authority.

At G4, no model call is needed: the package proves the deterministic control plane and n8n execution boundary using synthetic calibration evidence. Later shadow/model gates may exercise the agent reasoning roles with real public inputs under the existing source registry.

## Scoring

The score engine owns arithmetic. Ratings are 1–5.

- Speed to revenue: 20
- Strategic fit: 15
- Automation potential: 15
- Evidence strength: 15
- Revenue potential: 15
- Low execution effort: 10 (inverse of execution-effort rating)
- Async operability: 5
- Defensibility: 5

Escalation requires score >= 80, evidence strength >= 3/5, no unresolved fatal risk, and a qualifying duplicate disposition. A duplicate can never be promoted just because its raw score is high.

## G4 deterministic demonstration

The source-controlled fixture contains three calibration cases:

- OIT-001: 92 / Unique -> Escalate
- OIT-006: 81 / Duplicate -> Archive
- OIT-007: 77 / Unique -> Watch

Expected summary: 1 Escalate, 1 Watch, 1 Archive, 1 duplicate suppressed, $0 incremental cost, 0 external actions, 0 canonical portfolio writes, 0 AI calls.

## Commands

    node --test agent-factory/run-011/tests/runtime.test.cjs
    node agent-factory/run-011/scripts/validate-package.cjs
    node agent-factory/run-011/scripts/run-demo.cjs

## G4 pass criteria

1. All 18 structural/boundary/failure/adversarial cases pass.
2. Deterministic score recomputation controls over agent-claimed totals.
3. Active-source, schema, evidence-strength, source-count and duplicate rules fail closed.
4. Paid-tool, external-action, schedule and canonical-portfolio-write attempts are rejected.
5. Idempotency and unknown-write recovery are explicit.
6. The n8n workflow imports inactive, executes only synthetic internal evidence, and exports inactive with no credentials.
7. GitHub Actions retain read-only repository permission.
8. Application build remains green.

## Not authorized

Recurring monitoring, paid APIs/tools, prospect/vendor contact, messages, form submissions, account creation, publishing, production deployment, canonical Opportunity Portfolio insertion/stage changes, purchases, or any other external business action remain outside G4.
