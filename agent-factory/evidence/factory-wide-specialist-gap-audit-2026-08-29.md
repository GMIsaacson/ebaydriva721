# Factory-wide Specialist-Gap Audit — 2026-08-29

Status: **OPEN**

## Acceptance rule

A workflow stage is not professionally complete merely because an agent is assigned. Every material stage must identify the professional disciplines required, the specialists covering them, explicit evidence standards, and independent discipline-specific QA capable of rejecting work below a strong human professional standard. A remaining gap may pass only when the business owner explicitly accepts and documents the limitation.

## Failure modes

1. Workflow completeness mistaken for professional capability completeness.
2. Generic agents assigned work spanning materially distinct specialist disciplines.
3. QA validates correctness/compliance but not expert-grade professional quality.

## First-wave audit

| Team | Stage / surface | Specialist gaps | QA gap | G2.5 disposition |
|---|---|---|---|---|
| Run 014 — Software Product Engineering | Product definition | Product management, requirements engineering, domain analysis | Correctness tests do not establish product-quality judgment | BLOCKED |
| Run 014 — Software Product Engineering | UX / UI | UX architecture, interaction design, visual design, accessibility | Engineering QA cannot substitute for design QA | BLOCKED |
| Run 014 — Software Product Engineering | Implementation | Frontend, backend, data, integration, DevOps/release as applicable | Tests/security review do not prove senior engineering quality across every applicable discipline | BLOCKED |
| Run 015 — UI Excellence | UI transformation | UX architecture, interaction design, visual design, responsive design, typography, accessibility | Requires independent design-excellence review, not only functional/browser verification | BLOCKED |
| Website Business / Kinetiq | Qualification & diagnosis | Market/customer research, conversion strategy, domain-specific business diagnosis | Evidence correctness is insufficient to prove commercial-quality diagnosis | BLOCKED |
| Website Business / Kinetiq | Copy & offer | Conversion copywriting, information architecture, offer strategy | Needs copy/strategy excellence review | BLOCKED |
| Website Business / Kinetiq | Website production | UX, visual design, content design, frontend implementation, accessibility, performance | Generic production QA is insufficient | BLOCKED |

## Required remediation pattern

Each blocked stage must receive a `professionalCapabilities` record with:

- `stageId` and concrete `workProduct`;
- `requiredDisciplines`;
- `assignedSpecialists` covering every required discipline;
- explicit `evidenceStandards`;
- independent QA with `type = professional_excellence` or `dual`;
- QA disciplines covering the stage disciplines;
- professional acceptance criteria;
- or a documented `ACCEPTED_LIMITATION` with owner and rationale.

## Factory Core change

`agent-factory/core/professional-capability-gate.cjs` implements G2.5 fail-closed evaluation. Missing matrices, missing specialist coverage, missing evidence standards, correctness-only QA, non-independent QA, and QA discipline gaps block the gate. Explicit owner-accepted limitations remain visible and count separately from true professional completeness.

## Audit completion state

**OPEN.** First-wave teams are assessed, but the audit is not complete until every registered Factory team is evaluated and every material gap is either filled or explicitly accepted as a limitation.
