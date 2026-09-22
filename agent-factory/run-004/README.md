# Run 004 — DataScout Source-to-Marketplace G4–G5 package

This directory is the controlled, non-external deployment package for Factory Run `DS-S2M-004`.

It rehabilitates the existing React/Vite/Firebase DataScout repository. It does not replace the application, migrate legacy product data, or authorize live agent work.

## Gate position

- G0 Opportunity: passed
- G1 Classification: passed
- G2 Design: passed
- G3 Simulation: passed, 21/21 offline contract cases
- G4 Deployment: passed on final PR-head acceptance; package, Firestore Emulator, and inactive n8n evidence retained
- G5 Shadow: owner-authorized bounded two-SKU run packaged; fresh public evidence is processed without external action
- G6: **bounded internal acquisition-state monitor authorized 2026-09-20**; general external/live sourcing authority remains blocked\n- G7: blocked pending separate owner decision

## Authority lock

The package is limited to `Observe`, `Recommend`, and owner-approved internal `Draft` behavior.

It has:

- no Uline connector;
- no eBay connector;
- no HTTP request node;
- no webhook or schedule;
- no production Firestore credential;
- no email, messaging, payment, purchase, bidding, or publishing capability;
- no AI/model calls during G4 acceptance;
- zero spending authority.

Any attempt to enable external actions, spending, more than 25 candidates, more than 200 source requests, more than two retries, stale evidence, missing economics, uncertain identity, or a Builder branch without approval stops or routes to review.

## Package topology

| Layer | Artifact | Responsibility |
| --- | --- | --- |
| Contracts | `contracts/*.json` | Typed handoffs, control state, telemetry, stable registry IDs |
| Deterministic software | `runtime/economics.cjs` | Integer-cent profit, margin, ROI, break-even, version and input hash |
| Policy | `runtime/config.cjs`, `handoff.cjs`, `policy.cjs` | Hard caps, authority, freshness, evidence and approval checks |
| Runtime | `runtime/runtime.cjs`, `store.cjs` | Idempotency, attempts, reviews, retries, dead letters, kill/stop/restart/checkpoint |
| Orchestration | `n8n/*.json` | Inactive, manual, credential-free synthetic acceptance flow |
| Data plane | `firestore/*` | Isolated emulator-only layout and default-deny rules |
| Evaluation | `tests/*.test.cjs`, `scripts/validate-package.cjs` | Executable deployment acceptance evidence |

## Deterministic economics

All money inputs are integer cents. Formula version `datascout-landed-economics/1.0.0` computes:

```text
total cost = source cost + inbound freight + marketplace fees
           + outbound shipping + packaging + risk reserve
net profit = collected revenue - total cost
margin     = net profit / collected revenue
ROI        = net profit / total cost
break-even collected revenue = total cost
```

Missing, fractional, or negative cost inputs return `Incomplete`; the module never guesses. A negative profit remains negative.

## Local acceptance

Use the repository's npm lockfile:

```bash
npm ci
npm run test:g4
npm run validate:g4
npm run build
```

The acceptance result is valid only when all commands pass without adding credentials or changing the authority lock.

## Control runbook

### Start

1. Load the default offline configuration.
2. Initialize control state for `DS-S2M-004`.
3. Confirm `externalActionsEnabled=false`, `spendingAuthorityCents=0`, `maxAiCalls=0`.
4. Start the runtime manually.

### Stop

`runtime.stop(reason)` prevents new processing and preserves the latest checkpoint.

### Restart

`runtime.restart()` is allowed only from `stopped` or `failed`, preserves the checkpoint, and increments `restartCount`.

### Kill/cancel

`runtime.cancel(reason)` sets the kill switch, moves the run to `cancelled`, prevents downstream work, and prohibits restart.

### Failure and review

- Transient failures retry twice after the initial attempt, then enter dead-letter and human review.
- Authentication, permission, policy, and approval failures do not retry.
- Missing or uncertain evidence returns `Incomplete`.
- Evidence older than seven days or conflicting evidence returns `Review`.
- Duplicate idempotency keys return the first terminal result and do not repeat work.

## n8n acceptance

Import `n8n/run-004-g4-offline.workflow.json` into a non-production workspace and keep it inactive. It must contain only Manual Trigger, Code, IF, and No Operation nodes and no credentials. Run the synthetic fixture manually and retain the exported execution evidence.

