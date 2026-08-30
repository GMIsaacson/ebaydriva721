# Work Control v1 — Security / Authority Review

Decision: **PASS — INTERNAL GOVERNED WORKER**

## Reviewed boundary

Work Control v1 now consists of a same-origin browser UI, a dependency-free Node.js control service, and one bounded AI worker. The service is host-loopback only; the worker has no host port. Both communicate on a dedicated Docker bridge.

The worker is an internal reasoning executor, not a general external-action agent.

## Positive controls

- Work Control host bind remains `127.0.0.1:8787` only.
- Worker exposes no host port.
- Browser API client accepts only same-origin `/api/v1/*` paths.
- CSP limits scripts, styles and browser connections to self; framing is denied.
- Commands receive deterministic SHA-256 integrity hashes.
- Run 013 remains reserved and absent.
- Records marked non-runnable, including the Run 005 pilot and Run 008 Operations Core, cannot receive direct assignments.
- Every UI-created command starts with zero external actions, zero external spend, no deploy, no publish, no message/contact, no destructive action and no production mutation.
- Each command separately carries a bounded internal model-compute budget; v1 defaults to `2` cents and rejects values above the configured small ceiling.
- The model-compute budget is integrity-protected as part of the command.
- Terminal receipts are rejected if they exceed external-action, external-spend, production-mutation or model-compute ceilings.
- The worker atomically claims a command before model execution. A claimed command cannot be claimed twice.
- Claims do not auto-expire in v1. A crash therefore leaves visible stuck work rather than silently performing another paid model invocation.
- Duplicate terminal receipts are rejected.
- Worker routes require a dedicated secret token.
- The worker token is mounted from a server-local secret file and is not present in Docker configured environment values.
- The OpenAI project key is stored only as encrypted ciphertext on disk alongside a server-local RSA private transport key. The worker decrypts the API key in memory at startup; no plaintext API-key file is created.
- Worker logs never intentionally print the API key.
- The worker performs one OpenAI Responses API invocation per claimed assignment and has automatic model retries disabled.
- Current worker has no browser, connectors, shell tools, deployment capability, messaging capability, purchasing capability or production mutation capability.
- Worker instructions require `BLOCKED_OWNER` / `BLOCKED_EXTERNAL` instead of unsupported success claims.
- Owner approval decisions remain `transmitted=false` / `NOT_CONSUMED_BY_EXECUTOR`; an approval click does not automatically grant the worker new external authority.
- Request bodies are bounded to 64 KiB.
- Runtime has no third-party package dependency and no dynamic `eval` / `Function` execution.
- Existing n8n/Postgres remain separate from the Work Control data ledger.

## Live proof

Command `WC-20260823033340-59ae8e9ec2` completed through the real queue → claim → GPT-5.6 Luna → receipt path.

Observed receipt:

- terminal state: `DELIVERED`
- external actions: `0`
- external spend: `0`
- production mutation: `false`
- input tokens: `236`
- output tokens: `275`
- estimated model cost: `0.19` cents

The model explicitly stated that it could reason from supplied information but could not browse, access systems or credentials, use connectors/shell, deploy, message, purchase or mutate production state.

## Deliberate limitations

- No authenticated remote/public owner-access layer exists yet.
- The worker has no connector/tool execution path in v1.
- Approval decisions cannot yet be consumed as executor authority.
- The checked-in registry is a source-referenced read model rather than a live Notion mirror.
- Claims do not automatically recover after a worker crash; stuck claims require deliberate inspection/recovery.
- Model output quality remains probabilistic. The worker can produce analysis and text but cannot independently verify external facts without a future evidence/tool layer.
- Host compromise remains inside the trusted boundary because the server necessarily possesses the private material needed to use the encrypted API credential.

## Required operating posture

For this release:

- keep the Work Control host port bound to loopback only;
- keep the worker on the internal Docker network with no host port;
- keep external command authority at zero by default;
- do not treat persisted owner approval as exercised authority;
- do not add connectors/tools without a separate bounded authority design and acceptance test;
- do not expose Work Control directly to the public internet before authenticated owner access is implemented and reviewed.

## Residual risk

The primary residual risks are model-quality errors, intentional lack of automatic recovery for claimed jobs, and compromise of the trusted Factory host. These are acceptable for the current controlled internal reasoning-worker scope and are materially safer than granting premature autonomous external action.

## Disposition

Work Control v1 is suitable for **controlled internal live operation with one zero-external-authority governed reasoning worker**. Remote owner access and external-action/tool execution remain separate future gates.
