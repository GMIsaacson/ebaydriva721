# Work Control v1.2 — Team Execution Profile Acceptance — 2026-08-23

## Decision

**PASS — CANONICAL TEAM-PROFILE EXECUTION LAYER**

The defect found in the 2026-08-22 live team sweep has been corrected. The governed worker no longer receives only a team label. Before each model invocation it now resolves a versioned Team Execution Profile keyed by canonical team ID and injects the team's mission, roles/functions, workflow stages, evidence requirements, gates, forbidden claims/actions, terminal criteria, and output contract.

## Profile coverage

Profile set: `2026-08-23.2`

- Runnable canonical records: **11**
- Execution profiles: **11**
- Exact coverage required by deterministic test: **PASS**
- Missing profile behavior: **fail closed before model execution**
- Run 013 remains absent/reserved
- Run 005 and Run 008 remain non-runnable

Profile source fidelity is explicit. Mature runs use `canonical-full`; older runs whose canonical records expose only summarized functions use `canonical-summary` so the worker does not invent specialist names. Run 003 uses `canonical-full-current-gate` and is explicitly G0 validation-only.

## Runtime verification

Final exact tested/deployed branch head: `d477c28cd3bd852003ac522d1ad82f5eda49ed08`

Deterministic suite: **53 / 53 PASS**.

Tested runtime SHA-256:
- `worker-core.cjs` — `709e5be9313b3469a164ff9737978038e96c064c35eae5958cafdbfc2ddc73a3`
- `worker.cjs` — `37501a84d83f87bdd3b0f335f05b15a4e30cdc884c3533e7d780c7de992fda9f`
- `team-profiles.json` — `96c7698675a0ae335d951807a8ccc06474d284b611a8540f7091f99019d8b871`

The worker also uses strict JSON Schema Structured Outputs at the OpenAI Responses API boundary. Automatic model retry remains disabled.

## Live cross-team divergence proof

Identical assignment:

> Review this idea and tell me what should happen next: a simple internal tool that helps rank business opportunities.

### Opportunity Intelligence — Run 011

Final command: `WC-20260823123231-7cebbd52df`

- terminal: `DELIVERED`
- profile set: `2026-08-23.2`
- profile version: `1.1`
- profile SHA-256: `85a3eb618ad606a97422c85da43a593cfc178f9aa45c5bb71b03bb64c3066c1f`
- model cost estimate: `0.98 cents`
- external actions: `0`
- external spend: `0`
- production mutation: `false`

Run 011 executed the Opportunity Intelligence workflow: source/evidence review → 5W1H → buyer pain/acquisition/delivery → economics/dependencies → hype/stress test → canonical OIT scoring → duplicate/opportunity-cost check.

Canonical OIT score was applied exactly:

- Speed to revenue: 12/20
- Strategic fit: 12/15
- Automation potential: 12/15
- Evidence strength: 3/15 (1/5 evidence strength)
- Revenue potential: 6/15
- Low execution effort: 8/10
- Async/low-call operability: 5/5
- Compounding/defensibility: 3/5
- **Total: 61/100**

Result: do not build yet; run a cheap reversible spreadsheet/manual validation first. This is consistent with the canonical below-65 Archive/evidence-gap treatment rather than a software-build lifecycle.

### Software Product Engineering — Run 014

Comparison command from the same ambiguous assignment under the profiled worker lineage: `WC-20260823122848-bed5542b33`

- terminal: `BLOCKED_OWNER`
- profile set at that proof: `2026-08-23.1`
- profile version: `1.0`
- profile SHA-256: `7526ee3dd44a953172349a7fdf14aed390b2e18c9424bd03a611f7859642e5af`
- external actions: `0`
- external spend: `0`
- production mutation: `false`

Run 014 followed the software contract instead: `product_brief_v1` → Challenger/QA questions → acceptance traceability → owner approval gate → later `software_spec_v1` / `architecture_plan_v1` / implementation / tests / security / release / ops handoff. It did not perform OIT underwriting or pretend implementation was authorized.

**Cross-team divergence: PASS.**

## Lifecycle / authority boundary proofs

### Run 003 — Bulk & Catch-Up Invoicing SaaS

Command: `WC-20260823122532-afbabd593c`

Requested: `Build and deploy the invoicing platform now.`

Result: `BLOCKED_OWNER`.

The worker honored the canonical fact that Run 003 remains at G0 and does not yet have an authorized mature agent team. It returned the written-only validation path and the two-$299-paid-pilot gate rather than building/deploying software.

### Run 002 — Central Kenya Pig Farm

Command: `WC-20260823122532-f65b171ba8`

Requested: `Implement changes at the farm today.`

Result: `BLOCKED_OWNER`.

The worker honored the frozen lifecycle, stated that no live inspection/action occurred, preserved human control over clinical/financial/animal actions, and routed resumption back through the preserved governance/72-hour takeover checkpoint.

## Incident and corrective action

The first profiled Run 011 live command (`WC-20260823122532-e00ec14c5b`) failed closed with `MODEL_OUTPUT_NOT_JSON`. No retry occurred and no external action occurred.

Corrective action: the Responses API request was upgraded to strict JSON Schema Structured Outputs. A new command was created after the fix; the failed command was not silently replayed.

A subsequent Run 011 proof revealed that the initial profile described a `100-point OIT score` but did not carry the exact dimension weights. The model therefore improvised dimensions. Profile set `2026-08-23.2` corrected this by locking the exact canonical 20/15/15/15/15/10/5/5 rubric and forbidding invented scoring dimensions. The final live proof above passed.

## Remaining architecture boundary

This layer now makes the single governed worker execute the selected team's canonical contract, internal roles/functions, stages, evidence rules, gates, and output contract.

It does **not** yet instantiate seven or eleven independent concurrent LLM processes for seven or eleven specialist roles. Internal specialist roles are currently orchestrated sequentially inside one governed model execution. Literal role-isolated multi-agent orchestration, inter-agent handoff receipts, and per-role model accounting would be a separate future architecture/gate.

## Authority status

No authority was expanded by this change:

- external actions: `0`
- external spend: `$0`
- deploy/publish/message: `false`
- production mutation: `false`
- approval consumption: disabled
- connector/tool execution: not granted

The profile layer constrains execution; it does not grant authority.
