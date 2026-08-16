# WF-DS-S2M-004-G5-001 node map

| Order | Node | Input | Output | Credentials | Failure route |
| --- | --- | --- | --- | --- | --- |
| 1 | Manual Trigger Only | Human-approved invocation | One shadow execution | None | Stop |
| 2 | Load Bounded Real Evidence | Checked-in, provenance-bound public evidence | Two-SKU packet | None | Execution error |
| 3 | Enforce Shadow Authority | Evidence packet | Guard decision and source count | None | Rejected branch |
| 4 | Shadow Lock Passed? | Guard decision | True/false route | None | False → dead letter |
| 5 | Evaluate Real Candidates | Two real candidates | One safe readiness result per candidate | None | Incomplete result |
| 6 | Build Shadow Telemetry | Candidate results | Audit envelope | None | Execution error |
| 7 | Build Shadow Dead Letter | Rejected packet | Human-review record | None | Terminal |
| 8 | Internal Shadow Results | Telemetry/dead letter | Visible internal output | None | Terminal |

## Workflow contract

- **Name/version:** `WF-DS-S2M-004-G5-001` / `1.0.0`
- **Business outcome:** Process the approved H-596B and H-157WB public evidence packet and prove that missing landed-cost inputs stop purchase readiness.
- **Trigger:** Manual owner-approved shadow invocation only.
- **Input:** Two exact Uline candidates, direct Uline product evidence, direct eBay comparable evidence, and the official eBay fee policy.
- **Output:** Per-candidate `Incomplete` readiness results, missing-input lists, telemetry, and owner review routing.
- **Idempotency:** `DS-S2M-004:H2:<normalized-evidence-hash>` in the controlled runtime; the n8n replay uses trace `TRACE-DS-S2M-004-G5-20260815`.
- **Owner:** Aberdeen / DataScout owner.
- **Authority:** Observe and Recommend only.
- **Side effects:** None. No public retrieval occurs inside n8n; the workflow only processes the checked-in evidence packet.
- **Failure policy:** Reject authority violations; route missing economics to human review; never retry or infer missing costs.
- **Observability:** Run ID, workflow ID, trace ID, candidate ID, status, missing inputs, external-action count, cost, and finished time.
- **Cost controls:** Two candidates, seven public evidence URLs, zero credentials, zero AI calls, zero spending, and zero external actions.
- **Data policy:** Public product and marketplace facts only; no customer, seller-account, credential, cart, or purchase data.
