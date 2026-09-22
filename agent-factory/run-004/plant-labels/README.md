# Plant Labels bounded controller — implementation candidate

**Live acceptance status (2026-09-22): COMPLETED / ZERO QUALIFYING OPPORTUNITIES.** The bounded Plant Labels run `SM-AMZ-PLANT-LABELS-001` executed through ASIN discovery, demand validation, sourcing, landed cost, economics, and independent Q2 evidence review in governed Work Control. The run retained five candidates and ended with all five blocked on evidence; none became SAMPLE_READY or publishable. No supplier contact, purchase, listing, publication, spend, or customer-facing mutation occurred.

Scope: Amazon US Plant Labels `14623206011`; run `SM-AMZ-PLANT-LABELS-001`; existing Run 004 and Work Control. Existing Factory owns execution, existing Supabase research tables own the research projection. No separate service, scheduler, database or worker fleet.

## Sequence and contract

Each invocation of `scripts/tick-plant-labels.cjs` performs one durable step and exits. Invoke it from the existing Factory runtime; it does not run an independent polling loop.

| Stage | Existing route | Required output |
| --- | --- | --- |
| ASIN_DISCOVERY | AGT-RESEARCH-VALIDATION-001 | Actual discovery receipts, coverage statement, up to 25 ASINs |
| DEMAND_VALIDATION | AGT-RESEARCH-VALIDATION-001 | Dated demand and seller evidence, retained rejected/blocked ASINs |
| SOURCING | SPC-SOURCE-001 | Supplier identity, exact product, pack/material/variant match, sourcing route |
| LANDED_COST | SPC-FREIGHT-001 | Evidence-bearing component costs or explicit missing-input blockers |
| ECONOMICS | SPC-ECON-001 | Complete integer-cent inputs; existing Run 004 arithmetic recomputes result |
| EVIDENCE_QA | SPC-EVID-001 | Separate command; every candidate ends rejected, blocked or research_candidate |

Strict JSON result shape is in the controller's `resultContract`. Evidence requires HTTPS URL, observation date, specific claim and retrieval receipt. A receipt pointer is provenance, not proof that an independent review passed. Deployment acceptance must verify actual specialist routing and independent reviewer identity. The current generic worker's prose delivery is deliberately rejected.

The economics engine's input buckets must include all applicable Amazon costs, including referral/FBA/storage/inbound, ads, returns, duties and prep, with provenance. Bucket arithmetic does not establish completeness or professional verification; Q2 and applicable Q3 remain required. Discovery volume is bounded, so finishing this run does not establish exhaustive leaf coverage.

## Persistence and failure behavior

- The checkpoint RPC uses an advisory transaction lock and expected-version compare-and-set. Concurrent ticks cannot both reserve a dispatch.
- Before dispatch, record an intent. A lost dispatch response or process crash blocks for reconciliation by the stable correlation marker. The existing API has no verified server-side idempotency contract, so POST is never retried.
- Only transient GET failures retry, at most twice. Authentication errors stop immediately. Each worker has a 30-minute wait limit.
- Existing research state triggers record transitions; explicit events record same-state ticks. The current Research Console already reads these events and `state_details`.
- Run output remains a proposed research packet under `state_details.run004_controller`; this adapter does **not** populate normalized observation, supplier or economics tables. Promotion into those domain records requires a separately verified materialization adapter.
- `RESEARCH_FINISHED`, rejection and block outcomes map to HOLD pending review, never SAMPLE_READY, COMPLETE or publication. Existing completion guard remains mandatory for DONE.
- No automatic resume: reconcile the stored command, repair the checkpoint with its expected version under owner control, then re-run. Pause/cancel prevents subsequent controller dispatch; it does not cancel a previously accepted Work Control job.

## Binding and deployment requirements

