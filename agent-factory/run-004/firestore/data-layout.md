# Run 004 Firestore emulator layout

This layout belongs only to the isolated G4 emulator project. It does not modify the legacy `products`, `activities`, or user collections.

| Path | Purpose | Delete policy |
| --- | --- | --- |
| `g4Runs/DS-S2M-004` | Kill switch, state, mode, caps, checkpoint | Denied |
| `g4Runs/DS-S2M-004/attempts/{attemptId}` | Append-only execution telemetry | Denied |
| `g4Runs/DS-S2M-004/results/{idempotencyHash}` | Idempotent terminal result | Denied |
| `g4Runs/DS-S2M-004/deadLetters/{deadLetterId}` | Exhausted transient failures | Denied |
| `g4Runs/DS-S2M-004/reviews/{reviewId}` | Human-review queue | Denied |
| `g4Runs/DS-S2M-004/checkpoints/{checkpointId}` | Safe stop/restart checkpoint | Denied |
| `g4Evidence/{evidenceId}` | Minimum provenance-bound synthetic evidence | Denied |

Every writable record must contain:

- `run_id: "DS-S2M-004"`
- `external_actions: 0`
- `spending_cents: 0`
- a source/correlation identifier and timestamp appropriate to its collection

The emulator auth token must carry `datascoutG4Operator: true`. No production credential is permitted at G4 acceptance.
