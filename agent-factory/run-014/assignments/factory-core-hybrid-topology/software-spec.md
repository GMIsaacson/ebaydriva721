# Software specification

## Contract change

Factory Core moves from version `1.1.0` to `1.2.0` and adds `topologyMode`.

- `legacy-agent-team`: backward-compatible default.
- `hybrid`: explicit mixed-mechanism compilation.

Hybrid component types are `software`, `workflow`, `agent`, `decision-support`, `data-store`, `service`, and `human-gate`. Roles are `orchestrator`, `capability`, `assurance`, and `approval`.

Hybrid manifests include `components`, the actual-agent subset in `agents`, and explicit typed `handoffs`. Receipts include `componentCount` and `agentCount`. Contracts expose `topologyMode` and the component types in use.

## Fail-closed rules

- no implicit component type in hybrid mode;
- exactly one orchestrator;
- at least one assurance component marked independent;
- no self-approval;
- no unknown, duplicate, or self-routed handoff;
- every non-orchestrator has an incoming handoff;
- every component is reachable from the orchestrator;
- no handoff cycle in this compiler version;
- no generic-runtime execution claim for a hybrid team.

The existing authority lock remains unchanged: no external action, deployment, publishing, messaging, spending, purchasing, or deletion is authorized.

