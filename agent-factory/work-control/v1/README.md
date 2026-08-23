# Work Control v1

Owner-facing control UI for Factory 1 on the Factory v0.2 development line.

## Current state

Work Control v1 now has two operating modes:

1. **Persistent internal control mode** — the browser talks to the same-origin Work Control API, which reads the canonical run registry and persists governed assignment packets, approvals, receipts and history.
2. **Offline safe mode** — if the API cannot be reached, the browser falls back to local drafts and explicitly does not claim Factory dispatch.

The UI remains a control/read surface. It is **not** a second source of authority.

## Six owner workflows

1. **Teams** — see canonical Factory runs and distinguish reusable teams, project runs, pilots and operations core.
2. **Run Team** — submit a governed `team_assignment_v1` packet into the persistent control queue.
3. **See Work** — inspect queued/running/blocked/completed work and stage evidence.
4. **Approve / Reject** — persist an owner decision while keeping automatic executor authority consumption disabled.
5. **View Results** — show a result only when a recorded result/receipt exists.
6. **History** — inspect the persistent control/event ledger plus bootstrap history.

## Safety boundary

Every new UI assignment starts with this authority ceiling:

- external actions: `0`
- spend: `$0`
- deploy: `false`
- publish: `false`
- message/contact: `false`
- destructive actions: `false`
- production mutation: `false`

A command receives a SHA-256 integrity hash. Terminal receipts are validated against the command and rejected if they exceed its authority ceiling.

Approval decisions are recorded by Work Control, but v1 does not automatically transmit/consume that authority. A later worker/executor integration must have its own authenticated and bounded authority path.

The general-purpose Factory team executor is **not connected yet**. A persistent command is real queued work, but it remains `WAITING_WORKER` until a governed executor produces a valid receipt. This distinction is deliberate.

## Canonical registry

`registry.json` is a source-referenced read model of Factory Runs. Run 013 remains permanently reserved and absent. Non-worker records such as the Run 005 pilot and Run 008 Operations Core are visible but not directly runnable.

The registry is not authoritative by itself; canonical governance records remain the source of truth.

## Internal server

The control service is dependency-free Node.js:

```bash
node agent-factory/work-control/v1/server.cjs
```

Defaults:

- bind: `127.0.0.1`
- port: `8787`
- API namespace: `/api/v1/*`
- worker receipt/approval routes: disabled unless `WORK_CONTROL_WORKER_TOKEN` is explicitly configured

For containerized internal operation, bind the host port to loopback only. Do not expose this version directly to the public internet.

## Verification

The control/API candidate has deterministic tests covering UI fallback, command integrity, authority ceilings, canonical registry constraints and localhost HTTP behavior. See `docs/test-evidence.md`.

## Version

Work Control: `1.0.0-control-api`

Factory development line: `develop/factory-v0.2`

Frozen Factory recovery baseline remains `archive/factory-v0.1.0` at commit `37392d74728a44c3e502959c09e6400de40b846e`.

Factory v0.2 has **not** been promoted or merged into the v0.1 master baseline.
