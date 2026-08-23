# Work Control v1 — Security / Authority Review

Decision: **PASS — INTERNAL QUEUE-ONLY CONTROL API**

## Reviewed boundary

Work Control v1 consists of a same-origin browser UI plus a dependency-free Node.js control service intended to bind to localhost/internal infrastructure. It creates persistent governed assignment packets but does not itself perform team work or external actions.

## Positive controls

- Default server bind is `127.0.0.1`.
- Browser API client rejects paths outside `/api/v1/` and uses same-origin requests only.
- CSP limits scripts, styles and connections to self; framing is denied.
- Commands are normalized and receive a canonical SHA-256 integrity hash.
- Canonical registry rejects missing teams, the permanent Run 013 reservation and records marked non-runnable.
- Every UI-created command starts at zero external actions, zero spend, no deploy, no publish, no message/contact, no destructive action and no production mutation.
- Terminal receipts are validated against the originating command ceiling.
- Worker receipt and worker approval-request routes require `WORK_CONTROL_WORKER_TOKEN`; when no token is configured they fail closed with 403.
- Owner approval decisions remain `transmitted=false` / `NOT_CONSUMED_BY_EXECUTOR`; this API does not silently turn an approval click into new executor authority.
- Request bodies are bounded to 64 KiB.
- Runtime has no third-party package dependency and no dynamic `eval`/`Function` execution.
- Persistent data is JSON/JSONL under a dedicated data directory rather than the existing n8n/Postgres database.

## Deliberate limitations

- There is no general-purpose team worker/executor connected yet.
- There is no multi-user authentication layer for remote/public access.
- The registry is a checked-in read model with canonical source links; it is not a live Notion database mirror yet.
- A user with filesystem access to the control-data directory could alter stored files. Commands carry integrity hashes, and receipt validation checks the command hash, but host/filesystem security remains part of the trusted internal boundary.
- Approval decisions are recorded but cannot yet be consumed by a worker. This is safer than premature authority wiring.

## Required deployment posture

For this release candidate:

- bind the host port to loopback only;
- configure **no worker token** until a real worker adapter is separately designed and reviewed;
- do not expose directly to the public internet;
- do not place production credentials in the Work Control directory;
- do not use approval records as proof that external authority was exercised.

## Residual risk

The main residual risk is control-plane misinterpretation: a queued command may look like work has started when no worker exists. The UI mitigates this by using `WAITING_WORKER`, queued status, and explicit text that no terminal receipt exists.

## Disposition

The current implementation is suitable for an **internal localhost control service** and persistent queue rehearsal. Public access, authenticated remote owner access, and general-purpose worker execution require separate review and bounded authority.
