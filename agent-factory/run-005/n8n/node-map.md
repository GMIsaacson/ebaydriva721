# Run 005 n8n node map

| Order | Node | Purpose | Side effect |
| --- | --- | --- | --- |
| 1 | Manual Trigger Only | Prevent schedule and webhook activation | None |
| 2 | Load Approved Fixed Packet | Load the immutable owner-approved self-email envelope | None |
| 3 | Enforce Live Pilot Authority | Validate run, approval, recipient, content, cost and retry limits | None |
| 4 | Approval Lock Passed? | Route accepted versus review | None |
| 5 | Build Gmail Executor Handoff | Emit one typed handoff for the separately approved Gmail executor | None |
| 6 | Build Review Record | Emit a terminal review packet on any violation | None |
| 7 | Internal Pilot Result | Preserve CI/import evidence | None |

The source workflow deliberately contains no Gmail credential or send node. CI proves orchestration and policy behavior without sending. The live Gmail connector is invoked once only after the preflight artifact is accepted.