The reproducible non-production acceptance job uses the official `n8nio/n8n:2.34.6` container, an ephemeral local database, and the stable workflow ID `RUN004G4OFFLINE`. It creates only a synthetic local owner, imports the workflow with `activeState=false`, executes it through the n8n CLI, validates the terminal result, and destroys the environment after evidence capture.

## Firestore emulator acceptance

The rules under `firestore/` are intentionally isolated and default-deny. They must be tested only with a disposable emulator project.

Do **not** deploy `firestore.g4.emulator.rules` to the current `salescope-7f11d` project: it denies legacy collections by design. Production rule integration requires a separate reviewed change after emulator evidence passes.

`tests/firestore-rules.test.cjs` covers authenticated operator allow cases plus unauthenticated, wrong-role, wrong-run, prohibited-bucket, authority-expansion, delete, and legacy-collection deny cases. The CI job runs these tests only against the disposable `demo-datascout-run004` project.

## G5 bounded shadow

The owner authorized one read-only shadow on 2026-08-15 for `H-596B` and `H-157WB`. The checked-in evidence packet records direct Uline product facts, direct eBay model and sold-count comparables, and the official eBay fee policy. It deliberately excludes cart, account, purchase, listing, messaging, scraping, credential, and production data.

Run locally with:

```bash
npm run test:g5
npm run validate:g5
npm run run:g5
```

The expected business result is `Incomplete`, because a verified Uline inbound-freight quote and actual seller fee, postage, packaging, and risk inputs are not available from read-only public evidence. That safe stop is the correct shadow output; it does not authorize a purchase or G6.

## Historical G4 exit evidence

G4 passed after the package supplied all of the following evidence:

1. Import and manually execute the inactive n8n workflow in a non-production workspace.
2. Run Firestore emulator allow/deny tests with a synthetic `datascoutG4Operator` claim.
3. Demonstrate kill, stop, restart, idempotency, bounded retry, dead letter, and telemetry in the packaged environment.
4. Record exact runtime versions, environment, results, logs, and rollback steps.
5. Complete the G4 Gate Review without changing any authority.

G4 passed on 2026-08-15. G5 may run only within the separately approved two-SKU shadow scope; no external activation may begin without a new G6 owner decision.


## SourceMargin completion guard

Material SourceMargin work orders use the deterministic `SW-DS-COMPLETION-GUARD-001` before Run 004 may enter `completed`.

The guard requires:

1. a durable Supabase operational/audit writeback receipt;
2. a Work Control handoff receipt with execution state persisted;
3. a GitHub durable writeback receipt when the material action changes project state, methodology, or system rules;
4. a SourceMargin State Reconciler receipt with `reconciliationStatus=CONSISTENT`;
5. Q1 and Q2 PASS receipts when the work order declares those reviews required.

If every required receipt is present, the guard emits `DONE` and the controlled runtime may enter `completed`.

If any required receipt is missing, stale/conflicting state prevents reconciliation, or a required Q1/Q2 review has not passed, the guard emits `BLOCKED_WRITEBACK` and Run 004 enters `blocked_writeback`. It may not be restarted to repeat execution; the missing records/reviews must be repaired and the completion guard rerun.

The completion guard is Observe-only. It cannot fabricate evidence, repair state by inference, alter strategy/gates/kill criteria, grant authority, purchase, contact suppliers, publish, or spend.


## G6 acquisition-state dispatcher

Owner approval `CHATGPT-OWNER-APPROVAL-2026-09-20-SM-ACQ-DISPATCH` authorizes one narrow controlled-live extension: `WF-SM-ACQ-DISPATCH-G6-001`.

This is an **internal state monitor**, not an autonomous sourcing actuator.

### Trigger

- Manual execution is allowed.
- A five-minute schedule (`*/5 * * * *`, America/Chicago) is allowed only after the exact checked-in workflow imports inactive, a manual baseline succeeds, and a second manual run proves no-change idempotency.
- Webhooks are prohibited.

### Read boundary

The workflow may call exactly one external endpoint:

`https://aittnuqrrenkencygfje.supabase.co/rest/v1/rpc/control_console_dashboard`

using the public Supabase publishable key. Raw SourceMargin tables remain unavailable to the workflow.

### Write boundary

