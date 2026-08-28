# Factory Core

Factory Core compiles governed team packages without granting deployment, publishing, messaging, spending, destructive-action, or production-mutation authority.

## Topology modes

`legacy-agent-team` is the backward-compatible default for existing requests. It creates a lead agent, one agent per capability, and an independent QA agent.

`hybrid` is required for new mixed-mechanism systems. Every component must be classified explicitly as one of:

- `software`
- `workflow`
- `agent`
- `decision-support`
- `data-store`
- `service`
- `human-gate`

A hybrid request must declare exactly one orchestrator, at least one independent assurance component, and explicit typed handoffs. Every component must be reachable from the orchestrator and the handoff graph must be acyclic.

Factory Core does not silently convert hybrid components into agents. The generic team runner remains a synthetic legacy validator and fails closed on hybrid manifests. Every hybrid team must provide and qualify its own run-specific runtime.

## Example

```json
{
  "topologyMode": "hybrid",
  "capabilities": [
    {"id":"control","name":"Pipeline Control","componentType":"workflow","role":"orchestrator"},
    {"id":"collect","name":"Source Collector","componentType":"software","role":"capability"},
    {"id":"analyze","name":"Technology Analyst","componentType":"agent","role":"capability"},
    {"id":"qa","name":"Independent Evidence QA","componentType":"decision-support","role":"assurance","independentAssurance":true}
  ],
  "handoffs": [
    {"from":"control","to":"collect","contract":"source_request_v1"},
    {"from":"collect","to":"analyze","contract":"verified_evidence_pack_v1"},
    {"from":"analyze","to":"qa","contract":"candidate_brief_v1"}
  ]
}
```

