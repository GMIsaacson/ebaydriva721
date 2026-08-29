# Factory-wide Specialist-Gap Audit — 2026-08-29

Status: **OPEN — portfolio scan complete; remediation in progress**

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
| Run 009 — Municipal Development Intelligence / Project Radar | Present but canonical metadata incomplete | Implementation exists, but publishing/telemetry correctness does not prove municipal planning, land-use, public-record, development-stage or procurement interpretation | **BLOCKED** |
| Run 010 — Vendor Invoice Overcharge Recovery | Canonical package absent | Requires AP audit, contract/pricing analysis, procurement/vendor analysis, quantitative reconciliation and financial evidence QA | **BLOCKED_CANONICAL_PACKAGE_MISSING** |
| Run 011 — Opportunity Intelligence | Canonical package absent | Generic opportunity scoring can hide market research, competitive intelligence, finance/unit economics, strategy and domain-specialist challenge | **BLOCKED_CANONICAL_PACKAGE_MISSING** |
| Run 012 — Growth & Client Acquisition | Canonical package absent | Prospecting, qualification, diagnosis, copywriting, sales strategy, pricing/proposal and customer success are distinct professions | **BLOCKED_CANONICAL_PACKAGE_MISSING** |
| Run 014 — Software Product Engineering | Present; remediation staged | Broad Product Spec / Implementation / Challenger roles have been demoted to coordination. Explicit product, requirements, domain, architecture, data, frontend, backend, data-engineering, integration, platform/release, test, security and independent professional-quality reviewers are now modeled; user-facing UX/UI is delegated to Run 015 | **PASS_DESIGN_PENDING_REVALIDATION** |
| Run 015 — UI Excellence | Present | Canonical manifest already separates benchmarking, UX architecture, art direction, design systems, interaction design, frontend polish, responsive/accessibility, scoring and independent visual QA. A formal G2.5 matrix now maps those roles to evidence and professional acceptance criteria | **PASS_DESIGN_PENDING_G4_SHADOW** |
| Run 016 — World Technology Intelligence | Present | Hybrid topology is efficient, but four reasoning agents cannot demonstrate strong-human-professional expertise across a 20-domain taxonomy. Medicine, defense and “general technology” remain internally multi-disciplinary | **BLOCKED** |
| Alibaba→eBay Public Sourcing Intelligence | Non-canonical specialist artifacts | Role split is stronger than many teams, but canonicalization plus explicit procurement, supplier qualification, freight/logistics, marketplace economics, policy/IP and category-specialist QA are still required | **BLOCKED_CANONICAL_PACKAGE_MISSING** |
| Website Business / Kinetiq | Reference/workflow artifacts | `QUAL → DIAG → OUT → PROP → PROD → QA` is operational decomposition, not professional decomposition. Commercial diagnosis, copy, IA, UX, visual design, frontend, accessibility, performance and proposal/pricing require their own standards and review | **BLOCKED** |
| Factory Core / A0 | Present | G2.5 is wired into new RUN manufacturing on this branch. New RUN requests must carry a passing professional capability matrix; legacy teams remain explicitly pending until remediated rather than silently grandfathered | **PASS_NEW_RUN_ENFORCEMENT / LEGACY_REMEDIATION_OPEN** |

The machine-readable counterpart is `agent-factory/evidence/g2-5-portfolio-capability-matrix.json`.

## Run 014 remediation record

Run 014 now has `agent-factory/run-014/professional-capability-matrix.json` and an updated canonical manifest. The remediation deliberately does **not** claim that the old seven-role topology was professionally complete.

The compatibility roles `product-spec`, `implementation`, and `challenger-qa` remain so existing handoffs do not break, but they are no longer accepted as specialist evidence. Professional ownership is explicitly split across product management, requirements engineering, domain analysis, software/data architecture, frontend/backend/data/integration/platform engineering, test engineering, application security, release/operations readiness, and independent product/architecture/engineering quality review.

User-facing interface work is routed to **Run 015 UI Excellence** rather than duplicating UX, interaction, visual, design-system, accessibility and frontend-UI specialization inside Run 014.

A deterministic test requires:

- executable G2.5 PASS;
- zero accepted limitations;
- a concrete specialist binding for every required discipline;
- every binding to resolve to a Run 014 role or the delegated Run 015 service;
- broad compatibility coordinators not to count as specialist evidence;
- UI work to resolve to Run 015.

**Remaining Run 014 proof obligation:** one bounded non-production revalidation assignment must exercise the new specialist topology and produce the domain-specific review evidence. Historical G3/G4/G5/G6 passes predate G2.5 and are not retroactively treated as proof of professional completeness.

## Required specialist remediation still open

- **Run 004:** marketplace-demand research; procurement/sourcing; product identity/equivalence; freight/logistics; marketplace economics; category/product risk; IP/policy compliance; independent multi-discipline sourcing QA.
- **Run 006:** subscription/billing operations; invoice/charge reconciliation; contract and renewal terms; usage/entitlement analysis; commercial spend optimization; independent billing/commercial QA.
- **Run 007:** canonicalize first, then systems architecture; software engineering; security engineering; infrastructure/reliability; integration engineering; technical QA.
- **Run 008:** systems architecture; data architecture; security/privacy; reliability/recovery; workflow/integration engineering; governance/control design; independent architecture/security/reliability QA.
- **Run 009:** municipal planning/land use; public-record research; construction/development intelligence; project-stage/procurement analysis; entity/location resolution; municipal-domain QA.
- **Run 010:** canonicalize first, then AP audit; contract/pricing; procurement/vendor analysis; quantitative reconciliation; financial QA.
- **Run 011:** canonicalize first, then market research; competitive intelligence; finance/unit economics; business-model strategy; dynamically routed domain specialist challenge.
- **Run 012:** canonicalize first, then prospecting/segmentation; sales qualification; commercial diagnosis; conversion copywriting; sales strategy; pricing/proposal; customer success; discipline-specific QA.
- **Run 016:** routed/on-demand domain specialists rather than twenty permanent agents; domain-specific evidence standards and QA for AI/computing, robotics, medicine/clinical science, biotech, defense/dual use, energy, space, manufacturing/materials and other covered domains.
- **Alibaba→eBay:** canonicalize first, then marketplace demand; procurement/sourcing; supplier qualification; exact product equivalence; freight/logistics; landed economics; policy/IP; product-category expertise.
- **Website Business / Kinetiq:** separate commercial research/qualification, conversion diagnosis, information architecture, conversion copy, UX, visual design, frontend, accessibility, performance and pricing/proposal quality gates.

## No fabricated acceptance

No unresolved specialist gap in this audit has been marked `ACCEPTED_LIMITATION`. The audit contains **zero owner-accepted limitations**. A limitation must never be inferred from silence or from an older team being allowed to operate.

## Audit completion state

**OPEN.** The Factory now has a fail-closed G2.5 mechanism for new RUN construction and the first two canonical remediation mappings (Run 014 and Run 015), but the audit is not complete because:

- Run 014 still needs one real specialist-topology revalidation assignment;
- Run 015 still needs its real G4 UI shadow qualification;
- most other judgment-heavy teams still have unresolved professional specialist gaps;
- Runs 007/010/011/012 and Alibaba→eBay need canonical package reconciliation;
- promotion-time G2.5 enforcement and stale-matrix handling still need to be proven across legacy teams;
- no owner has explicitly accepted the remaining limitations.

Do not mark this audit complete until every material team/stage is `PASS` with evidence or has an explicit, deliberate `ACCEPTED_LIMITATION` with owner and rationale.
