# Factory v2 Regression — Run 009 Municipal Development Intelligence

**Purpose:** Prove the revised Factory would expose Run 009's missing system layers before treating Team 1 as a complete business.

## Architecture
- Architecture: `A0-MUNI-INTEL-001`
- A0 status: PASS (retrofit)
- Ultimate outcome: development-intelligence system that discovers projects, maintains lifecycle, converts them to trade/customer opportunities, delivers value, captures commercial outcomes, and proposes governed expansion.

## B0 Run Boundary Contract — reconstructed
**Contract ID:** `B0-MUNI-INTEL-TEAM1`
**Version:** 1.0

### Team 1 mission
Convert approved municipal/public sources into evidence-backed canonical development intelligence and initial electrical opportunity analysis.

### Inputs
Approved public municipal sources and source documents/observations.

### Outputs
Versioned `Canonical Project Package` for a downstream project store/opportunity-commercialization consumer.

### In scope
- source discovery/read-only collection;
- extraction/evidence;
- project canonicalization/deduplication;
- QA/confidence;
- initial electrical relevance;
- canonical project package creation.

### Out of scope
- unrestricted geographic/trade expansion;
- customer acquisition/outbound;
- subscriptions/payments/pricing authority;
- multi-trade commercialization;
- customer matching/delivery history;
- global canonical project store/lifecycle ownership;
- autonomous production scheduling.

**B0 result:** PASS as a component boundary. This would have prevented Team 1 from being mistaken for the entire platform.

## Readiness scores at current checkpoint
### Capability Readiness: 90/100
Evidence: G3/G4/G5 regression suites and G5 live proof; four approved municipal sources succeeded; bounded collector + deterministic pipeline function correctly.

Remaining capability gaps: durable canonical package persistence/handoff and production-grade lifecycle monitoring are outside Team 1's current boundary.

### System / Business Readiness: 48/100
Evidence: G6 sample pack exists, but customer willingness-to-pay is untested; canonical durable project/event store is not yet deployed for this system; downstream opportunity/commercialization team is not built; continuous lifecycle/delivery is not production-authorized.

**Factory v2 conclusion:** Team 1 is `VALIDATION READY`, not `SYSTEM READY` or `PRODUCTION READY`.

## D0 Downstream Readiness
- Named downstream consumer: identified conceptually, not yet built — FAIL.
- Versioned handoff: Canonical Project Package fields defined, but receiver contract not mutually implemented — PARTIAL.
- Durable destination/store: proposed PostgreSQL/project-event model, not yet deployed for Run 009 — FAIL.
- Reject/remediation: defined conceptually — PASS.
- Provenance preservation: Team 1 supports provenance — PASS.
- No orphan outputs: current G6 pack is internal/manual; continuous stream would be orphaned — FAIL for recurring operation.

**D0 result: FAIL for continuous operation.**

Required remediation:
1. build/reuse canonical project + project event store;
2. implement versioned Team 1 → downstream handoff;
3. build the downstream Opportunity & Commercialization Team or explicitly designate final-outcome owner;
4. prove reject/replay/idempotency across the receiver boundary.

## C0 Commercial / Outcome Validation
Current status: READY TO TEST, NOT PROVEN.

Defined evidence thresholds exist in G6. No customer outreach has occurred, therefore demand/pricing cannot be called validated.

**C0 result: NOT RUN.**

## P0 Production Readiness
Current status: FAIL / NOT REQUESTED.

Missing or intentionally inactive for the complete system:
- production canonical store/lifecycle;
- downstream operational receiver;
- commercial proof;
- recurring collection authorization;
- customer delivery authority;
- end-to-end health across downstream system;
- customer-level dedupe/delivery history;
- production kill-switch/recovery test for complete chain.

**P0 result: FAIL until downstream system and commercial validation exist.**

## R0 Retrospective → Global Patch
### Generalizable lessons
1. Whole-system architecture must precede component design → A0.
2. Every Run needs an explicit owned/not-owned contract → B0.
3. A working producer is incomplete if its receiver/store is missing → D0.
4. Technical capability and business/system readiness must be reported separately → dual readiness scores.
5. Repeated/unattended operation needs a system-level production gate → P0.
6. Run lessons must patch the Factory globally → R0.
7. Architecture, handoffs, authority and lifecycle contracts must be versioned.

**R0 result:** Factory Patch required; encoded in Factory v2.0.

## Regression verdict
**PASS.** Factory v2 detects the exact blind spots that surfaced after Run 009 was built and gives each one a mandatory owner/gate before production authority.

If Run 009 were restarted today, the expected sequence would be:
`A0 system map → B0 Team 1 boundary → G0–G5 Team 1 proof → D0 reveals missing project store/downstream team → build those components → C0 customer validation → P0 production readiness → controlled activation → R0 global patch review`.
