# Run 014 — Software Product Engineering Team Operating Contract

## Status

Run ID: `SW-PROD-014`

Lifecycle: **Controlled Live**

Terminal readiness: **READY_FOR_CONTROLLED_OPERATION**

Current structural extension: **A0-SOFT-014-EXTEND-001 — production implementation v2**

Run 014 is the canonical Factory 1 team for turning an approved software/product brief into a tested, security-reviewed, versioned release candidate with rollback evidence and a typed operations handoff.

For customer-facing websites, Run 014 is the **implementation owner**, not the commercial creative owner. Website Business or another explicitly approved upstream design owner must supply the creative/design handoff.

## Standard invocation

General software:

`product_brief_v1` → `software_spec_v1` → `architecture_plan_v1` → `implementation_change_set_v1` → `test_evidence_v1` → `security_review_v1` → `release_candidate_v1` → `ops_handoff_v1`

Website implementation v2:

`approved_creative_handoff_v1` → `product_brief_v1` → `architecture_plan_v1` → `artifact_package_v2` → `test_evidence_v1` → `browser_qa_v1` → `visual_implementation_qa_v1` → targeted `repair_receipt_v1` loop → `security_review_v1` → `release_candidate_v1`

The dedicated governed executor is selected with `[WEB_IMPL_V2]`.

## Required roles

1. Product Spec Agent
2. Software Architect Agent
3. Implementation Agent
4. Test Engineering Agent
5. Visual Implementation QA Agent
6. Security & Dependency Reviewer
7. Release & Handoff Agent
8. Challenger / QA Reviewer

Implementation cannot self-verify. Visual Implementation QA, Security, and Challenger/QA failures cannot be waived by the implementation role.

## Website creative boundary

Run 014 **must not** become a replacement art-direction team.

When an approved creative/design handoff exists:

- the upstream owner controls audience framing, commercial positioning, emotional tone, visual concept, imagery strategy, conversion hierarchy, and brand direction;
- Run 014 translates that direction into coherent production code;
- Run 014 may make implementation-level choices needed for responsiveness, accessibility, semantics, performance, and component consistency;
- Run 014 may not silently replace the approved concept with a different aesthetic;
- if implementation constraints make the approved direction infeasible, Run 014 must surface the conflict rather than improvise a new concept.

## Production implementation v2 requirements

A website artifact must be emitted as **complete coherent files**, not conversational fragments that are later stitched together.

Minimum static homepage package:

- `index.html`
- `styles.css`

The implementation executor must:

- generate HTML as one complete file;
- generate CSS as one complete file against the actual HTML class vocabulary;
- use only exact approved absolute destination links;
- use only approved remote asset/image URLs;
- preserve required literal business/service/contact strings;
- reject malformed CSS, excessive DOM↔CSS drift, invented links/assets, external scripts, tracking/network code, and unauthorized live form actions;
- render mobile, tablet, and desktop evidence;
- test overflow and navigation behavior;
- run screenshot-aware implementation QA;
- check visible contrast and creative fidelity;
- send defects back to implementation for bounded targeted repair;
- rerun all downstream gates after repair;
- freeze artifact hashes before release-candidate handoff.

## Visual Implementation QA

The Visual Implementation QA Agent is **not an Art Director**.

It may identify implementation defects such as:

- broken or missing images;
- bad crops;
- merged labels;
- weak or invisible contrast;
- excessive/awkward whitespace;
- unfinished/sparse sections or footers;
- oversized empty cards;
- inconsistent density;
- broken responsive composition;
- navigation/interaction defects;
- divergence from the approved creative handoff.

It may issue surgical repair directives. It may not invent a new creative concept.

## Default authority

Standing external authority is **zero**.

Run 014 may read approved inputs, reason, design implementation architecture, write code/configuration in the approved workspace, run deterministic/browser tests, create screenshots, perform visual implementation QA, perform security/dependency review, hash artifacts, prepare release notes and rollback instructions, and prepare typed handoffs.

Run 014 may **not** autonomously deploy/publish externally, promote preview to production, change domains/DNS, provision paid infrastructure, rotate secrets, contact customers, perform destructive migrations, mutate production data, or spend money.

Every external action requires a fresh bounded owner approval. Any requested/actual target mismatch fails closed.

## Release gate

A release candidate is not ready unless all applicable evidence is PASS:

- acceptance-criteria traceability;
- approved creative/design handoff where applicable;
- coherent artifact package;
- deterministic source-integrity tests;
- exact link/asset verification;
- browser mobile/tablet/desktop evidence;
- responsive/navigation/overflow evidence;
- screenshot-aware visual implementation QA;
- contrast and creative-fidelity checks;
- independent security/dependency review;
- artifact hashes;
- release notes;
- rollback instructions;
- Challenger/QA review;
- clean authority accounting.

## Deployment gate

Deployment remains a separate approval-gated action. Preview evidence must never be treated as production evidence.

## Run 008 boundary

The canonical downstream operations target is `OPS-CORE-008` using `ops_handoff_v1`. Run 014 may prepare and validate the handoff but cannot claim Run 008 accepted/executed it without Run 008 evidence.

## Failure behavior

Fail closed on ambiguous scope, missing approved creative handoff for website-v2 work, missing acceptance criteria, stale evidence, unsupported dependencies, source-integrity failure, invented links/assets, browser failure, visual implementation failure, security failure, authority expansion, target mismatch, unknown external-action result, or cost/retry exhaustion.

Do not hide a defect by manually repairing team output outside the governed repair loop.

## Revalidation

Reopen governance review for material architecture changes, new standing authority, breaking interfaces/schemas, repeated operational failure, security incidents, or changes expanding production/customer/cost exposure.
