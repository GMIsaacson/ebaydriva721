# Factory v2 Regression — Run 009 Municipal Development Intelligence

**Regression ID:** REG-MUNI-INTEL-009-V2-001
**Run ID:** MUNI-INTEL-009
**Factory standard:** v2.0
**Date:** 2026-08-16
**Authority:** INTERNAL / READ-ONLY / NO CONTACT / $0

## Executive decision
Factory v2 correctly separates a strong Team 1 capability from an incomplete end-to-end business system.

- **A0 Architecture Discovery:** PASS
- **B0 Run Boundary Contract:** PASS
- **G0–G5 component evidence:** PASS / evidence reused where governing inputs and contracts remain unchanged
- **Capability Readiness:** 91/100 — COMPONENT READY / VALIDATION READY
- **System / Business Readiness:** 49/100 — PARTIAL, NOT SYSTEM READY
- **D0 Downstream Readiness:** FAIL
- **C0 Commercial / Outcome Validation:** NOT RUN; validation pack ready but external outreach not authorized
- **P0 Production Readiness:** FAIL / NOT ELIGIBLE
- **R0 Retrospective / Global Patch:** PASS — Factory v2 itself is the global patch produced from the original Run 009 lesson

No customer contact, recurring schedule, spend, bidding, paid-source access, credential change, or destructive action occurred during this regression.

## A0 — Architecture Discovery
**PASS.** The ultimate outcome is no longer defined as merely “find electrical leads.” The full system is:

`public municipal sources → source observations/documents → canonical development project → project lifecycle/events → trade opportunity lenses → customer matching → customer delivery → response/payment evidence → value/retention review → controlled expansion proposals`

Required downstream/shared capabilities are now visible before further building:
1. durable Canonical Project Store + Project Event model;
2. Downstream Opportunity & Commercialization Team;
3. customer profile/matching/delivery-history capability;
4. commercial feedback/outcome capture;
5. project lifecycle/change monitoring;
6. expansion intelligence/governance;
7. shared Operations Core controls.

## B0 — Run Boundary Contract
**PASS.** Run 009 owns municipal/project intelligence and initial electrical analysis only. It does not own commercialization, unrestricted trade/geography expansion, payments, customer delivery, or the whole operational project graph.

Canonical handoff: **Canonical Project Package v1.0**.

## G0–G5 — Existing component proof under new boundary
Historical/same-cycle evidence remains valid because B0 narrows and clarifies the original component rather than changing its source universe, read-only authority, scoring, or QA behavior.

### G0 Opportunity — PASS
Outcome inside boundary: produce trustworthy project intelligence for downstream consumption.

### G1 Classification — PASS
Responsibilities remain separated across source scouting, extraction, intelligence, electrical analysis, enrichment, QA, and internal delivery/portfolio functions.

### G2 Design — PASS
Typed handoffs, rejection/confidence/dedupe rules and explicit authority exist. Factory v2 adds CPP v1.0 as the downstream contract.

### G3 Simulation/shadow — PASS
25 unique candidates: 17 ACTIONABLE, 3 WATCH, 5 REJECTED; zero duplicate leakage; zero external actions.

### G4 Deployment/internal runtime — PASS
Deterministic normalization, geography fail-closed behavior, duplicate suppression, confidence floors, evidence/QA handling and ranked internal output were proven.

### G5 Read-only live source proof — PASS
All four approved municipal sources succeeded in the live proof: 14 total signals, all entering downstream processing as WATCH; 0 external actions; $0; recurring schedules disabled.

## Dual readiness assessment

### Capability Readiness — 91/100
**Status: COMPONENT READY / VALIDATION READY**

Evidence:
- four-source read-only collection proof;
- deterministic project pipeline;
- official/public provenance;
- duplicate/rejection/confidence controls;
- customer sample/validation pack prepared;
- explicit authority ceiling;
- versioned boundary and downstream package defined.

