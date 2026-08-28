# Architecture plan

## Reuse-first design

Keep `team-builder.cjs` responsible for governance, run allocation, provenance, package output, and legacy compilation. Add a small pure module, `topology-compiler.cjs`, for hybrid vocabulary and graph validation. Keep `team-runner.cjs` synthetic and make its hybrid boundary explicit.

## Data flow

1. Validate the existing request and zero-authority envelope.
2. Select legacy or hybrid topology mode.
3. In hybrid mode, validate component classifications and governance roles.
4. Validate the explicit directed handoff graph.
5. Compile stable run-scoped component identifiers.
6. Emit manifest, contract, and receipt with truthful component and agent counts.
7. Refuse generic execution; require a run-specific qualified runtime.

## Rollback

Revert the release commit. Existing immutable run manifests remain unchanged, and legacy requests remain supported throughout.

