# Run 004 — DataScout Source-to-Marketplace G4 package

This directory is the controlled, non-external deployment package for Factory Run `DS-S2M-004`.

It rehabilitates the existing React/Vite/Firebase DataScout repository. It does not replace the application, migrate legacy product data, or authorize live agent work.

## Gate position

- G0 Opportunity: passed
- G1 Classification: passed
- G2 Design: passed
- G3 Simulation: passed, 21/21 offline contract cases
- G4 Deployment: package built; local acceptance must pass and n8n/Firestore emulator execution evidence is still required before the gate can pass
- G5–G7: blocked

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

## Firestore emulator acceptance

The rules under `firestore/` are intentionally isolated and default-deny. They must be tested only with a disposable emulator project.

Do **not** deploy `firestore.g4.emulator.rules` to the current `salescope-7f11d` project: it denies legacy collections by design. Production rule integration requires a separate reviewed change after emulator evidence passes.

## G4 exit evidence still required

This package is not itself a G4 pass. The remaining evidence is:

1. Import and manually execute the inactive n8n workflow in a non-production workspace.
2. Run Firestore emulator allow/deny tests with a synthetic `datascoutG4Operator` claim.
3. Demonstrate kill, stop, restart, idempotency, bounded retry, dead letter, and telemetry in the packaged environment.
4. Record exact runtime versions, environment, results, logs, and rollback steps.
5. Complete the G4 Gate Review without changing any authority.

No G5 shadow run or external activation may begin before that review passes.