The workflow may write only transport/observation records to the **existing private Factory PostgreSQL** through the existing `RUN006POSTGRES` credential:

- `sourcemargin.sm_acquisition_dispatch_state`
- `sourcemargin.sm_acquisition_dispatch_events`
- existing CIL run/audit functions.

Those tables are not canonical product state and are not Work Control. They exist only to provide durable idempotency and internal recommendation receipts.

### Routing behavior

Only **active primary acquisition routes** are observed.

A material route fingerprint change may emit one typed recommendation, for example:

- `RFQ_READY` → `RFQ_PACKAGE_REVIEW`
- `WATCH` → `SOURCE_WATCH_MONITOR`
- `PRICE_TRIGGER_READY` → `PRICE_TRIGGER_MONITOR`
- `RESEARCH` → supplier/event-source research according to route type
- `FAILED` / `EXHAUSTED` → `ROUTE_FALLBACK_REVIEW`
- `SAMPLE_READY` / `BUY_READY` → owner-approval work only.

At most **three changed routes** may be emitted per execution. The first live run is baseline-only; unchanged state produces `NO_CHANGE`.

### Authority lock

The dispatcher has `Recommend` authority only.

It may **not**:

- create Work Control commands;
- contact suppliers or send RFQs;
- bid or purchase;
- publish or list;
- mutate `acquisition_routes`, evaluations, strategy, gates, kill criteria, or authority;
- spend money.

Agent 000 remains accountable. Work Control remains the only execution-state owner. Run 008 remains the retry/dead-letter/recovery boundary.

Promotion from recommendation packets to actual Work Control command creation requires a **fresh bounded owner authorization and architecture review**. This G6 approval does not authorize that promotion.


## Freight / landed-cost specialist qualification

`SPC-FREIGHT-001` is now under the governed calibration program `SPC-FREIGHT-001-QUAL-V1`.

The program does **not** promote the specialist merely because a qualification harness exists. Stage C evidence and independent logistics Q3 have now passed, so the canonical registry is `QUALIFIED`. This permits evidence-bounded landed-cost professional certification when the underlying case inputs are complete; it does not grant production mutation, publication, supplier-contact, purchase, customs-legal, or tax authority.

Promotion rules:

- `UNPROVEN -> PROVISIONAL`: at least three passing shadow cases, including one correct incomplete/block case, one quote-backed case and one Incoterm/tariff case; Q2 must pass every case; unsupported estimate rate, deterministic arithmetic error rate and authority-violation rate must all remain zero.
- `PROVISIONAL -> QUALIFIED`: at least five total cases, at least two reconciled against real quote/final-charge evidence, acceptable estimate error where estimation was explicitly requested, and independent qualified logistics/freight Q3 with `PE_PASS`.
- No automatic promotion is allowed.

Stage B calibration set: (1) Thermal Pads incomplete/block case; (2) Car Seat Gap Filler quote-backed freight case; (3) controlled DDP + tariff-classification case.

Work Control command `WC-20260922050446-195dc8e863` attempted the first shadow calibration. The governed worker failed closed before model execution with `OPENAI_HTTP_429` / `credit_balance_exhausted`. It used 0 input tokens, 0 output tokens, $0 model cost, 0 external actions, and made no production mutation.

That initial runtime failure was not counted as a professional case. After runtime recovery, the five-case qualification portfolio passed with independent Q2 on every case, two quote-backed reconciliation cases satisfied Stage C, and the independent freight Q3 returned `PE_PASS`. `SPC-FREIGHT-001` is now `QUALIFIED`.

The qualification harness explicitly rejects fabricated freight values, relabeling modeled landed cost as verified, external authority use, and production certification while material inputs remain unresolved.


### Current freight qualification status — QUALIFIED

- Case 1: Thermal Pads incomplete/block — PASS, Q2 PASS.
- Case 2: Car Seat Gap Filler exact-SKU visible freight quote — PASS, Q2 PASS.
- Case 3: controlled DDP + tariff-classification fixture — PASS, Q2 PASS.
- Stage B result: **PASS**.
- Stage C portfolio: **5/5 PASS; 5/5 Q2 PASS; 2 quote-backed reconciliations**.
- Independent portfolio Q3: **PE_PASS** (`WC-20260922054728-ece811e159`; normalized outcome `WC-20260922054804-5ffb8e4d3c`).
- Final independent qualification Q2: **PASS / promotion evidence COMPLETE** (`WC-20260922054825-9aa06a8ff5`).
- Specialist state: **QUALIFIED**.
- Evidence-complete landed-cost professional certification: **ALLOWED**.
- Production mutation, publication, supplier contact, purchase/spend, customs legal opinion, tax advice, and self-review: **DENIED / separately governed**.


