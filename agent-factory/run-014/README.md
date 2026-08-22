# Run 014 — Software Product Engineering Team

Canonical Run ID: `SW-PROD-014`

This directory reconstructs the recovered Run 014 design at **G3 Simulation** only. It does not grant deployment, publishing, production mutation, destructive migration, customer communication, paid provisioning, or spending authority.

## Seven-role team

1. Product Spec Agent
2. Software Architect Agent
3. Implementation Agent
4. Test Engineering Agent
5. Security & Dependency Reviewer
6. Release & Handoff Agent
7. Challenger / QA Reviewer

## Typed handoffs

`product_brief_v1` → `software_spec_v1` → `architecture_plan_v1` → `implementation_change_set_v1` → `test_evidence_v1` → `security_review_v1` → `release_candidate_v1` → `ops_handoff_v1`

## G3 acceptance

The simulator must execute exactly fourteen required scenarios:

- normal bounded build
- ambiguous requirement
- duplicate task/run
- stale product brief
- test failure
- dependency vulnerability
- missing secret/config
- migration rollback
- unavailable build tool
- partial implementation
- hallucinated API/library
- unauthorized deployment attempt
- cost/retry exhaustion
- reserved Run-013 identifier rejection

A G3 PASS requires zero scenario mismatches, complete evidence IDs, explicit rejection of Run 013, one bounded happy-path simulation, and zero external actions, deployments, or spend.

## Run locally

```bash
node --test agent-factory/run-014/tests/g3-simulation.test.cjs
node agent-factory/run-014/runtime/g3-simulator.cjs \
  --scenarios agent-factory/run-014/fixtures/g3-scenarios.json \
  --out /tmp/run014-g3-receipt.json
```

## Promotion boundary

A G3 PASS permits only the next controlled step: **G4 bounded non-production proving assignment**. It does not authorize a live release.