Remaining component-level gaps:
- CPP v1.0 is defined but not yet accepted by a live durable downstream receiver;
- recurring lifecycle/change monitoring has not been activated;
- customer feedback has not yet calibrated usefulness/scoring.

### System / Business Readiness — 49/100
**Status: PARTIAL / NOT SYSTEM READY**

Blockers:
- durable Canonical Project Store not implemented as the operational destination;
- downstream Opportunity & Commercialization Team not implemented/validated;
- customer matching/delivery history not operational;
- commercial willingness-to-pay not tested;
- project lifecycle/event management not operational end-to-end;
- production monitoring and continuous delivery chain cannot yet be tested as a complete system.

## D0 — Downstream Readiness
**FAIL — expected and correct.**

Why:
- named downstream consumer exists architecturally, but the durable receiver is not yet built/operational;
- CPP v1.0 has not completed an acceptance/rejection cycle against that receiver;
- project lifecycle ownership after Team 1 handoff is not operational;
- customer-specific downstream processing is not available;
- therefore granting Run 009 recurring production authority would create orphaned or partially managed output.

D0 exit requirements:
1. implement durable Canonical Project Store + Project Event model;
2. implement downstream consumer capable of accepting/rejecting CPP v1.0;
3. prove idempotent handoff with provenance retained;
4. assign unresolved-record ownership and remediation path;
5. prove downstream capacity/health/availability.

## C0 — Commercial / Outcome Validation
**NOT RUN.**

Prepared:
- 5-opportunity customer sample;
- 13-company commercial-electrical prospect cohort;
- bounded outreach/follow-up drafts;
- pricing hypotheses and success criteria.

Blocked by authority:
- no real customer contact has been approved.

C0 remains the correct place to test usefulness and willingness-to-pay. Technical success does not substitute for customer evidence.

## P0 — Production Readiness
**FAIL / NOT ELIGIBLE.**

Run 009 should not receive unattended recurring-production authority because D0 has failed and the broader end-to-end system does not yet have:
- durable project/event lifecycle store;
- complete downstream receiver chain;
- customer delivery/matching controls;
- full-system heartbeat/health;
- end-to-end replay/recovery and unknown-outcome handling;
- production KPIs tied to actual customer value;
- proven commercial demand.

Team 1's internal collector could technically run on a schedule, but Factory v2 correctly refuses to equate schedulability with production readiness.

## R0 — Retrospective / Global Patch
**PASS.**

Original surprise:
A locally strong intelligence team was initially allowed to appear too close to the whole business.

Generalizable defects identified:
1. missing mandatory whole-system architecture review before G0;
2. missing explicit Run boundary contract;
3. no separate capability-vs-business readiness status;
4. no mandatory downstream readiness check;
5. no production-readiness overlay beyond local workflow success;
6. no guaranteed mechanism for Run lessons to patch the Factory globally.

Global patch produced:
**Agent Team Factory v2.0** with A0, B0, dual readiness, D0, C0, P0, R0 and contract versioning.

No additional Factory-wide defect was discovered in this regression that warrants a new v2.1 patch before the next step.

## Correct next build sequence
1. Keep Run 009 Team 1 frozen at VALIDATION READY / no-contact authority.
2. Build the durable Canonical Project Store + Project Event model as shared/system infrastructure.
3. Build the downstream Opportunity & Commercialization Team against CPP v1.0.
4. Re-run D0 using a real Team 1 → store → downstream consumer handoff.
5. Obtain explicit owner approval for bounded C0 customer validation.
6. Only after D0 + C0 evidence, design and test P0 for continuous operation.
7. Geographic/trade expansion remains proposal-only until separate architecture/approval amendments.

## Regression verdict
**FACTORY v2 REGRESSION PASS.**

The new Factory catches the exact problem that the previous flow missed before any new downstream team is built. Run 009 is not rebuilt unnecessarily; its valid component evidence is retained, its boundary is narrowed and versioned, and the missing system components are now identified as separate required work.