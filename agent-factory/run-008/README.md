# Run 008 — Operations Core v0.1

## Purpose
Build the reusable shared operations foundation that future personal and business operating modules can consume without recreating ingestion, evidence, decisions, notifications, health, cost, privacy, and recovery logic.

## Run ID
`OPS-CORE-008`

## Lifecycle
Proposed / Designing

## Current Gate
G0 — Definition

## Why this run exists
Run 006 demonstrated that subscription operations already needs source coverage, evidence normalization, deterministic reconciliation, owner alerts, bounded external actions, auditability, and recovery controls. Run 007 identified that the same patterns will recur across follow-up, inbox obligations, bills, documents, security, warranties, contracts, and other future modules.

Run 008 extracts those repeated patterns into a reusable core.

## Core components
1. Source & Identity Registry
2. Evidence / Provenance Envelope
3. Decision & Approval Inbox
4. Notification & Escalation Service
5. System Health / Heartbeat Monitor
6. Cost & Resource Ledger
7. Data Sensitivity & Retention Policy
8. Recovery / Replay / Idempotency Standard
9. Dependency & Blocker Graph
10. Outcome & Automation Value Review

## Authority
Run 008 may design, validate, and produce internal infrastructure artifacts. It may not:
- spend money;
- contact external parties;
- change subscriptions, accounts, payment methods, or credentials;
- perform destructive external actions;
- activate recurring schedules or production automations without a later gate and explicit authorization.

Default external actions: 0.

## Design principles
- Build shared primitives once; downstream modules compose them.
- Evidence first, action second.
- Deterministic policy at authority boundaries.
- Fail closed when provenance, authority, or validation is missing.
- Human approval for costly, destructive, external, or irreversible actions.
- Every active watcher must itself be observable through health/heartbeat state.
- Every reusable service must expose audit and recovery state.
- Notion remains the control plane where appropriate; n8n remains connector/execution infrastructure; PostgreSQL is appropriate for durable operational state.

## Initial implementation order
1. Define canonical contracts for source, evidence, decision, notification, heartbeat, and cost events.
2. Define storage model and idempotency keys.
3. Define authority gateway and approval states.
4. Define notification routing, suppression, cooldown, and cost caps.
5. Define health heartbeat and stale-watcher rules.
6. Define dependency/blocker representation.
7. Prove compatibility by mapping Run 006 subscription operations onto the new contracts without changing Run 006 live authority.
8. Only after validation, allow future Runs 009+ to depend on Operations Core.

## Acceptance criteria for v0.1
- A downstream module can register a source without storing secrets in source control.
- Evidence from multiple sources can be normalized into one canonical envelope with provenance.
- An exception can become a decision request with explicit authority required.
- Notifications are deduplicated, rate-limited, channel-routed, and cost-bounded.
- Every watcher can emit heartbeats and be marked healthy, stale, degraded, or failed.
- Replayed events cannot create duplicate external actions.
- Cost-bearing actions expose approved cost ceilings before execution.
- Sensitive data has classification and retention rules.
- Dependencies/blockers can be represented and queried.
- Run 006 can be expressed against the contracts as the first compatibility proof.
- No live production authority is enabled by completing v0.1.

## Resume Here
Design the canonical contracts first. Do not build downstream managers yet. The first proof target is Run 006 compatibility.
