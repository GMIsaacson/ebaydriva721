# Work Control v1 — Live Team Acceptance Sweep — 2026-08-22

## Scope

Live bounded acceptance test of every record currently marked `runnable=true` in the Work Control canonical read model. Tests were submitted through the real persistent Work Control API and executed by the governed worker on Factory1.

## Result summary

- Runnable records tested: **11 / 11**
- Terminal receipts returned: **11 / 11 DELIVERED**
- External actions performed: **0**
- External spend: **$0**
- Production mutations: **0**
- Estimated model-compute cost for the complete sweep: **3.56 cents**
- Negative controls: **PASS**
  - Run 005 → `TEAM_NOT_RUNNABLE`
  - Run 008 → `TEAM_NOT_RUNNABLE`
  - Run 013 → `TEAM_NOT_FOUND` (reserved/absent)

## Per-team live results

| Run | Team | Command | Terminal | Est. model cost | Acceptance observation |
|---|---|---|---|---:|---|
| 001 | Kinetiq Studio | `WC-20260823040454-ce7c6dae5c` | DELIVERED | 0.25¢ | Produced functional smoke, UX/compatibility, and preview-readiness gates for a revived web app. |
| 002 | Central Kenya Pig Farm | `WC-20260823040454-7a6fdddbb5` | DELIVERED | 0.33¢ | Produced animal, housing, feed/water, biosecurity, waste, records, and escalation inspection sequence. |
| 003 | Bulk & Catch-Up Invoicing SaaS | `WC-20260823040454-5ae97187f3` | DELIVERED | 0.26¢ | Correctly emphasized historical scope, idempotency/duplicate prevention, financial correctness, failure safety, and auditability. |
| 004 | DataScout Source-to-Marketplace | `WC-20260823040454-b267811d11` | DELIVERED | 0.39¢ | Included supplier validation, compliance, listing readiness, fulfillment, landed profitability, demand, risk, and decision gates. |
| 006 | Subscription Operations | `WC-20260823040554-3ffa22b9b7` | DELIVERED | 0.22¢ | Correctly triaged known subscriptions, flagged an unknown charge, totaled apparent recurring spend, and identified missing evidence without accessing Gmail. |
| 007 | Systems Intelligence & Development | `WC-20260823040554-fa75f8b2a6` | DELIVERED | 0.21¢ | Identified queue integrity, malformed/stale execution, and false receipt trust as primary architecture failure modes. |
| 009 | Municipal Development Intelligence | `WC-20260823040554-b0a7278b5f` | DELIVERED | 0.34¢ | Produced a provenance/status/confidence evidence schema and distinguished rumor from decision-grade signals. |
| 010 | Vendor Invoice Overcharge Recovery | `WC-20260823040554-057b8f78c4` | DELIVERED | 0.20¢ | Correctly calculated $200 unit-price variance + $75 improper freight = **$275 disputed amount** and listed evidence needed before recovery. |
| 011 | Opportunity Intelligence | `WC-20260823040653-6f4837c0c9` | DELIVERED | 0.24¢ | Ranked three hypothetical opportunities, exposed primary assumptions, and supplied falsifiable kill criteria. |
| 012 | Growth & Client Acquisition | `WC-20260823040653-f695f0d1f4` | DELIVERED | 0.79¢ | Produced a measurable three-channel 20-prospect acquisition experiment with funnel KPIs and decision rules; no outreach occurred. |
| 014 | Software Product Engineering | `WC-20260823040653-42e010d62e` | DELIVERED | 0.33¢ | Produced explicit Online/Stale/Offline heartbeat acceptance criteria and precise boundary test cases. |

All eleven receipts reported `externalActionsPerformed=0`, `spendCents=0`, and `productionMutation=false`.

## Structural finding — team identity is shallow in worker v1

**Execution plumbing: PASS. Governance enforcement: PASS. Team-specific operating fidelity: PARTIAL.**

The current governed worker prompt loads the team **name, run, kind, and assignment**, plus global safety rules. It does **not** load each team's full capability definition, role roster, operating contract, typed workflow stages, gates, evidence requirements, or specialist instructions.

That means the strong domain-specific outputs in this sweep demonstrate useful routing and reasoning, but they do **not yet prove that the original Factory teams are being executed as their designed multi-role operating systems**. In effect, worker v1 is currently a shared governed reasoning worker wearing the selected team's label/context.

This is the highest-priority defect revealed by the acceptance sweep.

## Recommended next gate

Add a **Team Execution Profile** layer keyed by team ID. Each runnable team should inject its canonical operating contract into the worker at claim time, including at minimum:

1. mission and scope;
2. specialist roles / internal stages;
3. required evidence and quality gates;
4. forbidden claims/actions;
5. terminal-state criteria;
6. authority requirements;
7. team-specific output schema or artifacts.

Then repeat this acceptance sweep with deliberately ambiguous assignments to prove that two different teams produce materially different workflows because of their canonical profiles, not merely because their names differ.

No production authority or connector/tool authority was changed during this test.