### Stage C freight cases and independent Q3 reviewer

`SPC-FREIGHT-001` now has five passing calibration cases with independent Q2 PASS on every case. Two cases count as quote-backed reconciliation evidence: the exact-SKU Car Seat Gap Filler visible freight quote and the public Sellerhook supplier-check quote report.

Case 5 independently verified UPS dimensional-weight handling and EXW scope without inventing freight dollars.

The required independent reviewer gap is now filled by reviewer-only specialist `SPC-FREIGHT-Q3-001`. Its reviewer qualification used three preregistered gold cases: cautious incomplete evidence → `PE_PASS_WITH_LIMITATION`; adversarial DDP/duty/fabricated-freight case → `PE_FAIL`; bounded quote normalization → `PE_PASS_WITH_LIMITATION`. Aggregate Q2 returned `QUALIFICATION_Q2_PASS`.

The reviewer then performed the separate five-case portfolio Q3. The initial review returned an unambiguous PASS/Stage C qualified judgment; a controlled normalization emitted the required exact token `PE_PASS`, and a separate Q2 audit accepted that outcome with promotion evidence `COMPLETE`. The authoring specialist is now `QUALIFIED`. `SPC-FREIGHT-Q3-001` remains reviewer-only and may not author freight work, self-review, mutate production, contact suppliers, purchase, provide customs legal opinions, or provide tax advice.


### Qualification boundary after PE_PASS

`SPC-FREIGHT-001` may now issue an internal landed-cost professional certification only when the case-specific material evidence is complete. Qualification is a capability property, not a shortcut around evidence gates.

The qualification does **not** authorize SourceMargin resolver claim/write-back, customer publication, supplier outreach, purchases, spending, customs legal opinions, tax advice, or self-review. Those remain under separate A0/authority controls. Run 004 as a whole remains professionally BLOCKED where another material discipline—such as marketplace policy/IP or category-specific product judgment—has not been qualified or bound.


## Marketplace Policy/IP qualification and candidate-level PCM

`SPC-IP-001` is now **QUALIFIED** under `SPC-IP-001-QUAL-V1`.

Qualification evidence:
- five author calibration cases across eBay and Amazon;
- five of five corrected independent Q2 case audits PASS;
- reviewer-only `SPC-IP-Q3-001` qualified on three preregistered gold cases;
- final independent portfolio Q3 normalized to `PE_PASS`;
- final independent qualification Q2 = PASS / promotion evidence COMPLETE.

The capability is intentionally bounded. It may certify a SourceMargin candidate's **marketplace-policy/IP risk screen** against current platform evidence and candidate facts. It does not provide legal IP advice, technical compatibility certification, rights-owner guarantees, marketplace account actions, listing/publication authority, supplier contact, purchase/spend, or production mutation.

### Candidate-level professional routing

`runtime/source-margin-professional-router.cjs` builds a Professional Capability Manifest for each candidate.

Rules:
- **Marketplace Policy/IP is always required** before customer/publication readiness.
- **Freight/import** is required when cross-border import or landed-cost professional certification is material.
- **Product/Category Specification is conditional**, not a permanent global role.
- Category expertise is required for compatibility/fitment, vehicle fitment, electrical/electronic function, safety-critical or regulated products, medical/health claims, material or chemical performance, structural/load-bearing claims, branded-equivalence, patent/design risk, installation/modification, and similar technically material claims.
- A candidate may omit category-specialist review only when it is explicitly characterized as a generic commodity with simple specifications and none of the material-risk flags is present.
- Unknown category complexity **fails closed**: absence of risk data is not treated as proof of low risk.
- When category expertise is required, both a job-specific QUALIFIED specialist and independent QUALIFIED reviewer must be bound. There is no universal product expert.

This changes Run 004 from a permanent global professional blocker into a **candidate-gated professional system**: a missing category specialist blocks the affected candidate, not every SourceMargin candidate.
