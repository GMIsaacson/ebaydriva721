# Run 009 — Municipal Development Intelligence Team

**Run ID:** MUNI-INTEL-009
**Initial market:** Twin Cities commercial development → commercial electricians
**Purpose:** Detect early commercial-development signals from public municipal sources and turn them into evidence-backed, trade-specific opportunities before they become obvious.

## Business hypothesis
Commercial electrical contractors will pay for timely, evidence-backed project intelligence that tells them what is being built, where, by whom, project stage/timing, likely electrical scope, and the best next action.

## Initial product
A recurring project-opportunity feed with:
- project / development name
- municipality and site location
- project type and scale
- current planning / permit stage
- developer / owner / architect / GC when evidenced
- likely electrical opportunity
- estimated timing window
- confidence score
- evidence links / source documents
- recommended next action

## Team
1. **Municipal Source Scout** — discovers and monitors approved public municipal sources.
2. **Document Extraction Agent** — turns agendas, packets, permits, staff reports, and notices into structured candidate projects.
3. **Project Intelligence Agent** — reconciles duplicates and builds the canonical project record.
4. **Electrical Opportunity Analyst** — determines whether the project is relevant to commercial electricians and why.
5. **Entity Enrichment Agent** — identifies evidenced developer/owner/architect/GC/business contact channels without fabricating data.
6. **Evidence & QA Reviewer** — verifies claims, confidence, freshness, source provenance, and rejects weak opportunities.
7. **Delivery/Portfolio Agent** — ranks validated opportunities and prepares customer-ready internal feed output.

## Authority
G0–G3 default is observation, analysis, internal write, and draft only.

Not authorized without later gate approval:
- contacting developers, contractors, municipalities, or prospects
- sending customer messages
- buying data
- submitting bids
- creating paid subscriptions
- recurring production schedules
- destructive or account-changing actions

## Pilot scope
Start narrow. Use a small Twin Cities municipality set and one trade: commercial electrical.

The team must prove it can autonomously produce **25 candidate projects**, of which at least **10 pass QA as genuinely actionable electrical opportunities**, before any monetization or live outreach gate.

## Initial quality bar
A passing opportunity must have:
- at least one authoritative/public source
- project identity and location
- current project stage
- evidence of commercial construction or material redevelopment
- a defensible electrical-work thesis
- confidence >= 0.75
- no unsupported company/contact claims
- duplicate suppression

## Initial economic target
Month-12 target hypothesis: 12 subscribers × $349/month = $4,188 MRR.
This is a validation target, not a forecast.

## Run 008 compatibility
Run 009 should reuse Operations Core patterns for provenance, idempotency, decisions, notification routing, heartbeats, privacy/retention, blockers, recovery, and automation-value review as those components become deployable.

## Gates
- **G0:** opportunity and authority definition
- **G1:** source universe + data contract + acceptance criteria
- **G2:** team design, handoffs, scoring rules, red-team tests
- **G3:** synthetic/historical simulation producing ranked project records
- **G4:** shadow run on current public sources, no customer delivery
- **G5+:** controlled customer validation only after explicit approval

## Resume Here
Complete G1 by defining the first municipality/source universe, canonical project schema, electrical relevance scoring rubric, and source-access rules. Then run a small manual evidence sample before automating collection.
