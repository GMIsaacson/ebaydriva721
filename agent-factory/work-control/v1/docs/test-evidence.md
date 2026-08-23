# Work Control v1 — Test Evidence

Exact implementation commit tested: `7d2a6ac58cff6e2f112602f585a427cc5ada96e2`

Independent environment: Factory host using `node:20-alpine` container.

Result: **12/12 PASS**

Covered behaviors:

- local-only Run Team request staging;
- fail-closed dispatch when execution adapter is disconnected;
- local-only approval decisions with `transmitted=false`;
- no double-decision of approvals;
- bounded instruction normalization;
- owner metric calculations;
- no remote scripts or browser network APIs;
- no `eval` / dynamic Function execution;
- all six owner workflows present;
- reserved run number absent from allocatable registry;
- frozen Factory v0.1 recovery anchor visible and v0.2 development line explicit;
- responsive viewport and accessible drawer semantics.

Runtime SHA-256:

- `index.html` — `90c3a4db22255227b0decc278b3fcf9137de2e1e798e73cfae3049310831b65a`
- `styles.css` — `e7c918653aab94b91dd40c5451d454d923a54ba72ef813b3cbd289aea25781e7`
- `core.js` — `b809ab9560b1fde7ca540e3923279380af03621bd8decd504bba8143b86e66b9`
- `app.js` — `b157a550e00fc377d7482f6029b4f4ff4b2aa8be293d207befb4546659245d76`

Note: later documentation-only commits do not alter these four tested runtime files.