1. Restore the authenticated Work Control gateway and confirm the deployed Run 004 team identifier. The UI branch currently references `/gateway/v1/commands`; its `/gateway/health` returned NOT_FOUND during this session. No server credentials are available in this workspace.
2. Bind an existing approved public-research mechanism to the worker. The generic reasoning worker has no verified browser/search connector. That mechanism must enforce at most 25 candidates and 200 source requests **across the run**, record retrieval receipts, stop on access barriers, and enforce its own timeouts. The controller validates returned count limits; it cannot count hidden worker requests.
3. Verify the live worker delivers the strict JSON receipt contract and routes the named specialist, including independent Q2. Supply deployment evidence references as `executionReceipt`, `publicResearchReceipt`, `writebackReceipt`, and `run004TeamId` in a server-owned bindings file. Nonempty references are configuration checks, not cryptographic attestations.
4. Apply `install-checkpoint.sql` through the existing project migration/deployment process only after review. SECURITY INVOKER, execute revoked from PUBLIC/anon/authenticated, service_role only. Do not place service keys in browser code.
5. Set server secret variables `WORK_CONTROL_GATEWAY`, `WORK_CONTROL_ID_TOKEN`, `SOURCEMARGIN_URL`, `SOURCEMARGIN_SERVICE_KEY`, `PLANT_LABELS_BINDINGS_FILE`. The host must refresh the Firebase token using its established authenticated mechanism. No tokens are committed.
6. Run one manual tick, confirm one Work Control command and one stored checkpoint, then repeat to prove no duplicate command. Do not activate a schedule before this live acceptance succeeds.
7. Add the tick to the existing Factory n8n execution path using its approved Node runtime mechanism. Precise node sequence: Manual Trigger → read/validate deployment bindings → invoke one controller tick → expose phase/commandId/latest event in existing telemetry → stop. The current deployment's invocation mechanism is not available here, so no fabricated HTTP endpoint or import-ready n8n workflow is supplied.
8. Only after live acceptance may the existing cadence invoke further ticks. Six commands reserve at most 12 model-budget cents; external commercial spend remains prohibited. Actual provider usage must be checked against Work Control receipts.

## Validation and rollback

Run `node --test agent-factory/run-004/tests/amazon-leaf-controller.test.cjs` and `npm run test:g4`.

The SQL function was tested in a transaction on the existing Supabase project, including anonymous/authenticated denial, service_role permission, a real insert/update and duplicate-version rejection, followed by ROLLBACK. The function and test work item were confirmed absent afterward. These tests are not production acceptance.

Rollback: stop the existing invocation first; preserve command IDs, checkpoints and events; remove the added invocation and revoke service_role EXECUTE on the new function. Do not delete research history or revert unrelated factory changes. A stopped controller does not automatically cancel an in-flight worker.

Remaining live acceptance: authenticated execution access, public retrieval binding, strict result/routing proof, normalized research materialization, independent Q2/Q3 and completion receipts. No end-to-end success is claimed.


## 2026-09-22 live acceptance record

Run: `SM-AMZ-PLANT-LABELS-001` — Amazon US Plant Labels `14623206011`.

| Stage | Governed command | Outcome |
| --- | --- | --- |
| ASIN_DISCOVERY | `WC-20260922070924-4aeaa779f6` | PASS — 3/5 exact Amazon pages verified; 2 blocked |
| DEMAND_VALIDATION | `WC-20260922071250-81456a8c7c` | PASS — 3 candidates retained for sourcing |
| SOURCING | `WC-20260922071351-86c075740f` | PASS — 2 exact source-equivalent offers; 1 additional candidate blocked |
| LANDED_COST | `WC-20260922072101-e7d8047ad2` | BLOCKED — inbound shipping/freight unresolved for both surviving sourced offers |
| ECONOMICS | `WC-20260922072138-ef6390ace6` | BLOCKED — no complete evidence-backed economics packet |
| EVIDENCE_QA | `WC-20260922072217-dab511df2a` | BLOCKED — independent Q2 confirmed all five final blocked dispositions |

Final funnel: 5 discovered → 3 demand-validated → 2 source-equivalent → 0 landed-cost complete → 0 economics-complete → 0 research candidates / SAMPLE_READY / publishable.

Acceptance defects found during the run:
- LANDED_COST initially treated ECONOMICS-owned buckets as a terminal freight blocker. The worker contract now enforces stage ownership deterministically; fix commit `56bdbfb029c15c6242f378838cb114973c222e53`.
- A generic Run 004 final-reconciliation command does not hydrate prior governed receipts automatically. The dedicated Amazon leaf stage executor does hydrate explicit `priorCommandIds`; future generic reconciliation should reuse that receipt-loading mechanism rather than duplicate research context.

This run demonstrates evidence-preserving stage progression, terminal-disposition retention, specialist binding, independent Q2 separation, and fail-closed behavior. It does not establish exhaustive leaf coverage or customer publication readiness.
