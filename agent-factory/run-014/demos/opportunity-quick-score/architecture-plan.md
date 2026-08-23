# architecture_plan_v1 — Opportunity Quick Score

## Decision

Use a dependency-free static application with four runtime files:

- `index.html` — semantic UI shell
- `styles.css` — responsive presentation
- `score.js` — pure deterministic scoring module
- `app.js` — DOM binding only

Tests run with Node's built-in `node:test`; no package installation is required.

## Data flow

User input → DOM parser → `scoreOpportunity()` → deterministic result object → DOM renderer.

No data leaves the browser and no persistence exists.

## Failure behavior

Invalid or missing values are clamped to the 1–10 scoring range. The scoring module never performs I/O. DOM code fails visibly if required elements are absent rather than fabricating a decision.

## Security boundary

No remote scripts, network APIs, auth, secrets, storage, HTML injection, or dynamic code execution. Opportunity names are rendered through `textContent` only.

## Rollback

Because this assignment is an isolated directory on a feature branch, rollback is deletion/revert of that directory or abandonment of the branch. No database, migration, external service, or production state is affected.
