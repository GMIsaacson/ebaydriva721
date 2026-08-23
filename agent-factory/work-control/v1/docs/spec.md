# Work Control v1 — Product / Software Spec

## Product goal

Give the owner one simple place to see governed teams, stage work, inspect progress, record bounded approval decisions, inspect results, and review history without memorizing run IDs or bouncing between infrastructure tools.

## Owner workflows

### Teams
Show recognizable team names, capability, run identity, readiness, live state, external-authority posture, and current work.

### Run Team
Owner selects a team and writes the desired outcome. In v1, submission creates a local governed request packet only. The UI must not claim dispatch while the execution adapter is disconnected.

### See Work
Show assignment title, team, status, next action, stage progression and blockers. Opening an assignment reveals stage-level evidence labels and latest result.

### Approve / Reject
Show target, environment, action count, spend ceiling and production posture before a decision. v1 decision records must set `transmitted=false` and visibly state that the Factory did not receive authority.

### View Results
Completed work exposes a concise result summary and detail. Blocked/queued work must not manufacture a completed result.

### History
Display chronological owner/control events. Browser-local actions are labeled so they cannot be confused with canonical Factory execution evidence.

## Architecture

Static, dependency-free browser application:

- `index.html` — semantic shell and owner navigation
- `styles.css` — responsive design system
- `core.js` — universal deterministic control-domain functions used by browser and Node tests
- `app.js` — presentation state, seeded control snapshot, local persistence and interaction handling
- `tests/work-control.test.cjs` — deterministic safety and feature tests

Persistence: browser `localStorage` only in v1.

Remote APIs: none.

Factory execution adapter: deliberately disconnected.

## Source-of-truth rule

Work Control must never become an independent authority store. Canonical Factory state remains in governed Factory records. A future adapter may synchronize canonical team/work/approval state into the UI and transmit explicitly authorized command packets back to the Factory.

## Acceptance criteria

- Team catalog renders current seeded governed teams and skips the reserved run number.
- Owner can stage a team request with instruction and priority.
- Disconnected execution guard fails closed and records `local-draft` instead of execution.
- Work list supports status filtering and stage-level detail.
- Approval cards expose target/environment/action/spend/production facts before decision.
- Approve/reject changes local state, writes history, and records `transmitted=false`.
- Completed work exposes recorded results; blocked work exposes blocker/next action.
- History supports search and persists local actions across refresh.
- Runtime uses no remote resources, network APIs, dynamic code execution, secrets, spend or production mutation.
- Layout remains usable on desktop and mobile.
- Factory v0.1 recovery refs remain untouched.

## Out of scope for v1

- Real Factory dispatch
- Real external approval transmission
- Authentication / multi-user permissions
- Customer access
- Agent-to-agent chat
- Workflow visual builder
- Deep analytics
- Production deployment
