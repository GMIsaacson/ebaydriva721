# Run 012 — Growth & Client Acquisition Team

Run 012 builds a governed multi-channel demand and client-acquisition component for Aberdeen. Its purpose is to turn public market signals, real proof assets, and inbound/outbound opportunities across X, LinkedIn, Upwork/Contra, Reddit and YouTube into qualified commercial opportunities while keeping consequential external actions owner-approved.

## Architecture correction

`A0-COMM-001 v1.0 — Revenue → Customer → Delivery → Retention System Map` supersedes the earlier implied end-to-end Run 012 scope.

Run 012 is **Demand & Acquisition only**. It does not own final commercial scope, payment verification, onboarding, production, QA, client delivery, support, refunds, retention or customer-success obligations.

The required downstream endpoint is the typed `qualified_opportunity_v1` handoff into the reusable Commercial Conversion capability.

Prior G3/G4-artifact evidence is preserved, but G4 promotion is blocked until the B0 amendment and affected G2/G3 revalidation are complete.

## Contract

- Run ID: GROWTH-ACQ-012
- Current gate: B0 architecture reconciliation
- Primary KPI: revenue attributable to acquisition, measured from verified downstream feedback
- Direct operating KPIs: qualified opportunities, pipeline value, reply rate, handoff acceptance rate, CAC, profile visits and channel ROI
- Vanity metrics: followers and impressions are diagnostic only
- Channels: X, LinkedIn, Upwork, Contra, Reddit, YouTube
- Authority: Observe, Analyze, Score, Recommend and Draft
- External first-touch posts/messages/proposals: approval-gated
- Final pricing/scope/contract/payment/delivery authority: out of scope
- Paid ads and spending authority: $0
- Phone/SMS acquisition: prohibited
- Schedules/webhooks: disabled until later gate approval
- Secrets in fixtures/logs/output: prohibited

## Team

1. Growth Lead / Orchestrator — owns acquisition priorities, handoffs, conflicts and briefing.
2. Market Intelligence Agent — finds niches, buyer pain, competitors, offers and high-value conversations.
3. Content Strategy Agent — converts verified proof into channel-specific content plans.
4. X Growth Agent — finds reply targets, drafts posts/replies and analyzes X performance.
5. LinkedIn Acquisition Agent — identifies decision-makers, content/comment opportunities and Service Page demand.
6. Marketplace Agent — monitors Upwork/Contra opportunities, scores jobs and drafts first-touch marketplace responses/proposals.
7. Reddit Opportunity Agent — finds relevant pain-point threads and drafts useful, non-spam responses.
8. Proof / Case-Study Agent — converts verified downstream outcome packets with applicable permission into proof assets and content seeds.
9. Lead Qualification Agent — scores commercial intent, fit, urgency, accessibility and expected deal value.
10. Follow-up / CRM Agent — maintains acquisition-stage lead state, next action and pre-conversion follow-up queue.
11. Growth Analyst — attributes downstream revenue feedback to acquisition channels and recommends scale/kill decisions.

## Canonical flow

Research -> Content/Prospecting -> Engagement Opportunity -> Lead Detection -> Qualification -> Draft First-Touch Action -> Owner Approval -> External First Touch -> Reply/Pre-Conversion Qualification -> `qualified_opportunity_v1` -> Commercial Conversion

Downstream verified feedback returns separately:

Commercial Conversion / Fulfillment / Customer Success -> verified outcome and revenue feedback -> Growth Analyst / Proof Agent -> Content Strategy

Run 012 never acquires downstream authority from receiving feedback.

## Execution split

- Deterministic software performs schema checks, scoring arithmetic, routing thresholds, idempotency, duplicate suppression, authorization checks, action limits and KPI calculations.
- Fixed workflows move typed records between agents and the approval queue.
- Agents perform bounded interpretation: pain analysis, fit assessment, content transformation, first-touch drafting and explanation.
- External first-touch sends, posts, comments, bids/proposals and profile changes require an exact owner-approved permit until a later gate explicitly changes authority.
- Final commercial commitments, payment, delivery and customer-success actions are outside this run.
- n8n may execute only pre-authorized deterministic steps; it does not decide policy or grant itself authority.

## Lead score — 100 points

Agent-assessed dimensions are constrained to 0–5 and software performs the weighted arithmetic:

- Buyer fit: 25
- Pain evidence: 20
- Buying intent: 20
- Expected deal value: 15
- Accessibility: 10
- Urgency: 10

Routes:

- 80–100: HOT_REVIEW
- 60–79: WARM_QUEUE
- 40–59: NURTURE
- 0–39: IGNORE

A high score never grants sending authority. It only changes review priority.

## Initial operating priority

For first revenue, the team's default effort allocation is:

- 35% Upwork/marketplaces
- 30% LinkedIn
- 20% X
- 10% Reddit
- 5% YouTube/proof distribution

This is a starting allocation, not a permanent rule. Growth Analyst may recommend changes only from measured channel economics.

## B0 amendment requirements before G4 reconsideration

1. Version `qualified_opportunity_v1` and its reject/remediation path.
2. Define canonical Lead and Opportunity ownership fields.
3. Prove the downstream Commercial Conversion receiver can accept the handoff without ambiguity.
4. Remove any code/test assumption that Run 012 owns sale, payment, fulfillment or customer success.
5. Re-run affected G2/G3 structural, boundary, duplicate, stale-state and failure tests.
6. Keep all external actions fail-closed throughout revalidation.

## Not authorized

Autonomous publishing, autonomous replies/comments, DMs, email outreach, Upwork/Contra first-touch submission without approval, paid ads, profile changes, customer promises, final pricing/scope, discounts, contracts, payment verification/actions, onboarding, production, QA, client delivery, refunds, customer-success actions, phone/SMS outreach and recurring activation.
