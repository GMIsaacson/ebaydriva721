# Work Control v1

Owner-facing control UI for Factory 1.

## Scope

Version 1 deliberately implements only six owner workflows:

1. Teams — see governed teams/capabilities in one organized view.
2. Run Team — stage an assignment from the UI.
3. See Work — inspect assignments, status, stages, blockers and next actions.
4. Approve / Reject — record bounded owner decisions.
5. View Results — open the latest recorded result for an assignment.
6. History — inspect the local audit trail.

## Safety boundary

This version is a local/internal control prototype. The Factory execution adapter is **not connected**.

- A Run Team submission creates a `local-draft` work request and explicitly records that Factory dispatch did not occur.
- Approve / Reject records the owner's decision locally but does not transmit authority to the Factory.
- There is no deploy, publish, customer-contact, spend, secret, production mutation or remote execution path in the v1 browser runtime.
- Factory v0.1.0 recovery refs are not modified by this application.

The intended next integration is a narrow authenticated Factory adapter that reads canonical control state and accepts governed command packets. The UI must remain a presentation/control surface, not become a second source of truth.

## Running locally

Any static HTTP server can host the directory. Example:

```bash
python3 -m http.server 8080 --directory agent-factory/work-control/v1
```

Then open `http://127.0.0.1:8080`.

No build step or package installation is required.

## Version

Work Control: `1.0.0-prototype`

Factory development line: `develop/factory-v0.2`

Frozen Factory recovery baseline remains `archive/factory-v0.1.0` at commit `37392d74728a44c3e502959c09e6400de40b846e`.
