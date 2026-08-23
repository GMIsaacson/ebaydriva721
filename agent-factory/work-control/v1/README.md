# Work Control v1

Owner-facing control UI for Factory 1 on the Factory v0.2 development line.

## Current state

Work Control v1 now has three operating states:

1. **Governed worker mode** — the browser talks to the same-origin Work Control API, which persists assignment packets, atomically claims work, invokes the bounded AI worker, validates terminal receipts and exposes step-by-step results.
2. **Queue-only mode** — the persistent control API is available but the worker is offline; assignments remain queued and Work Control does not claim execution.
3. **Offline safe mode** — if the API cannot be reached, the browser falls back to local drafts and explicitly does not claim Factory dispatch.

The UI remains a control/read surface. It is **not** a second source of authority.

## Six owner workflows

1. **Teams** — see canonical Factory runs and distinguish reusable teams, project runs, pilots and operations core.
2. **Run Team** — submit a governed `team_assignment_v1` packet into the persistent control queue.
3. **See Work** — inspect queued/running/blocked/completed work and worker stages.
4. **Approve / Reject** — persist an owner decision while keeping automatic executor authority consumption disabled.
5. **View Results** — show a result only when a validated terminal receipt exists.
6. **History** — inspect the persistent control/event ledger plus bootstrap history.

## Governed worker v1

The current worker is deliberately narrow:

- provider: OpenAI Responses API;
- default model: `gpt-5.6-luna`;
- one model invocation per claimed assignment;
- maximum output: `1600` tokens;
- internal model-compute budget: `2` cents per assignment;
- automatic retries: disabled;
- concurrency: effectively one worker loop;
- external tools/connectors: none;
- deployment, messaging, purchasing, production mutation and other external actions: not allowed.

The worker must return `BLOCKED_OWNER` or `BLOCKED_EXTERNAL` rather than claim work it cannot actually perform.

Assignments are claimed atomically before model execution. Claims do not expire automatically in v1. If the worker crashes after claim, the work remains visibly claimed for inspection rather than being silently re-run and charged again.

## Authority boundary

Every new UI assignment starts with this external authority ceiling:

- external actions: `0`
- external spend: `$0`
- deploy: `false`
- publish: `false`
- message/contact: `false`
- destructive actions: `false`
- production mutation: `false`

Separately, the command carries a maximum internal model-compute budget of `2` cents. The model budget is included inside the command integrity hash and validated against the terminal receipt.

A command receives a SHA-256 integrity hash. Terminal receipts are validated against the command and rejected if they exceed either the external authority ceiling or the model-compute budget.

Approval decisions are recorded by Work Control, but v1 does not automatically transmit/consume that authority. Future connector/tool execution requires its own authenticated and bounded authority path.

## Credential posture

The OpenAI project key is not stored plaintext in Git or in the Work Control data directory. Factory1 stores an encrypted key payload plus a server-local RSA private transport key. The worker decrypts the key in memory at startup.

The internal Work Control worker token is mounted from a server-local secret file. The worker container does not receive the OpenAI key or worker token as configured Docker environment values.

## Canonical registry

`registry.json` is a source-referenced read model of Factory Runs. Run 013 remains permanently reserved and absent. Non-worker records such as the Run 005 pilot and Run 008 Operations Core are visible but not directly runnable.

The registry is not authoritative by itself; canonical governance records remain the source of truth.

## Internal server

The control service is dependency-free Node.js. Factory1 currently runs it in a dedicated container bound to host loopback only:

- host bind: `127.0.0.1:8787`
- API namespace: `/api/v1/*`
- worker and Work Control communicate on an isolated Docker bridge network
- no public Work Control port
- existing n8n/Postgres remain separate

Do not expose this version directly to the public internet. Authenticated remote owner access is a separate next gate.

## Live proof

A bounded Run 014 worker-readiness assignment completed end-to-end with:

- terminal state: `DELIVERED`
- external actions: `0`
- external spend: `0`
- production mutation: `false`
- model: `gpt-5.6-luna`
- input tokens: `236`
- output tokens: `275`
- estimated model cost: `0.19` cents

The receipt explicitly stated that the worker can reason from supplied information but cannot browse, access systems/credentials, deploy, message, purchase, modify production data or claim unavailable evidence.

## Verification

The deterministic suite covers browser fallback, command integrity, canonical registry constraints, atomic claiming, worker authentication, model budget enforcement, receipt validation, credential decryption behavior, same-origin browser access and localhost HTTP behavior. See `docs/test-evidence.md`.

## Version

Work Control: `1.1.0-governed-worker`

Factory development line: `develop/factory-v0.2`

Frozen Factory recovery baseline remains `archive/factory-v0.1.0` at commit `37392d74728a44c3e502959c09e6400de40b846e`.

Factory v0.2 has **not** been promoted or merged into the v0.1 master baseline.
