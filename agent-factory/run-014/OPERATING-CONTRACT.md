# Run 014 — Software Product Engineering Team Operating Contract

## Status

Run ID: `SW-PROD-014`

Lifecycle: **Controlled Live**

Terminal readiness: **READY_FOR_CONTROLLED_OPERATION**

Current structural extensions:

- **A0-SOFT-014-EXTEND-001 — production implementation v2**
- **A0-SOFT-014-EXTEND-002 — calibrated frozen-baseline refinement**
- **A0-SOFT-014-EXTEND-003 — best-of-two implementation refinement**
- **A0-SOFT-014-EXTEND-004 — vision-conditioned implementation refinement**

Run 014 is the canonical Factory 1 team for turning an approved software/product brief into a tested, security-reviewed, versioned release candidate with rollback evidence and a typed operations handoff.

For customer-facing websites, Run 014 is the **implementation owner**, not the commercial creative owner. Website Business or another explicitly approved upstream design owner must supply the creative/design handoff.

## Standard invocation

General software:

`product_brief_v1` → `software_spec_v1` → `architecture_plan_v1` → `implementation_change_set_v1` → `test_evidence_v1` → `security_review_v1` → `release_candidate_v1` → `ops_handoff_v1`

Website implementation v2:

`approved_creative_handoff_v1` → `product_brief_v1` → `architecture_plan_v1` → `artifact_package_v2` → `test_evidence_v1` → `browser_qa_v1` → `visual_implementation_qa_v1` → targeted transactional `repair_receipt_v1` loop → `security_review_v1` → `release_candidate_v1`

The dedicated governed executor is selected with `[WEB_IMPL_V2]`.

Frozen-baseline refinement v1:

`frozen_implementation_baseline_v1` → calibrated BEFORE evidence → `creative_refinement_plan_v1` → one bounded implementation-refinement candidate → deterministic preservation gate → calibrated AFTER evidence → `before_after_comparison_v1` → security → Challenger/QA.

The dedicated governed executor is selected with `[CREATIVE_REFINE_V1]`.

Best-of-two frozen-baseline refinement v2:

`frozen_implementation_baseline_v1` → calibrated baseline evidence → Composition & Hierarchy Critic + Responsive Systems Critic + Commercial Polish Critic → `refinement_synthesis_v1` → independent Candidate A + Candidate B complete HTML/CSS packages → independent deterministic/browser/visual/security gates → `three_way_comparison_v1` → final Challenger/QA only for a qualifying winner.

The dedicated governed executor is selected with `[CREATIVE_REFINE_V2]`.

Vision-conditioned frozen-baseline refinement v3:

`frozen_implementation_baseline_v1` → calibrated baseline evidence → specialist implementation critiques → synthesis → isolated Candidate A/B implementation agents directly consume frozen-baseline viewport/full-page screenshots → source integrity → candidate render → exactly one candidate-local visual correction using baseline + that candidate’s own screenshots → post-correction source/browser/visual/security gates → independent baseline/A/B comparison → Challenger only for a qualifying winner.

The dedicated governed executor is selected with `[CREATIVE_REFINE_V3]`.

## Required roles

1. Product Spec Agent
2. Software Architect Agent
3. Implementation Agent
4. Test Engineering Agent
5. Visual Implementation QA Agent
6. Security & Dependency Reviewer
7. Release & Handoff Agent
8. Challenger / QA Reviewer
9. Implementation Refinement Planner — baseline-bound only
10. Implementation Refinement Agent — baseline-bound only
11. Before / After Comparison Reviewer — independent
12. Composition & Hierarchy Critic — implementation critique only
14. Responsive Systems Critic — implementation critique only
15. Commercial Polish Critic — implementation critique only
16. Refinement Synthesis Planner — baseline-bound implementation synthesis
17. Three-way Baseline / Candidate Selection Reviewer — independent
18. Vision-Conditioned Implementation Agent — baseline-bound implementation only
19. Candidate-Local Visual Correction Agent — one bounded correction, cannot self-approve

Implementation cannot self-verify. Visual Implementation QA, Security, comparative selection, and Challenger/QA failures cannot be waived by implementation roles.

