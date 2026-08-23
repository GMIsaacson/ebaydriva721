# Work Control v1 — Test Evidence

Tested branch: `develop/factory-v0.2`

Exact tested runtime commit: `85d54d16c61bc2cbd09d44996e3e9ab289eada32`

Execution environment: Factory1 host using pinned `node:20-alpine` disposable containers.

## Result

**46 / 46 tests PASS**

Syntax checks also passed for all browser/server/worker JavaScript modules.

## Coverage

The suite verifies:

### Browser and control surface

- offline browser fallback never claims Factory execution;
- browser API remains same-origin only;
- no dynamic `eval` / `Function` execution;
- all six owner workflows are present;
- responsive viewport and accessible drawer semantics;
- live control API and live worker state remain visibly distinguishable;
- Factory v0.1 recovery anchor remains explicit.

### Registry and governance

- canonical registry retains the permanent Run 013 gap;
- Run 005 pilot and Run 008 Operations Core cannot be run directly;
- registry entries retain canonical source references;
- assignments are integrity-protected;
- tampering with instruction or model budget invalidates command integrity;
- every command starts with zero external-action authority and zero external-spend authority;
- model-compute budget defaults to 2 cents and is bounded to a small configured range;
- approval decisions cannot automatically transmit authority.

### Receipt enforcement

- receipt above external-action ceiling is rejected;
- receipt above external-spend ceiling is rejected;
- receipt above model-compute ceiling is rejected;
- production mutation without authority is rejected;
- bounded terminal receipts become visible completed work;
- worker step evidence is exposed in the work record;
- duplicate terminal receipts are rejected.

### Worker orchestration

- worker endpoints fail closed without authentication;
- heartbeat makes the worker visibly online;
- command claim is atomic and occurs exactly once;
- terminal receipt requires a prior claim;
- claimed jobs appear running without mutating the integrity-protected command;
- no automatic claim expiry/reclaim path is used in v1.

### Credential / model path

- encrypted test API credential decrypts in memory;
- worker prompt explicitly forbids unsupported external actions and requires blocking instead of invented success;
- Responses API output text extraction is deterministic;
- worker output JSON accepts only allowed terminal states;
- model-cost arithmetic is enforced against the command budget;
- worker receipt reports zero external actions and external spend;
- worker source contains one model invocation path and no API-key logging path.

## Tested runtime SHA-256 values

- `index.html` — `3f20d09cc90232f956e5193ec4f3fb90375401a6465d1c44eff05680d50f4009`
- `styles.css` — `e7c918653aab94b91dd40c5451d454d923a54ba72ef813b3cbd289aea25781e7`
- `core.js` — `b809ab9560b1fde7ca540e3923279380af03621bd8decd504bba8143b86e66b9`
- `api-client.js` — `055637db5e152ef913deb23d4385ab3fe083bec6a00229d67ac9f29aec3a3113`
- `app.js` — `4536b64fa1a045165b2e03865458762b17a46a2fc0f136021146a1eb43764ff5`
- `server-core.cjs` — `f3a59e4177e4448e9da152b8e7650fd16f36d9f3b684cb22ebf490b8569ba1b9`
- `server.cjs` — `cf2660cccdef9a0299a7fc70b10aaf8d0c9bc7eec8af41dffd58917faecf2a6c`
- `worker-core.cjs` — `3ad98f0525cdb21ad054b61f94a10070ab1490b350bd1b333706c0c8faaf6321`
- `worker.cjs` — `6ceab08bce8497295237c4878d218d201fdaa35d52f9e778046310d372a66f88`
- `registry.json` — `8832f0e29ed5434b6b081d0f26dcfa48bdf5226138d52ff64092d584249abe3b`
- `bootstrap-state.json` — `0fa3443eff47cdce957fbdb446c7a18e182eae9bab7d3a8e5745ce3dcc61c324`

## Live end-to-end proof

A real bounded assignment was submitted through Work Control to Run 014:

Command: `WC-20260823033340-59ae8e9ec2`

Observed result:

- terminal state: `DELIVERED`
- work state: `completed`
- model: `gpt-5.6-luna`
- input tokens: `236`
- output tokens: `275`
- estimated model cost: `0.19` cents
- external actions: `0`
- external spend: `0`
- production mutation: `false`

The worker truthfully reported its current boundary: reasoning/text generation from supplied information is available; browsing, systems/credential access, connectors, shell execution, deployment, messaging, purchasing and production modification are unavailable and must block rather than be claimed as completed.

## Test runner notes

The Factory host does not expose host-level Node.js, so deterministic tests run through a pinned `node:20-alpine` container. No npm install or third-party runtime package is required.

Two earlier apparent failures were test-harness defects, not runtime defects: Docker glob expansion and an over-broad no-retry regex. Both were corrected before the 46/46 acceptance run.

## Boundary

This evidence proves the controlled internal reasoning-worker loop. It does **not** authorize public exposure, connector/tool execution, autonomous external actions, production mutation, or automatic consumption of owner approvals.
