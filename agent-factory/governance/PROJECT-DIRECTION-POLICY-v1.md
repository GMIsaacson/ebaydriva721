# Factory Project Direction Policy v1

Date: 2026-09-17

## Purpose

Project Direction makes every serious Factory project understandable and governable from the UI Hub. It answers: what is this project, why does it exist, what decision are we trying to earn, what is the next gate, what evidence exists, and what happens next?

The UI Hub card is a **view** of canonical project state. It is not a second manually maintained project brief.

## Separation of concerns

- `ui-registry-v1.json` owns interface identity, lifecycle, launch paths, deployment metadata and UI-asset lineage.
- `project-direction-registry-v1.json` owns strategic direction, gates, evidence state, freshness and decision history.
- Work Control remains the operational source for execution state. Project Direction v1 carries an explicit `Work Control (adapter pending)` source marker until automatic hydration is implemented.

## Responsibility model

| Responsibility | Accountable owner |
| --- | --- |
| Strategic coherence, phase, hypothesis, next gate, kill criteria | Agent 000 / Project Steward |
| Execution state, blockers, dependencies, next actions | Work Control |
| Hub/schema implementation | Run 014 |
| UI/UX quality | Run 015 |
| Evidence production | Specialist teams |
| Evidence and release QA | Independent Q1/Q2/Q3 QA |
| Material pivots, spending, launch/publication, kill/revive | Owner |

The owner should not become the project librarian. Routine state maintenance belongs to the Factory.

## Required strategic shape

A normalized serious project must carry:

1. **Strategy** — problem, customer, why now, North Star, business model, long-term destination.
2. **Decision** — current phase, decision being earned, hypothesis, next gate, success criteria and kill criteria.
3. **Execution** — next actions, blockers, dependencies and owner approvals.
4. **Evidence** — confidence, proven, unproven, latest result and evidence links.
5. **Freshness** — state plus last strategy/work/evidence timestamps when available.
6. **History** — material decisions, previous/new state, reason and authorization.

## Standard phase rail

`DISCOVER → VALIDATE → BUILD → PILOT → PROVE → SCALE`

A generic percentage is not a substitute for phase/gate state. When useful, a project may later add gate-level completion metrics backed by explicit criteria.

## Freshness states

- `FRESH`
- `STALE`
- `BLOCKED`
- `AWAITING_EVIDENCE`
- `NEEDS_OWNER`

## Maintenance flow

`Specialist result → evidence/receipt → QA → Work Control → Agent 000 / Project Steward → canonical Project Direction update → UI Hub`

A material strategic state change must add a history entry. Routine operational updates should flow from Work Control once the adapter is live rather than being duplicated manually.

## Progressive migration

Do not block existing UI assets simply because strategic normalization is incomplete. During migration:

- existing UI records remain valid;
- cards without Project Direction visibly show `Project Direction not yet normalized`;
- serious active projects are migrated first;
- Agent 000 / Project Steward owns the migration backlog.

Initial migration order:

1. SourceMargin
2. CI-001
3. Privacy Removal
4. Investment Intelligence
5. Autonomous Newsroom

## SourceMargin first implementation

SourceMargin is the reference implementation. Its current direction is `BUILD → PAID PILOT`; the immediate next gate is launch readiness followed by the first 10 paying pilot customers. Commercial willingness-to-pay, repeated usage, real sourcing actions and sustainable opportunity-generation economics are explicitly tracked as proof questions rather than assumed outcomes.
