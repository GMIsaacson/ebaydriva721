# Work Control v1 — Test Evidence

Tested branch: `develop/factory-v0.2`

Exact tested commit: `10aeded62fc4f9b8ed9f5aa080ccd3b2483ccf6d`

Execution environment: Factory host using `node:20-alpine` in a disposable Docker container.

## Result

**29 / 29 tests PASS**

The suite includes:

- offline browser fallback never claims Factory execution;
- same-origin browser API restriction;
- no dynamic code execution;
- all six required owner workflows visible;
- canonical registry uniqueness and permanent Run 013 gap;
- Run 005 pilot and Run 008 Operations Core are not runnable;
- source-referenced registry policy;
- v0.1 recovery-anchor visibility;
- responsive/accessibility shell checks;
- command creation is `QUEUED_GOVERNED` / `WAITING_WORKER`;
- command SHA-256 integrity validation and tamper detection;
- every new command starts with zero external actions, zero spend and no deploy/publish/production authority;
- approval records do not automatically transmit authority;
- receipts exceeding external-action, spend or production ceilings are rejected;
- a zero-authority valid terminal receipt can become completed work;
- localhost health/state endpoints work;
- persistent POST `/api/v1/commands` writes a governed command and exposes queued work without claiming execution;
- non-runnable Run 008 command submission is rejected;
- worker receipt endpoint is disabled when no worker token exists;
- static UI is served with CSP, frame denial and MIME-sniff protection;
- even an authenticated test worker cannot report an external action above the command ceiling.

## Runtime SHA-256 values at tested commit

- `index.html` — `3f20d09cc90232f956e5193ec4f3fb90375401a6465d1c44eff05680d50f4009`
- `styles.css` — `e7c918653aab94b91dd40c5451d454d923a54ba72ef813b3cbd289aea25781e7`
- `core.js` — `b809ab9560b1fde7ca540e3923279380af03621bd8decd504bba8143b86e66b9`
- `api-client.js` — `46ba27889e63668752a4bdaa3e4dd3e0876d178f5673fdbe47329a366374a03e`
- `app.js` — `4536b64fa1a045165b2e03865458762b17a46a2fc0f136021146a1eb43764ff5`
- `server-core.cjs` — `f31b822bbce5ddd22bdb3ae15218c914eab7fe63ba81d68d2e514fe1679afc63`
- `server.cjs` — `a1a3df78345ca1f3a4e69106b40331bfc36d47cd3e70c774dd4411687eaa0a28`
- `registry.json` — `8832f0e29ed5434b6b081d0f26dcfa48bdf5226138d52ff64092d584249abe3b`
- `bootstrap-state.json` — `0fa3443eff47cdce957fbdb446c7a18e182eae9bab7d3a8e5745ce3dcc61c324`

## Test runner note

The Factory host does not expose host-level Node.js, so tests are deliberately run through a pinned disposable `node:20-alpine` container. No npm install or third-party runtime dependency is required.

## Boundary

This evidence proves the queue-only internal control layer. It does **not** prove a general-purpose team executor exists, and it does not authorize public deployment.
