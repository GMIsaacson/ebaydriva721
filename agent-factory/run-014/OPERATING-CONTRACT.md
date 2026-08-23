# Run 014 — Software Product Engineering Team Operating Contract

## Status

Run ID: `SW-PROD-014`

Lifecycle: **Controlled Live**

Terminal readiness: **READY_FOR_CONTROLLED_OPERATION**

Run 014 is the canonical Factory 1 team for turning an approved software product brief into a tested, security-reviewed, versioned release candidate with rollback evidence and a typed operations handoff.

## Standard invocation

Use Run 014 when the assignment is an approved software product, internal application, integration, or bounded software change.

The team executes this typed chain:

`product_brief_v1` → `software_spec_v1` → `architecture_plan_v1` → `implementation_change_set_v1` → `test_evidence_v1` → `security_review_v1` → `release_candidate_v1` → `ops_handoff_v1`

## Required roles

1. Product Spec Agent
2. Software Architect Agent
3. Implementation Agent
4. Test Engineering Agent
5. Security & Dependency Reviewer
6. Release & Handoff Agent
7. Challenger / QA Reviewer

Implementation cannot self-verify. Security and Challenger/QA failures cannot be waived by the implementation role.

## Default authority

Standing external authority is **zero**.

Run 014 may read approved inputs, reason, design, write code/configuration in the approved workspace, run deterministic tests, perform security/dependency review, hash artifacts, prepare release notes and rollback instructions, and prepare typed handoffs.

Run 014 may **not** autonomously:

- deploy or publish externally;
- promote a preview to production;
- change domains or DNS;
- provision paid infrastructure;
- rotate secrets;
- contact customers;
- perform destructive migrations;
- mutate production data;
- spend money.

Every external action requires a fresh, bounded owner approval with explicit target, action count, spend ceiling, and environment. Any requested/actual target mismatch fails closed.

## Release gate

A release candidate is not ready unless all of the following are present and PASS:

- acceptance-criteria traceability;
- deterministic tests;
- independent security/dependency review;
- artifact hashes;
- release notes;
- rollback instructions;
- Challenger/QA review;
- clean authority accounting.

## Deployment gate

A deployment can proceed only under a fresh bounded approval. Post-deployment verification must confirm the actual environment/target, project scope, readiness state, artifact integrity appropriate to the platform, external-action count, and spend.

Preview deployment evidence must never be treated as production evidence. Production activation requires its own explicit authority and downstream operations readiness.

## Run 008 boundary

The canonical downstream operations target is `OPS-CORE-008` using `ops_handoff_v1`.

Run 014 may prepare and validate that handoff. It must not claim that Run 008 accepted or executed the handoff unless Run 008 independently records that acceptance through its own governance lifecycle.

## Failure behavior

Fail closed on ambiguous scope, missing acceptance criteria, stale evidence, unsupported dependencies, test/security failures, authority expansion, project mismatch, target mismatch, unknown external-action result, or cost/retry exhaustion.

Do not blindly retry an external action with an unknown outcome.

## Revalidation

Reopen governance review when there is a material architecture change, new standing authority, a breaking interface/schema change, repeated operational failure, a security incident, or a change that expands production/customer/cost exposure.

## G6 evidence

G3 fresh simulation: PASS.

G4 real internal application loop: PASS.

G5 bounded Vercel preview operational rehearsal: PASS.

G6 controlled-live promotion: PASS.

The legacy Vercel production-target deployment created during the failed first G5 attempt is quarantined technical debt and is not valid promotion evidence.
