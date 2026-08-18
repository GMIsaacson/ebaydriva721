# Run 012 — Growth & Client Acquisition Team

Run 012 builds a governed multi-channel growth and client-acquisition team for Aberdeen. Its purpose is to turn public market signals, our real proof assets, and inbound/outbound opportunities across X, LinkedIn, Upwork/Contra, Reddit and YouTube into qualified leads and measurable revenue while keeping consequential external actions owner-approved.

## Contract

- Run ID: GROWTH-ACQ-012
- Current target: G3 simulation package, then G4 non-production deployment
- Primary KPI: revenue attributable to the team
- Secondary KPIs: qualified leads, proposals, reply rate, conversion rate, pipeline value, CAC, profile visits and channel ROI
- Vanity metrics: followers and impressions are diagnostic only
- Channels: X, LinkedIn, Upwork, Contra, Reddit, YouTube
- Trigger during G3/G4: manual only
- Authority: Observe, Analyze, Score, Recommend and Draft
- External posting/messages/proposals: approval-gated
- Paid ads and spending authority: $0
- Phone/SMS acquisition: prohibited
- Schedules/webhooks: disabled until later gate approval
- Secrets in fixtures/logs/output: prohibited

## Team

1. Growth Lead / Orchestrator — owns priorities, handoffs, conflicts and daily/weekly briefing.
2. Market Intelligence Agent — finds niches, buyer pain, competitors, offers and high-value conversations.
3. Content Strategy Agent — converts real builds/results into channel-specific content plans.
4. X Growth Agent — finds reply targets, drafts posts/replies and analyzes X performance.
5. LinkedIn Acquisition Agent — identifies decision-makers, content/comment opportunities and Service Page demand.
6. Marketplace Agent — monitors Upwork/Contra opportunities, scores jobs and drafts proposals.
7. Reddit Opportunity Agent — finds relevant pain-point threads and drafts useful, non-spam responses.
8. Proof / Case-Study Agent — converts completed work into proof assets, demos and YouTube-ready case studies.
9. Lead Qualification Agent — scores commercial intent, fit, urgency, accessibility and expected deal value.
10. Follow-up / CRM Agent — maintains lead state, next action, proposal state and follow-up queue.
11. Growth Analyst — attributes revenue, measures channel economics and recommends scale/kill decisions.

## Canonical flow

Research -> Content/Prospecting -> Engagement Opportunity -> Lead Detection -> Qualification -> Draft Action -> Owner Approval -> External Action -> CRM -> Sale -> Case Study -> More Content

## Execution split

- Deterministic software performs schema checks, scoring arithmetic, routing thresholds, idempotency, duplicate suppression, authorization checks, action limits and KPI calculations.
- Fixed workflows move typed records between agents and the approval queue.
- Agents perform bounded interpretation: pain analysis, fit assessment, content transformation, proposal/reply drafting and explanation.
- External sends, posts, comments, bids, proposals, profile changes and spending require an exact owner-approved permit until a later gate explicitly changes authority.
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

## G3/G4 pass criteria

1. All structural, authority, scoring, deduplication and failure-path tests pass.
2. Every external action remains blocked without a matching, unexpired approval permit.
3. Duplicate opportunities are suppressed deterministically.
4. Unsupported channels and malformed evidence are rejected.
5. Lead scoring is reproducible and arithmetic is not delegated to an LLM.
6. Every queued item retains source, observation time, route, score and idempotency key.
7. Demo produces prioritized opportunities with zero external actions.
8. No paid ads, purchases, publishing, messages, bids, proposals or phone/SMS actions occur during G3/G4.

## Not authorized yet

Autonomous publishing, autonomous replies/comments, DMs, email outreach, Upwork/Contra bids, proposal submission, paid ads, profile changes, customer promises, pricing exceptions, discounts, payment actions, phone/SMS outreach and recurring activation.
