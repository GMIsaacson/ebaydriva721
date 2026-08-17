# A0 Architecture Discovery Standard v1.1

## Purpose
Prevent the Agent Team Factory from building a locally correct team that is globally incomplete. Every substantial new Factory Run must first map the complete end-to-end system, identify required capabilities, define team/system boundaries, and sequence the work before G0 begins.

## Owner
Run 007 — Systems Intelligence & Development Team.

## Rule
**No substantial Factory Run may enter G0 until A0 is PASS and its B0 Run Boundary Contract is ready for approval.**

A0 is not required for trivial maintenance, isolated bug fixes, or a narrowly scoped change where upstream/downstream architecture is already approved and unchanged. The Challenger must document any exemption.

## Required A0 questions
1. **Ultimate outcome** — What complete business/operational outcome are we trying to achieve, beyond the immediate team or software component?
2. **End-to-end value chain** — What happens from first input/source through final economic or operational outcome?
3. **Required capabilities** — What human, agent, software, data, storage, governance, delivery, financial, support, and monitoring capabilities are required across the full chain?
4. **Natural boundaries** — Which capabilities belong in this Run, upstream systems, downstream teams, shared infrastructure, or owner-only governance?
5. **Dependencies** — What must already exist, be reused, or be built first for this Run to succeed?
6. **Downstream consumers** — Who/what receives this Run's output, in what contract, and what does the next stage do with it?
7. **Data architecture** — What are the canonical records, system of record, evidence/provenance rules, lifecycle states, and retention boundaries?
8. **Authority architecture** — Which actions are observe/draft/execute, which require approval, and where fail-closed boundaries sit?
9. **Scale paths** — If this succeeds, how could geography, niche, customer type, volume, channels, or product scope expand? Which expansions are explicitly not included now?
10. **Failure/operability model** — How are health, staleness, retries, unknown outcomes, cost, duplicates, and recovery handled?
11. **Build sequence** — What Runs/capabilities should be built, in what order, and why?
12. **Outcome validation** — Which assumptions require technical proof versus customer/adoption/revenue proof?
13. **Production path** — What must become true before unattended recurring operation is safe?
14. **Stop condition** — What evidence means the architecture is sufficiently understood to start G0 without pretending all future uncertainty is eliminated?

## Mandatory outputs
A0 must produce a compact **System Map Package** containing:
- Architecture ID + version;
- ultimate outcome statement;
- end-to-end value-chain map;
- capability inventory: EXISTING / REUSE / BUILD / DEFER / OWNER-ONLY;
- team/system boundary map;
- upstream and downstream handoff contracts;
- canonical data/store map;
- dependency/build-order graph;
- authority map;
- expansion map with approval gates;
- outcome/commercial assumptions and planned validation;
- production-readiness dependencies;
- top assumptions/unknowns and how later gates will test them;
- proposed Factory Run decomposition and sequence;
- draft B0 Run Boundary Contract for the next Run.

## A0 pass criteria
A0 = PASS only when all are true:
- [ ] Complete outcome is defined, not just the immediate deliverable.
- [ ] First input through final outcome is mapped.
- [ ] Required capabilities across the chain are enumerated.
- [ ] Existing/shared infrastructure has been checked before proposing duplicates.
- [ ] This Run's boundary is explicit: IN SCOPE / OUT OF SCOPE.
- [ ] At least one upstream and downstream contract is identified where applicable.
- [ ] Canonical system(s) of record are named.
- [ ] Dependencies and build order are explicit.
- [ ] Authority and approval boundaries are explicit.
- [ ] Likely scale/expansion paths are identified without auto-authorizing them.
- [ ] Technical, commercial/outcome, downstream, and production-readiness assumptions are distinguished.
- [ ] Challenger has attempted to find missing teams/capabilities and premature boundary choices.
- [ ] G0 can be stated as: "Given the approved System Map and Boundary Contract, build/validate component X."

## Fail conditions
A0 = FAIL / REWORK when any of the following is true:
- the proposed Run is being treated as the entire business without mapping what comes before/after it;
- a downstream commercialization, delivery, lifecycle, support, or data-management function is assumed but unowned;
- shared infrastructure is being duplicated without justification;
- canonical data ownership is unclear;
- expansion is implicitly delegated to the team without governance;
- the Run has no defined consumer/handoff and is not itself the final outcome;
- the team boundary is based on job titles rather than closed operational loops;
- major unknowns are hidden rather than recorded for later validation;
- technical success is being used as a proxy for business/outcome readiness;
- recurring operation is assumed without identifying P0 production controls.

## Roles
### Systems Scout
Expands the problem space, searches for missing actors, capabilities, data, dependencies, and second-order needs.

### Systems Architect
Produces the System Map Package, proposed Run decomposition, and initial Run Boundary Contract.

### Challenger & Verification Agent
Attempts to break the map: missing downstream owners, duplicated systems, unbounded authority, orphaned data, absent customer/commercial loops, scale traps, recovery gaps, and false equivalence between component readiness and system readiness.

### Factory Orchestrator
May open G0 only after A0 PASS and B0 PASS are recorded. It routes each approved component through the existing Agent Team Factory; it does not bypass gates.

## Change control
A0 does not pretend architecture is immutable. If later evidence reveals a material missing team, store, handoff, dependency, or assumption, Run 007 must issue a versioned **Architecture Amendment** and determine whether to:
- patch the current Run boundary;
- create a new downstream/upstream Run;
- update shared infrastructure;
- rerun D0/C0/P0 readiness checks; or
- pause further authority expansion until the map is corrected.

Breaking architecture changes require impact review across affected versioned contracts.

## Related Factory v2 controls
- B0 Run Boundary Contract
- dual Capability Readiness / System-Business Readiness scoring
- D0 Downstream Readiness
- C0 Commercial/Outcome Validation where applicable
- P0 Production Readiness
- R0 Retrospective → Global Patch

Canonical definitions live in `factory-v2-operating-standard.md`.

## Run 009 lesson encoded
Municipal Development Intelligence demonstrated why A0 is mandatory: the initial intelligence team was valid, but broader commercialization, multi-trade scaling, customer matching, lifecycle management, expansion management, and durable operational storage were not fully decomposed before Team 1 was built. Factory v2 would have exposed those downstream capabilities before G0, constrained Team 1 with B0, then blocked continuous operation at D0/P0 until the surrounding system existed.