## Website creative boundary

Run 014 **must not** become a replacement art-direction team.

When an approved creative/design handoff exists:

- the upstream owner controls audience framing, commercial positioning, emotional tone, visual concept, imagery strategy, conversion hierarchy, and brand direction;
- Run 014 translates that direction into coherent production code;
- Run 014 may make implementation-level choices needed for responsiveness, accessibility, semantics, performance, component consistency, hierarchy, spacing, and faithful visual refinement;
- a frozen-baseline refinement may improve presentation only inside the approved direction and approved asset set;
- Run 014 may not silently replace the approved concept with a different aesthetic, add new claims/assets, or invent a replacement brand strategy;
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
- render viewport and full-page mobile, tablet, and desktop evidence;
- test overflow, navigation, native disclosure semantics, and runtime-visible keyboard focus;
- run screenshot-aware implementation QA;
- check visible contrast and creative fidelity;
- send defects back to implementation for bounded targeted repair;
- treat every repair as a transaction: a candidate that regresses previously passing deterministic source invariants is rolled back to the last-known-good hashes;
- rerun all downstream gates after a committed repair;
- freeze artifact hashes before release-candidate handoff.

## Calibrated visual evaluation

Visual implementation quality is scored on **0–100 only**. Runtime records the raw model value and normalizes a non-zero value `<=10` to the corresponding 0–100 value as a fail-safe against accidental 0–10 scoring.

Anchors:

- **60** — usable/coherent but visibly generic or flawed;
- **75** — credible modern commercial site with meaningful repetition/polish gaps;
- **85** — strong production-quality commercial implementation with only a few material polish gaps;
- **92** — premium agency/Lovable-quality implementation with refined composition, varied visual storytelling, excellent responsive behavior, and no material visual defects;
- **96** — exceptional distinctive portfolio/reference quality with meticulous detail.

A competent modern site must never be assigned a single-digit 0–100 score merely because the evaluator used the wrong scale.

## Frozen-baseline refinement v1 requirements

`[CREATIVE_REFINE_V1]` is allowed only with exact baseline Work Control command ID, exact SHA-256 for baseline `index.html` and `styles.css`, the baseline's approved Product Spec and Architecture evidence, and current A0 coverage. The executor verifies hashes before model work. The candidate gets exactly one bounded pass; before/after viewport plus full-page evidence and independent comparison are mandatory.

Premium PASS requires deterministic source integrity, browser/accessibility, security, visual QA, contrast, creative fidelity and responsive quality PASS; calibrated implementation quality **>=92**; comparison `BETTER`, `materiallyImproved=true`, `agencyQuality=true`; and final independent Challenger PASS. Otherwise the frozen baseline remains authoritative.

## Best-of-two frozen-baseline refinement v2 requirements

`[CREATIVE_REFINE_V2]` requires the same exact baseline hash lock and approved upstream evidence. The frozen baseline is immutable.

Before code generation, three independent implementation critics must inspect the rendered baseline: Composition & Hierarchy, Responsive Systems, and Commercial Polish. They are not art directors and cannot change brand, positioning, claims, services, external assets, or business journeys.

A synthesis planner creates two meaningfully different implementation intents. Candidate A and Candidate B must each be generated independently as **complete coherent HTML/CSS packages from the same frozen baseline**. No cross-candidate patching, averaging, or manual merging is permitted.

Each candidate must independently pass source/link/asset preservation before browser, visual and security evidence counts. The independent three-way reviewer compares baseline, A and B and must default to the baseline unless a candidate is materially `BETTER`.

A candidate qualifies only when it reaches calibrated implementation quality **>=92**, visual QA/contrast/creative fidelity/responsive quality PASS, production gate PASS, browser/accessibility PASS, security PASS, relative `BETTER`, `materiallyImproved=true`, and `agencyQuality=true`. A final independent Challenger must also PASS. If neither candidate qualifies, the frozen baseline is restored as the authoritative artifact and the run terminally reports REVISE/FAIL.

## Vision-conditioned frozen-baseline refinement v3 requirements

