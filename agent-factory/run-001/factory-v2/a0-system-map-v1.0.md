# Run 001 — Kinetiq Seller Conversion Lab — A0 System Map v1.0

**Architecture ID:** A0-KIN-SCL-001
**Run ID:** KIN-FACTORY-001
**Owner:** Run 007 / Aberdeen Technologies
**Status:** PASS

## 1. Ultimate outcome
Build a zero-phone-call, agent-operated and human-governed service that converts evidence-backed weak marketplace listings into paid Kinetiq visual-improvement projects, delivers verified assets, measures client value and margin, and supports repeat/monitoring revenue only after demand is proven.

## 2. End-to-end value chain
`Marketplace/listing signals → opportunity detection → seller/brand identity → qualification → diagnostic/sample → approved outreach → reply/qualification → fixed offer → payment/intake verification → research/evidence package → Kinetiq asset production → independent QA → owner approval → digital delivery → revisions/closeout → outcome/margin measurement → renewal/monitoring or portfolio learning`

## 3. Capability inventory
| Capability | Disposition | Owner / system |
|---|---|---|
| Listing/opportunity discovery | EXISTING / PARTIAL | Opportunity Portfolio Steward + Research |
| Seller/brand identity and public contact verification | PARTIAL | Pipeline + Research |
| Prospect/pipeline control | EXISTING at validation scale | Notion control records |
| Outreach drafting/reply classification | EXISTING, DRAFT ONLY | Pipeline & Reply Coordinator |
| External sending | NOT AUTHORIZED | Human approval gate |
| Offer ladder | EXISTING hypothesis | $49 diagnostic / $499 conversion pack / $999 image+video / $149 monitoring |
| Payment verification / invoicing | PARTIAL / integration missing | Human + future approved payment integration |
| Intake/scope lock | EXISTING contract, manual | Client Readiness Contract + Delivery Coordinator |
| Research/evidence | EXISTING | Research & Validation Agent |
| Visual asset production | EXISTING core capability | Kinetiq Studio / Offer & Asset Builder |
| Independent QA | EXISTING | Evidence & Quality Agent |
| Digital delivery/version control | PARTIAL/manual | Delivery Coordinator + owner approval |
| Revision/support loop | PARTIAL/manual | Delivery Coordinator |
| Outcome/margin measurement | PARTIAL; strengthen | VP + scorecard |
| Monitoring/renewal product | DEFER until C0 evidence | Future recurring capability |
| Production integrations/scheduling | DEFER until P0 | Gmail/payment/automation integrations |
| Governance/approvals | REUSE | Factory SAFE + Run 008 patterns + Notion |

## 4. Natural system boundaries
### Team 1 — Opportunity & Conversion component
Owns discovery, qualification, evidence, prospect packet, outreach/reply drafts, fixed-offer handoff, and internal conversion tracking.

### Team 2 — Client Delivery component
Owns verified paid handoff, intake/scope lock, research coordination, asset build, QA, delivery package, revision state, closeout, and outcome capture.

These may use the existing Kinetiq seven-agent company roster, but the operational boundary between acquisition/conversion and paid-client delivery must remain explicit.

### Owner/governance
Owns every external send in v1, commercial exceptions, pricing changes, payment actions, final delivery approval, refunds, new integrations, schedules, and authority changes.

## 5. Canonical records / stores
At pilot scale, do **not** introduce a new database solely for architecture purity. Use existing Notion control records as the canonical operational system for prospect, approval, project, version, delivery, and outcome state. Supporting artifacts may remain in GitHub/Drive as evidence/assets.

Re-evaluate PostgreSQL/Supabase only when volume, concurrency, automation, or customer self-service makes Notion materially inadequate.

Canonical entities:
`listing_opportunity → seller_brand → prospect → outreach_packet → reply → offer → payment_intake → client_project → evidence_package → asset_version → qa_decision → delivery → revision → closeout → outcome`

## 6. Required handoffs
1. Opportunity Steward → Pipeline: qualified prospect package with listing evidence, seller/brand identity confidence, public business channel, opportunity score, and reason to contact.
2. Pipeline → Human approval: exact recipient/channel/message/offer/version.
3. Pipeline → Delivery: verified acceptance/payment + Client Readiness Contract + scope/product/version IDs.
4. Builder → QA: complete evidence-linked asset package.
5. QA → Human delivery approval: PASS/FAIL/ESCALATE tied to exact client/project/version.
6. Delivery → Outcome review: delivery/revision/closeout evidence, revenue, cost/time, client signal, next action.

## 7. Dependencies / build sequence
1. Preserve existing G0–G3 evidence and seven-agent roster.
2. Lock B0 Run Boundary Contract and handoff schemas.
3. G4: deploy inactive/non-production zero-phone-call pipeline with telemetry and stop/restart controls.
4. G5: shadow on real listing/prospect inputs with no external send; prove qualification, identity, dedupe, handoffs and QA.
5. D0: prove the prospect-to-paid-project and builder-to-delivery destinations are governed and non-orphaned.
6. C0: run a bounded real commercial validation only after explicit outreach authority; measure replies, purchases, delivery acceptance, margin and repeat interest.
7. P0 only if evidence supports unattended recurring operation or monitoring.

## 8. Authority map
- Observe/research/internal records: allowed within approved sources.
- Draft outreach, offers, reports and delivery packages: allowed.
- External message send: owner approval required in v1.
- Payment/invoice/refund/money movement: owner action/approval required.
- Final client delivery: owner approves exact version and recipient.
- Pricing/scope exception: owner only.
- Recurring monitoring, autonomous outreach, new paid tools or schedules: prohibited until separately gated.

## 9. Expansion paths
Potential later expansion: Amazon categories → other marketplaces; static images → video/A+ assets; one-off packs → monitoring; direct sellers → agencies/aggregators. None is authorized by this map. Expansion requires evidence and architecture amendment where boundaries/data/authority materially change.

## 10. Critical unknowns
- Can prospect qualification produce enough sellers with both visible need and reachable business channels?
- Which offer converts best: $49 diagnostic, $499 pack, or $999 package?
- Can Kinetiq deliver at target quality/time with positive gross margin after revisions?
- Does a zero-phone-call constraint materially reduce conversion or can asynchronous proof assets compensate?
- Is $149/month monitoring valued enough to justify recurring infrastructure?

These are C0 questions, not technical assumptions to declare solved.

## 11. A0 decision
**PASS.**

The system is sufficiently mapped to proceed without treating opportunity discovery as the entire business. G0/G1/G2/G3 evidence may be reused where still compatible, but all later progression must respect the explicit conversion → paid-delivery → outcome loop above.