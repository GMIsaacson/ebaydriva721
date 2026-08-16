# WF-DS-S2M-004-G4-001 node map

| Order | Node | Input | Output | Credentials | Failure route |
| --- | --- | --- | --- | --- | --- |
| 1 | Manual Trigger Only | Human click | One execution | None | Stop |
| 2 | Load Synthetic Fixture | Manual event | Bounded fixture | None | Execution error |
| 3 | Enforce Authority Lock | Fixture | `allowed`, violations | None | Rejected branch |
| 4 | Authority Lock Passed? | Guard result | True/false route | None | False → dead letter |
| 5 | Calculate Deterministic Economics | Allowed fixture | Integer-cent economics | None | Incomplete result |
| 6 | Build Offline Telemetry | Internal result | Audit envelope | None | Execution error |
| 7 | Build Dead Letter | Rejected fixture | Human-review record | None | Terminal |
| 8 | Internal Result Only | Telemetry/dead letter | Visible manual output | None | Terminal |

## Contract

- **Name/version:** `WF-DS-S2M-004-G4-001` / `1.0.0`
- **Outcome:** Reproduce one bounded, synthetic Run 004 control path with visible evidence.
- **Trigger:** Manual only. No webhook or schedule exists.
- **Idempotency:** `DS-S2M-004:H1..H4:<normalized-input-hash>`.
- **Authority:** Observe. The workflow cannot call external systems.
- **Side effects:** None. The workflow returns data to the manual execution view only.
- **Credentials:** None.
- **Retries:** Runtime contract allows two transient retries; this acceptance workflow has no external tool to retry.
- **Cost controls:** $0 spending, zero AI calls, 25 candidates, 200 source requests.
- **Data policy:** Synthetic fixtures only; no customer, seller, supplier, or credential data.

## Import and safety

1. Import `run-004-g4-offline.workflow.json` into a non-production n8n workspace.
2. Confirm it imports as **inactive**.
3. Do not add credentials, webhooks, schedules, HTTP nodes, email nodes, marketplace nodes, or database nodes.
4. Run manually and inspect `Internal Result Only`.
5. Export the executed workflow and compare it with the repository copy before recording acceptance evidence.
