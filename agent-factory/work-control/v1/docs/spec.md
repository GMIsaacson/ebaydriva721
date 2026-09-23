# Work Control v1 — Product / Software Spec

## Product goal

Give the owner one organized interface to see governed Factory runs, submit work, inspect progress/results, handle owner decisions and review history—without memorizing run IDs or manually bouncing among Notion, GitHub and infrastructure tools.

## Core rule

**Work Control is a control/read surface, not a second authority store.**

Canonical Factory governance remains authoritative. `registry.json` is a source-referenced read model. Persistent command/evidence records capture Work Control activity but cannot expand a team's external authority.

## Owner workflows

### Teams
Show canonical run identity, type, capability, readiness, live posture, authority posture and source record. Distinguish reusable teams, project runs, pilots and operations core.

### Run Team
Owner selects a runnable team and writes the desired outcome. A connected Work Control API persists a `team_assignment_v1` command with SHA-256 integrity and a zero-authority ceiling. If the API is unavailable, the UI falls back to an explicitly labeled offline draft.

### See Work
Show assignment title, team, queued/running/blocked/completed state, progress, stages, next action, evidence class and result. Persistent commands remain queued while `executorState=WAITING_WORKER`.

### Approve / Reject
Display target, environment, action ceiling, spend ceiling and production posture before an owner decision. Decisions are persistent, but v1 sets `transmitted=false` and does not permit automatic executor consumption.

### View Results
Terminal completion requires a valid executor receipt. Work Control must not synthesize successful results for queued work.

### History
Display persistent control events plus canonical bootstrap history. Offline actions remain explicitly labeled offline/local.

## Architecture

### Browser

- `index.html` — semantic owner console
- `styles.css` — responsive presentation
- `core.js` — browser/offline deterministic functions
- `api-client.js` — same-origin `/api/v1/*` client only
- `app.js` — view state, polling, submission and graceful offline fallback

### Control service

- `server.cjs` — dependency-free Node.js localhost HTTP server
- `server-core.cjs` — command hashing, registry/runnability validation, approval records, receipt authority validation
- `registry.json` — source-referenced canonical run read model
- `bootstrap-state.json` — historical bootstrap work/history only
- `runtime-data/commands/*.json` — persistent command ledger
- `runtime-data/receipts/*.json` — future governed terminal receipts
- `runtime-data/approvals/*.json` — bounded owner decision records
- `runtime-data/events.jsonl` — append-only control event history

## API

- `GET /api/v1/health`
- `GET /api/v1/state`
- `POST /api/v1/commands`
- `GET /api/v1/commands/:id`
- `POST /api/v1/approvals/:id/decision`
- `POST /api/v1/worker/approvals` — requires explicit worker token
- `POST /api/v1/worker/receipts` — requires explicit worker token

No worker token is configured for the initial internal deployment.

## Command authority model

Every UI-created command begins with:

```json
{
  "maxExternalActions": 0,
  "maxSpendCents": 0,
  "deploy": false,
  "publish": false,
  "message": false,
  "destructiveActions": false,
  "productionMutation": false
}
```

Receipt validation rejects external actions, spend or production mutation above this originating ceiling.

## Source-of-truth model

- Notion Factory Runs: canonical business/control run records.
- GitHub Factory code/contracts/evidence: canonical versioned engineering/governance evidence.
- Work Control registry: read model linking to canonical records.
- Work Control command ledger: canonical only for Work Control-submitted command/evidence events; it does not rewrite Factory governance or team authority.

## Acceptance criteria

- Full registered run catalog is visible with Run 013 absent/reserved.
- Non-runnable records cannot receive team assignments.
- Owner can submit a persistent zero-authority command when API is connected.
- API outage falls back to a local draft and never claims Factory dispatch.
- Command integrity is deterministic and tamper-detectable.
- Work status distinguishes queued/waiting-worker from actual execution.
- Owner decisions are persistent but not automatically transmitted to an executor.
- Worker routes fail closed when no worker token is configured.
- Receipts exceeding external-action, spend or production ceilings are rejected.
- Results require recorded result/receipt evidence.
- History shows persistent control events.
- Browser/server runtime uses no third-party package dependency or dynamic code execution.
- Internal server binds to localhost by default and sends restrictive browser security headers.
- Factory v0.1 recovery refs remain untouched.

## Out of scope for this release

- General-purpose LLM/team execution worker
- Automatic consumption of owner approval authority
- Public internet exposure
- Multi-user login/RBAC
- Customer-facing access
- Agent-to-agent chat
- Visual workflow builder
- Deep analytics
- Production deployment
