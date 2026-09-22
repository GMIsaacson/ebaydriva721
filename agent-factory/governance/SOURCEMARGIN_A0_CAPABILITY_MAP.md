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
| Freight/import/landed-cost professional judgment | SPC-FREIGHT-001 | REUSE — QUALIFIED | QUALIFIED after 5/5 passing cases, 5/5 Q2 PASS, 2 quote-backed reconciliations, independent portfolio Q3 `PE_PASS`, and final Q2 qualification audit PASS. Evidence-complete professional certification is allowed; production mutation/publication remains separately denied. |
| Marketplace policy/IP judgment | SPC-IP-001 | REUSE — QUALIFIED | QUALIFIED after 5/5 author cases, 5/5 Q2 PASS, independent reviewer calibration, portfolio Q3 `PE_PASS`, and final Q2 promotion audit. Marketplace-policy/IP certification is bounded and is not legal advice or platform/account authority. |
| Product/category specification judgment | Candidate PCM → job-specific qualified specialist | CONDITIONAL / FAIL-CLOSED | No universal category expert. Explicit generic/simple candidates with no material technical/regulatory risk may omit this discipline; compatibility, fitment, electronics, safety, regulated, medical/health, material-performance, structural, branded-equivalence and similar cases require a bound qualified specialist + independent reviewer. Unknown complexity defaults to required. |
| Freight/import independent Q3 | SPC-FREIGHT-Q3-001 + Professional Capability framework | REUSE — QUALIFIED | Reviewer-only specialist is QUALIFIED; final SPC-FREIGHT-001 portfolio review returned `PE_PASS` and the independent Q2 qualification audit accepted the outcome. |
| Marketplace Policy/IP independent Q3 | SPC-IP-Q3-001 + Professional Capability framework | REUSE — QUALIFIED | Reviewer-only specialist is QUALIFIED after 3/3 preregistered reviewer gold cases; final SPC-IP-001 portfolio review returned `PE_PASS` and final Q2 accepted promotion evidence as COMPLETE. |
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

Run 004 is no longer globally blocked by freight or Marketplace Policy/IP capability gaps: `SPC-FREIGHT-001` and `SPC-IP-001` are QUALIFIED with independent `PE_PASS` reviews. Product/category expertise is now candidate-gated through the SourceMargin PCM router rather than treated as a permanent global missing role. Complex candidates fail closed until a job-specific qualified specialist and independent reviewer are bound; explicit low-risk generic/simple candidates may proceed without inventing a universal category expert.

Therefore:
- research, discovery, evidence collection, demand validation, supplier search and deterministic economics may continue within their allowed/provisional scopes;
- freight/import professional certification may now be issued only when the case-specific required evidence is complete;
- Marketplace Policy/IP certification may now be issued only against current platform evidence and candidate facts, with legal advice and platform/account actions explicitly out of scope;
- each candidate receives a professional-capability manifest. Material category/specification risk requires a bound qualified job-specific specialist and reviewer; missing expertise blocks that candidate only;
- no unsupported “profitable”, “BUY-ready”, or equivalent commercial readiness claim may bypass a candidate's required professional disciplines.

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
