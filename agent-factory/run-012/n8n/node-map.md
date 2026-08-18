# Run 012 G4 n8n Node Map

Workflow: `WF-GROWTH-ACQ-012-G4-001`

1. **Manual Trigger Only** — no schedule or webhook.
2. **Load Synthetic Growth Signals** — loads controlled X/LinkedIn/Upwork test packets; no credentials.
3. **Enforce G4 Zero Authority** — rejects identity drift, schedules/webhooks, requested external actions, spend/AI/CRM authority expansion and obvious secrets/payment data.
4. **Score Route and Deduplicate** — performs deterministic 100-point scoring, channel allowlist enforcement, duplicate suppression and routing.
5. **Build Team Performance List** — emits one zero-cost performance row for each of the 11 growth-team agents.
6. **Internal Growth Review Queue** — terminal no-op node. Nothing is published or transmitted.

## G4 boundary

- Workflow `active=false`.
- Manual execution only.
- No Gmail, HTTP Request, social-network, messaging, payment, webhook or scheduling nodes.
- `maxExternalActions=0`.
- `maxCrmWrites=0`.
- `spendingAuthorityCents=0`.
- `maxAiCalls=0`.
- Every suggested external action is labeled `BLOCKED_PENDING_OWNER_APPROVAL`.

## Deployment acceptance still required

Repository validation does not equal deployed G4 acceptance. Before promoting the run to G4, import this workflow into the isolated non-production n8n environment, confirm it remains inactive/manual-only, execute the synthetic packet once, export the workflow again, and compare the exported authority boundary with this source artifact.
