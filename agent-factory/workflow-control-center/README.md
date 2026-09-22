# Factory n8n Operations Control Plane

This directory is the canonical, version-controlled source for the Factory workflow-control service and its lifecycle action service.

## Responsibility boundary

Factory Control is the operator surface. n8n remains the private workflow execution engine and advanced editor.

The control plane may:
- read workflow and execution metadata from the n8n PostgreSQL database;
- expose managed-workflow health, schedules, dependency inventory, execution history, node execution state, and redacted errors;
- invoke owner-gated lifecycle actions through the action service.

It must not:
- write directly to n8n database tables;
- expose n8n port 5678 publicly;
- expose raw node inputs/outputs in the public diagnostic surface;
- claim a recovery action is available until a supported, tested adapter exists.

## v7 capability contract

Implemented:
- pause / resume / re-register managed workflows;
- paginated execution ledger for the managed Factory scope;
- execution inspector with node-by-node state and timing;
- redacted workflow/node error evidence;
- shared dependency inventory;
- workflow troubleshooting classification.

Explicitly not yet implemented:
- generic Run now;
- retry a historical execution;
- active dependency test;
- OAuth/API credential reconnect from Factory Control.

Those actions are advertised as unavailable so the UI cannot imply capabilities the backend does not safely support.

## Services

- `server.js`: workflow-control service (port 8790).
- `action-service/action_service.py`: owner-gated lifecycle action worker (port 8791).
- n8n and PostgreSQL stay on the private Docker network.

## Rollout rule

Deploy a new image beside the live image, validate health and read-only APIs first, then switch traffic. Keep the prior image available for immediate rollback.
