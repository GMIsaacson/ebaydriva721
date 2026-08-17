# Run 001 — Kinetiq Seller Conversion Lab — B0 Run Boundary Contract v1.0

**Contract ID:** B0-KIN-SCL-001
**Version:** 1.0
**Architecture:** A0-KIN-SCL-001 v1.0
**Run ID:** KIN-FACTORY-001
**Owner:** Aberdeen Technologies
**Status:** PASS

## Component mission
Convert verified weak-listing opportunities into governed paid-project handoffs and coordinate evidence-backed Kinetiq delivery without phone calls or autonomous external authority.

## Inputs
| Input | Upstream owner/system | Minimum contract | Failure if absent |
|---|---|---|---|
| Listing opportunity | Portfolio Steward / Research | marketplace, product/listing ID, evidence date, weakness thesis, confidence | REJECT/REVIEW |
| Seller/brand identity | Research | evidenced company/brand identity and confidence | HOLD |
| Public business inquiry channel | Pipeline | company-level public channel, source, verified date | NO OUTREACH ELIGIBILITY |
| Approved fixed offer | Owner/VP | offer ID, price, scope, expiry/version | BLOCK |
| Client acceptance/payment state | Human/payment evidence | verified acceptance, payment state, client identity | NO DELIVERY HANDOFF |
| Client readiness/intake | Delivery | scope/product/version/marketplace inputs complete | HOLD PROJECT |

## Outputs
| Output | Downstream consumer | Contract | Trigger |
|---|---|---|---|
| Qualified prospect packet | Pipeline / owner approval | Prospect Package v1 | qualification pass |
| Exact outreach approval packet | Human owner | Outreach Packet v1 | public channel verified |
| Paid-client handoff | Client Delivery | Client Readiness Contract v1 + payment evidence | acceptance/payment verified |
| Evidence package | Offer & Asset Builder | Evidence Package v1 | project intake locked |
| QA decision | Owner / Delivery | QA PASS/FAIL/ESCALATE tied to version | review complete |
| Delivery/closeout package | Outcome review | Delivery Package v1 | owner-approved delivery complete |

## In scope
- marketplace listing weakness detection and evidence;
- seller/brand identity verification using approved public sources;
- prospect scoring/deduplication;
- public company inquiry-channel verification;
- outreach/reply/offer drafting;
- fixed-offer usage without exceptions;
- paid-client handoff preparation;
- research, asset-build coordination, QA and version control;
- delivery/revision/closeout records;
- revenue/time/cost/client-signal capture;
- zero-phone-call operating path.

## Explicitly out of scope
- autonomous external sending;
- phone sales/calls;
- pricing changes, discounts, guarantees or scope exceptions;
- invoice sending, charging, refunds or money movement without approval;
- autonomous recurring monitoring;
- expansion to new marketplaces/service categories without architecture review;
- new canonical database unless validation-scale Notion becomes insufficient;
- replacing Kinetiq's existing company operating model with a parallel team structure.

## Canonical records/stores
During validation, Notion remains canonical for pipeline/project/approval/outcome state. GitHub stores technical/governance contracts and test evidence. Asset storage may use existing approved media/file systems but must preserve project/version identity.

## Authority ceiling
- Observe/research: allowed.
- Internal create/update/draft: allowed within registered records.
- External send: owner approval required for every send in v1.
- Client delivery: owner approval required for exact version/recipient.
- Money movement: owner only / separately authorized payment system.
- Scheduling/new integrations/permissions: separately gated.

## Completion condition
Run 001 is COMPONENT READY only when:
- G4 inactive/non-production pipeline exists with telemetry and stop/restart controls;
- G5 shadow processing proves real listing → prospect → internal approval packet → simulated paid handoff → build/QA/delivery package without external action;
- no identity, duplicate, version, scope, pricing or authority defects escape controls;
- D0 proves every material output has a governed downstream destination and remediation path.

It is not BUSINESS READY until C0 produces real market/payment evidence, and not PRODUCTION READY until P0 passes.

## Scope-change rule
Any material change to marketplace, offer model, autonomous authority, canonical data ownership, customer delivery behavior, or recurring-monitoring responsibility requires an Architecture Amendment and new B0 version.

## B0 decision
**PASS.** Existing G0–G3 work may be reused under this boundary; current work should resume at G4 rather than redesigning the team.