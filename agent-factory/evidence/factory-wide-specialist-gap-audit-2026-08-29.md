# Factory-wide Specialist-Gap Audit — 2026-08-29

Status: **OPEN — portfolio scan complete; remediation and enforcement remain incomplete**

## Acceptance rule

A workflow stage is not professionally complete merely because an agent is assigned. Every material judgment-heavy stage must identify the professional disciplines required, the specialists covering them, explicit evidence standards, and independent discipline-specific QA capable of rejecting work below a strong human professional standard. A remaining gap may pass only when the business owner explicitly accepts and documents the limitation.

Correctness/compliance QA and professional-excellence QA are separate gates. Deterministic execution-only stages do not need artificial professional roles, but the moment a stage authors, interprets, recommends, diagnoses, designs, prices, audits, or otherwise exercises material professional judgment, G2.5 applies.

## Failure modes

1. Workflow completeness mistaken for professional capability completeness.
2. Generic agents assigned work spanning materially distinct specialist disciplines.
3. QA validates correctness/compliance but not expert-grade professional quality.

## Repository reconciliation finding

The canonical `agent-factory/` tree on this branch contains run packages for **004, 005, 006, 008, 009, 014, 015 and 016**. It does **not** contain canonical `run-007`, `run-010`, `run-011` or `run-012` packages, despite those teams appearing in Factory history/registry artifacts. Alibaba→eBay specialist-team artifacts also exist outside this canonical run tree rather than as a reconciled canonical Factory package.

This is itself a Factory defect: registry/history presence must not be treated as canonical capability evidence. Runs 007/010/011/012 and Alibaba→eBay therefore fail closed as `BLOCKED_CANONICAL_PACKAGE_MISSING` until reconciled.

## Portfolio audit

| Team / surface | Canonical state | Professional capability finding | G2.5 disposition |
|---|---|---|---|
| Run 004 — DataScout Source-to-Marketplace | Present | Deterministic economics/evidence controls are strong, but marketplace demand, procurement/sourcing, exact product equivalence, freight/logistics, marketplace economics, category risk and IP/policy judgment are not proven as independent senior disciplines | **BLOCKED** |
| Run 005 — Controlled Notification Pilot | Present | Fixed owner-approved self-email, zero AI, no authored professional judgment | **PASS_NOT_APPLICABLE** |
| Run 006 — Subscription Operations | Present | Evidence Discovery, Reconciliation, Renewal/Spend Watcher and generic QA do not prove billing-ops, charge reconciliation, contract/renewal, entitlement/usage and spend-optimization expertise | **BLOCKED** |
| Run 007 — Systems Intelligence & Development | Canonical package absent | Broad label spans systems architecture, software, security, infrastructure/reliability, integration and technical QA; no canonical package exists to establish coverage | **BLOCKED_CANONICAL_PACKAGE_MISSING** |
| Run 008 — Operations Core | Present | Source identity, provenance, approvals, notifications, health, cost, retention, recovery and dependency management span systems/data architecture, security/privacy, SRE and governance; current criteria are primarily structural/operational | **BLOCKED** |
| Run 009 — Municipal Development Intelligence / Project Radar | Present but canonical metadata incomplete | Implementation exists, but no top-level canonical team README/capability contract was found. Publishing/telemetry correctness does not prove municipal planning, land-use, public-record, development-stage or procurement interpretation | **BLOCKED** |
| Run 010 — Vendor Invoice Overcharge Recovery | Canonical package absent | Requires AP audit, contract/pricing analysis, procurement/vendor analysis, quantitative reconciliation and financial evidence QA | **BLOCKED_CANONICAL_PACKAGE_MISSING** |
| Run 011 — Opportunity Intelligence | Canonical package absent | Generic opportunity scoring can hide market research, competitive intelligence, finance/unit economics, strategy and domain-specialist challenge | **BLOCKED_CANONICAL_PACKAGE_MISSING** |
| Run 012 — Growth & Client Acquisition | Canonical package absent | Prospecting, qualification, diagnosis, copywriting, sales strategy, pricing/proposal and customer success are distinct professions | **BLOCKED_CANONICAL_PACKAGE_MISSING** |
| Run 014 — Software Product Engineering | Present | Seven-role workflow is operationally complete but Product Spec, Implementation and Challenger/QA are too broad to prove senior product, requirements, frontend, backend, data, integration, testing, security, release and applicable accessibility competence | **BLOCKED** |
| Run 015 — UI Excellence | Present | Team explicitly combines benchmarking, UX architecture, art direction, design systems, interaction design, frontend polish, responsive/accessibility review, scoring and visual QA. A UIX score does not itself prove independent senior coverage of those disciplines | **BLOCKED** |
| Run 016 — World Technology Intelligence | Present | Hybrid topology is efficient, but four reasoning agents cannot demonstrate strong-human-professional expertise across a 20-domain taxonomy. Medicine, defense and “general technology” remain internally multi-disciplinary | **BLOCKED** |
| Alibaba→eBay Public Sourcing Intelligence | Non-canonical specialist artifacts | Role split is stronger than many teams, but canonicalization plus explicit procurement, supplier qualification, freight/logistics, marketplace economics, policy/IP and category-specialist QA are still required | **BLOCKED_CANONICAL_PACKAGE_MISSING** |
| Website Business / Kinetiq | Reference/workflow artifacts | `QUAL → DIAG → OUT → PROP → PROD → QA` is operational decomposition, not professional decomposition. Commercial diagnosis, copy, IA, UX, visual design, frontend, accessibility, performance and proposal/pricing require their own standards and review | **BLOCKED** |
| Factory Core / A0 | Present | **Systemic blocker:** the G2.5 evaluator exists on this branch, but `team-builder.cjs` still lists A0/B0/G0/G1/G2/G3 and does not invoke G2.5. The new professional gate is therefore not yet mandatory and can be bypassed | **BLOCKED_SYSTEMIC** |

