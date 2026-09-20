# SourceMargin → Factory 1 A0 Capability Map

_Date: 2026-09-19_  
_Project: SourceMargin / milestone M-004_  
_A0 decision: `A0-SOURCEMARGIN-STATE-001`_

## Result

SourceMargin remains inside Factory 1. No SourceMargin mini-factory, new director, duplicate task system, or duplicate project database is authorized.

The governing pattern is:

`Agent 000 → Work Control → existing Factory capability / SourceMargin project asset → evidence → Q1/Q2/Q3 as applicable → Work Control → Agent 000`

Supabase remains the SourceMargin live operational research truth. GitHub remains the durable methodology/decision/checkpoint record. Work Control owns execution state. Agent 000 owns strategic coordination.

## A0 responsibility map

| SourceMargin responsibility | Existing owner/capability | A0 disposition | Notes |
|---|---|---|---|
| Project direction / current mission | Agent 000 | REUSE | No SourceMargin director may be created. |
| Work assignment, owner, next action, lifecycle | Work Control | REUSE | One accountable owner and one explicit next action. |
| Marketplace research ownership | Run 004 — DataScout Source-to-Marketplace | REUSE | Existing Factory owner for source-to-marketplace work. |
| eBay crawler / census project execution | Run 004 + SourceMargin census/coverage assets | REUSE/EXTEND implementation only | Do not create a crawler team. Extend the existing project execution path when software work is required. |
| Recent-demand validation | SPC-ECOM-001 + AGT-RESEARCH-VALIDATION-001 | REUSE | Specialist is PROVISIONAL; Q2 evidence verification remains separate. |
| Supplier search/comparison | SPC-SOURCE-001 | REUSE | PROVISIONAL; may not absorb freight/import or IP/policy judgment. |
| Unit economics | SPC-ECON-001 + SW-DS-ECONOMICS-001 | REUSE | Deterministic software must not guess missing inputs. |
| Evidence/provenance QA | SPC-EVID-001 | REUSE | QUALIFIED Q2 reviewer. |
| Deterministic/test QA | SPC-QA-001 | REUSE | QUALIFIED Q1 reviewer. |
| Retry/dead-letter/cancellation/recovery primitives | Run 008 Operations Core | REUSE | No separate operations/state-control service. |
| SourceMargin current-state reconciliation | Run 004 using Run 008/Work Control patterns | EXTEND | Genuine gap: reconcile Supabase + Work Control + GitHub into one typed state receipt; fail closed on drift. |
| Freight/import/landed-cost professional judgment | SPC-FREIGHT-001 | EXTEND/QUALIFY existing capability | Currently UNPROVEN. No profitable/BUY-ready claim may depend on it until qualified. |
| Marketplace policy/IP judgment | SPC-IP-001 | EXTEND/QUALIFY existing capability | Currently UNPROVEN. |
| Product/category specification judgment | Job-specific qualified specialist | BLOCKED until bound | Do not create a generic universal category expert. Bind only when material. |
| Independent commercial/professional Q3 | Professional Capability framework | EXTEND/CALIBRATE | Run 004 Q3 is currently missing. Sample-ready may remain an evidence/research state; profitable/BUY-ready promotion must fail closed without required Q3. |
| Software/UI changes to SourceMargin | Run 014 / Run 015 | REUSE when needed | These are shared production capabilities, not permanent SourceMargin subteams. |

## Genuine extension: State Reconciliation

The reconciler is not a new source of truth and is not allowed to make strategy.

Required read set:
1. SourceMargin Supabase operational state: research ledger, demand snapshots, supplier/evaluation state, coverage map, audit actions.
2. Work Control execution state: active work order, owner, lifecycle, blockers, next action.
3. SourceMargin GitHub durable record: current checkpoint, decisions, methodology, census rules.

Required output: one typed state receipt containing at minimum:
- project / milestone identity;
- current phase;
- active work order;
- accountable owner;
- explicit next action;
- current Stage-2 checkpoint;
- census coverage status;
- blockers;
- last material decision;
- data freshness timestamps;
- source references;
- reconciliation status: CONSISTENT / STALE / CONFLICT;
- conflicts requiring owner or Agent 000 resolution.

Fail-closed rules:
- conflict between systems => no inferred resolution;
- missing freshness => STALE;
- missing owner or next action => BLOCKED;
- no automatic changes to North Star, hypothesis, gates, kill criteria, external authority, spend, purchase, outreach, or publication permissions.

## Professional-readiness constraint

Canonical Factory retrofit currently marks Run 004 as professionally BLOCKED because freight/import, marketplace policy/IP and category-professional review are unproven and independent commercial Q3 is missing.

Therefore:
- research, discovery, evidence collection, demand validation, supplier search and deterministic economics may continue within their allowed/provisional scopes;
- no unsupported “profitable”, “BUY-ready”, or equivalent commercial readiness claim may be promoted until the gating professional capabilities and Q3 are satisfied.

## Immediate Work Control handoff

**Owner:** Agent 000  
**Current next action:** implement the read-only SourceMargin state-reconciliation extension under Run 004, consuming existing SourceMargin records and emitting the typed receipt above.  
**After that:** resume Stage 2 from the persisted SourceMargin state rather than chat history.


## Completion enforcement

A0 decision `A0-SOURCEMARGIN-COMPLETION-001` extends Run 004 with deterministic software `SW-DS-COMPLETION-GUARD-001`.

For every material SourceMargin work order:

`worker result → required writebacks → state reconciliation → required Q1/Q2 → completion guard → Work Control completion eligibility`

The only successful terminal completion receipt is `DONE`. Any missing writeback, non-`CONSISTENT` reconciliation result, or missing required Q1/Q2 PASS receipt yields `BLOCKED_WRITEBACK`.

Agent 000 remains accountable but cannot substitute judgment for a failed guard receipt. The guard does not own project state; it only verifies that the existing owners produced the required durable receipts.
