# Agent Team Factory v2 Operating Standard

**Version:** 2.0
**Owner:** Run 007 — Systems Intelligence & Development Team

## Purpose
Turn the Agent Team Factory from a component builder into a whole-system build discipline. The Factory must distinguish a locally working capability from a complete, operable, commercially useful system.

## Canonical sequence
`Opportunity / Need → A0 Architecture Discovery → B0 Run Boundary Contract → G0–G5 Build/Test → D0 Downstream Readiness → C0 Commercial/System Validation where applicable → P0 Production Readiness → Controlled Activation → R0 Retrospective / Global Patch`

The existing G0–G7 labels remain valid for historical runs. The new control points are mandatory overlays and do not require renumbering every existing Run.

## A0 — Architecture Discovery
Owned by Run 007. No substantial Run enters G0 without an approved whole-system map.

## B0 — Run Boundary Contract
Immediately after A0 and before G0, every substantial Run must state:
- exact component/closed loop being built;
- inputs and upstream owners;
- outputs and downstream consumers;
- IN SCOPE / OUT OF SCOPE;
- canonical records/stores touched;
- authority ceiling;
- explicit completion condition;
- downstream handoff contract;
- version IDs of governing architecture/contracts.

A Run may not silently absorb adjacent responsibilities discovered during implementation. Material scope changes require an Architecture Amendment and a new Boundary Contract version.

## Dual readiness model
Every major gate review must report two independent readiness ratings:

### Capability Readiness
Can this team/component reliably perform the job defined by its Boundary Contract?

### System / Business Readiness
Can the surrounding end-to-end system produce the intended business/operational outcome?

A high Capability Readiness score may coexist with low System/Business Readiness. The Factory must never report a component as "business ready" merely because its own tests pass.

Recommended scale:
- 0–39: not ready
- 40–69: partial
- 70–84: controlled validation ready
- 85–94: production candidate
- 95–100: mature/validated

Each score must include evidence and unresolved blockers; scores are summaries, not substitutes for gate criteria.

## D0 — Downstream Readiness
Before a component is considered operationally complete or granted recurring authority, prove that its output has a real governed destination.

Required checks:
- named downstream consumer or final-outcome owner;
- versioned handoff schema/contract;
- durable destination/store where applicable;
- reject/remediation path;
- duplicate/idempotency behavior across the handoff;
- provenance retained end-to-end;
- downstream capacity/availability confirmed;
- ownership for unresolved records;
- no orphan output queues.

D0 fails if the team produces useful output but nobody/system is ready to receive, store, manage, or act on it.

## C0 — Commercial / Outcome Validation
Required whenever the ultimate outcome depends on customers, revenue, adoption, behavior change, or another external value hypothesis.

Validate separately from technical success. Define:
- target user/customer;
- sample/deliverable;
- pricing/value hypothesis where relevant;
- bounded validation cohort;
- success/failure thresholds;
- evidence collection;
- authority for outreach/delivery.

No commercial inference may be treated as proven before real evidence exists.

## P0 — Production Readiness
No unattended recurring production, automatic external delivery, or production authority until P0 = PASS.

Required P0 controls:
- durable operational storage and lifecycle states;
- health/heartbeat and source/dependency monitoring;
- staleness detection;
- retry/replay and idempotency;
- unknown-outcome handling;
- rate/cost/resource limits;
- quality/false-positive monitoring;
- escalation/human review queues;
- privacy/retention/sensitivity rules;
- credential/secret boundaries;
- source-access/legal/licensing constraints where applicable;
- kill switch / disable path;
- recovery procedure;
- audit trail and evidence provenance;
- owner-visible KPIs;
- downstream readiness confirmed;
- contract/version compatibility confirmed.

Production readiness is a system property, not just a workflow property.

## R0 — Retrospective → Global Patch
At each major validation milestone and before closing/activating a Run, ask:
1. What surprised us?
2. What should A0 have exposed earlier?
3. Which defect is local versus Factory-wide?
4. Which new test/control should become mandatory globally?
5. Did any boundary, handoff, authority, data, commercial, or operability assumption fail?
6. What should be added to Run 007's capability/dependency map?

If a lesson is generalizable, Run 007 must create a versioned **Factory Patch** rather than leaving it as a Run-specific note.

## Contract versioning
All material architecture/control artifacts are versioned.

Minimum versioned contracts:
- System Map / Architecture ID;
- Run Boundary Contract;
- handoff/input/output schemas;
- authority profile;
- lifecycle/state contract;
- scoring/policy contract;
- customer/delivery contract where applicable;
- production-readiness profile.

Use semantic intent rather than software-package semantics:
- major: boundary/authority/data-contract breaking change;
- minor: additive compatible capability or field;
- patch: clarification/test/control with no behavioral contract break.

A breaking contract change requires explicit impact review and revalidation of affected downstream/upstream components.

## Architecture Amendments
When later evidence reveals a material missing capability or mistaken boundary:
- document what was unknowable versus what A0 missed;
- update the System Map version;
- identify impacted Runs/contracts;
- decide PATCH CURRENT RUN / NEW RUN / SHARED INFRA CHANGE / PAUSE AUTHORITY;
- rerun relevant B0, D0, C0, or P0 checks.

## Factory completion language
Use precise status language:
- `COMPONENT READY` — Capability Readiness passed for defined boundary.
- `VALIDATION READY` — safe for bounded outcome/customer test.
- `SYSTEM READY` — required surrounding capabilities and handoffs are ready.
- `PRODUCTION READY` — P0 passed for approved authority.
- `ACTIVE` — explicitly authorized production operation.

Never collapse these into a generic "done".