`[CREATIVE_REFINE_V3]` requires A0-SOFT-014-EXTEND-004, the exact frozen-baseline command and HTML/CSS hashes, and the same approved upstream Product Spec/Architecture evidence. Website Business remains the commercial/creative owner.

Each isolated Candidate A/B starts from the same frozen baseline. Its initial HTML and CSS implementation agents receive the baseline mobile/tablet/desktop viewport and full-page screenshots as direct visual implementation evidence. The screenshots may condition hierarchy, spacing, cropping, responsive composition, service presentation and micro-polish only inside the approved upstream direction; they do not transfer brand strategy, positioning, claims, asset strategy or art-direction ownership into Run 014.

After an initial candidate passes deterministic source integrity, the candidate is rendered. That candidate alone then receives exactly one bounded visual-correction pass using the frozen-baseline screenshots plus its own rendered screenshots and complete source. It may not see or reuse the other candidate, prior failed candidates, or unapproved assets. The correction cannot self-approve.

After correction, source integrity is rerun. Any source-regressing correction is rejected/rolled back. Independent browser/accessibility, calibrated visual implementation QA, production, security, baseline/A/B selection and Challenger gates still apply.

Promotion remains fail-closed: a corrected candidate must reach calibrated implementation quality **>=92**, preserve source/browser/accessibility/security/fidelity, be independently judged materially `BETTER` than the frozen baseline with `agencyQuality=true`, and receive final Challenger PASS. Otherwise the frozen baseline remains authoritative.

The Capable Hands V3 qualification `WC-20260829035033-ba4169eef4` produced Candidate A 90 and Candidate B 89 with source/browser/production/security gates PASS; independent selection retained the baseline and Challenger rejected promotion. This evidence proves the capability executes but does not prove >=92 reusable premium output.

## Visual Implementation QA

The Visual Implementation QA Agent is **not an Art Director**. It may identify broken or missing images, bad crops, merged labels, contrast defects, awkward whitespace, unfinished/sparse sections, oversized empty cards, inconsistent density, broken responsive composition, navigation/interaction defects, and divergence from the approved creative handoff. It may issue surgical repair directives but may not invent a new creative concept.

## Default authority

Standing external authority is **zero**.

Run 014 may read approved inputs, reason, design implementation architecture, write code/configuration in the approved workspace, run deterministic/browser tests, create screenshots, perform visual implementation QA, perform security/dependency review, hash artifacts, prepare release notes and rollback instructions, and prepare typed handoffs.

Run 014 may **not** autonomously deploy/publish externally, promote preview to production, change domains/DNS, provision paid infrastructure, rotate secrets, contact customers, perform destructive migrations, mutate production data, or spend money.

Every external action requires a fresh bounded owner approval. Any requested/actual target mismatch fails closed.

## Release gate

A release candidate is not ready unless all applicable evidence is PASS: acceptance-criteria traceability; approved creative/design handoff; coherent artifact package; deterministic source-integrity tests; exact link/asset verification; browser mobile/tablet/desktop evidence; responsive/navigation/overflow/focus evidence; screenshot-aware visual implementation QA; contrast/creative-fidelity; security/dependency review; artifact hashes; release/rollback evidence; Challenger/QA; and clean authority accounting.

## Deployment gate

Deployment remains a separate approval-gated action. Preview evidence must never be treated as production evidence.

## Run 008 boundary

The canonical downstream operations target is `OPS-CORE-008` using `ops_handoff_v1`. Run 014 may prepare and validate the handoff but cannot claim Run 008 accepted/executed it without Run 008 evidence.

## Failure behavior

Fail closed on ambiguous scope, missing approved creative handoff for website-v2 work, baseline hash mismatch, missing acceptance criteria, stale evidence, unsupported dependencies, source-integrity failure, invented links/assets, browser failure, visual implementation failure, security failure, authority expansion, target mismatch, unknown external-action result, or cost/retry exhaustion.

Do not hide a defect by manually repairing team output outside the governed implementation/refinement loop.

## Revalidation

Reopen governance review for material architecture changes, new standing authority, breaking interfaces/schemas, repeated operational failure, security incidents, or changes expanding production/customer/cost exposure.