The machine-readable counterpart is `agent-factory/evidence/g2-5-portfolio-capability-matrix.json`.

## Required specialist remediation by team

- **Run 004:** marketplace-demand research; procurement/sourcing; product identity/equivalence; freight/logistics; marketplace economics; category/product risk; IP/policy compliance; independent multi-discipline sourcing QA.
- **Run 006:** subscription/billing operations; invoice/charge reconciliation; contract and renewal terms; usage/entitlement analysis; commercial spend optimization; independent billing/commercial QA.
- **Run 007:** canonicalize first, then systems architecture; software engineering; security engineering; infrastructure/reliability; integration engineering; technical QA.
- **Run 008:** systems architecture; data architecture; security/privacy; reliability/recovery; workflow/integration engineering; governance/control design; independent architecture/security/reliability QA.
- **Run 009:** municipal planning/land use; public-record research; construction/development intelligence; project-stage/procurement analysis; entity/location resolution; municipal-domain QA.
- **Run 010:** canonicalize first, then AP audit; contract/pricing; procurement/vendor analysis; quantitative reconciliation; financial QA.
- **Run 011:** canonicalize first, then market research; competitive intelligence; finance/unit economics; business-model strategy; dynamically routed domain specialist challenge.
- **Run 012:** canonicalize first, then prospecting/segmentation; sales qualification; commercial diagnosis; conversion copywriting; sales strategy; pricing/proposal; customer success; discipline-specific QA.
- **Run 014:** product management; requirements engineering; architecture; frontend/backend/data/integration engineering as applicable; test engineering; security; DevOps/release; accessibility when a UI exists; discipline-routed engineering/design QA.
- **Run 015:** UX architecture; interaction design; visual design/art direction; design systems; typography; responsive design; accessibility; frontend UI implementation; independent UX/visual/accessibility excellence QA.
- **Run 016:** routed/on-demand domain specialists rather than twenty permanent agents; domain-specific evidence standards and QA for AI/computing, robotics, medicine/clinical science, biotech, defense/dual use, energy, space, manufacturing/materials and other covered domains.
- **Alibaba→eBay:** canonicalize first, then marketplace demand; procurement/sourcing; supplier qualification; exact product equivalence; freight/logistics; landed economics; policy/IP; product-category expertise.
- **Website Business / Kinetiq:** separate commercial research/qualification, conversion diagnosis, information architecture, conversion copy, UX, visual design, frontend, accessibility, performance and pricing/proposal quality gates.

## No fabricated acceptance

No unresolved specialist gap in this audit has been marked `ACCEPTED_LIMITATION`. The audit contains **zero owner-accepted limitations** because no corresponding explicit owner acceptance record was found or created. A limitation must never be inferred from silence or from an older team being allowed to operate.

## Factory Core enforcement blocker

`agent-factory/core/professional-capability-gate.cjs` implements the evaluator, but the current Factory compiler does not yet call it. Therefore this PR must not claim that G2.5 is enforced Factory-wide until the builder/promotion path is wired fail-closed and tests prove a professionally incomplete RUN request cannot be manufactured or promoted.

Required integration:

1. `team-builder.cjs` imports the G2.5 assertion/evaluator.
2. RUN-mode team requests carry a professional capability matrix.
3. G2.5 executes after structural design and before G3 eligibility.
4. The manifest records `G2.5` and its result; contracts/receipts expose the professional-capability status.
5. Missing or blocked G2.5 prevents a new RUN build from being represented as G3-eligible.
6. Existing legacy teams remain explicitly `G2.5_PENDING` until audited/remediated; they are not silently grandfathered.
7. Promotion logic must fail closed if G2.5 is missing, blocked, or stale.

## Audit completion state

**OPEN.** The portfolio scan is now broad enough to expose the Factory-wide pattern, including canonical-package drift. The work is not complete because:

- G2.5 is not yet mandatory in Factory Core;
- most judgment-heavy teams still have unresolved professional specialist gaps;
- Runs 007/010/011/012 and Alibaba→eBay need canonical package reconciliation;
- no owner has explicitly accepted the remaining limitations;
- remediated team matrices and discipline-specific QA evidence have not yet been proven in shadow work.

Do not mark this audit complete until every material team/stage is `PASS` or has an explicit, deliberate `ACCEPTED_LIMITATION` with owner and rationale.
