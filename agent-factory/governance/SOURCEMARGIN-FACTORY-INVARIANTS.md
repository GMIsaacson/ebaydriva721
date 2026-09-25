# SourceMargin Factory Governance Invariants

Decision: A0-SOURCEMARGIN-FACTORY-GOVERNANCE-001  
Date: 2026-09-25  
Treatment: EXTEND existing Factory Work Control.

## Canonical execution invariant

For RUN-004 / Amazon SourceMargin production research, a specialist result may reach canonical persistence only when all of the following are true:

1. The receipt carries a syntactically valid Work Control command ID.
2. The command currently exists in the canonical Work Control ledger.
3. The command belongs to RUN-004.
4. The command has an active atomic worker claim.
5. The receipt contract/stage matches the command's specialist marker.
6. Receipt run ID and leaf ID match the governed command target.
7. Only after those checks pass may the persistence gateway call the SourceMargin persistence endpoint.

Manual, exploratory, or debug research that lacks this chain is non-canonical and must not be promoted as production state.

For the legacy eBay SourceMargin state machine, the corresponding invariant is now:

1. New work items may enter only at `OBSERVED`.
2. Demand-observation ingestion records evidence but no longer promotes canonical state by itself.
3. `advance_source_margin_item()` rejects every call unless a Factory authorization context is present.
4. Direct `current_state` updates require both state-machine authorization and Factory authorization.
5. The only external governed transition bridge is `ebay-source-margin-transition`.
6. That bridge validates the shared Factory bridge token, a live Work Control command, RUN-004 ownership, an active atomic claim, the `[EBAY_SOURCE_MARGIN_TRANSITION_V1]` marker, work-item identity, and requested target state.
7. The database transition records the Work Control command ID and rejects successful command replay through the unique Factory transition audit ledger.

## Authority separation

- Agent 000 / Factory coordination decides and releases governed work.
- Work Control owns command, claim, receipt, and execution state.
- Specialist workers produce evidence and proposed results.
- The Work Control persistence gateway is the canonical write boundary for the RUN-004 Amazon specialist chain.
- Supabase persistence routines remain service-role-only; browser/ordinary authenticated users cannot invoke them directly.
- Service-role access alone is no longer sufficient to advance the legacy eBay state machine: the secure transition requires the Factory bridge token and a Work Control command ID.
- Demand ingestion is evidence-only with respect to canonical state; promotion is a separate Factory-governed operation.

## Adversarial acceptance evidence — 2026-09-25

### Nonexistent command
Input command: `WC-20260925123456-deadbeef00`

Expected: reject before persistence.  
Observed: HTTP 503, `CANONICAL_STAGE_PERSISTENCE_FAILED`, stage `FACTORY_GOVERNANCE`, upstream command status 404.

Follow-up database scan across SourceMargin/Amazon tables containing `command_id`: zero rows for the fake command.

### Completed command replay
Input command: `WC-20260924213836-88a29a1c1d`

Expected: reject because its claim is already completed and therefore is not an active authorization.  
Observed: HTTP 503, `CANONICAL_STAGE_PERSISTENCE_FAILED`, stage `FACTORY_GOVERNANCE`.

### Legacy eBay adversarial tests

A representative existing work item remained in `QUOTE_NEEDED` while the following attacks were attempted:

- direct `advance_source_margin_item()` call → `FACTORY_AUTHORIZATION_REQUIRED`
- direct `current_state='SAMPLE_READY'` update → `DIRECT_STATE_WRITE_DENIED`
- direct new work-item insert at `SAMPLE_READY` → `DIRECT_INITIAL_STATE_DENIED`
- legacy `request_source_margin_transition()` wrapper → denied with `FACTORY_AUTHORIZATION_REQUIRED`
- secure Factory RPC with a false bridge token → `FACTORY_TOKEN_INVALID`
- public Edge Function call without the Factory bridge token → HTTP 401 `UNAUTHORIZED`

The tested work item state did not change.

## UI observability

The Factory Control cockpit reads the canonical Work Control ledger and refreshes every 3 seconds. It shows:

- Work Control command ID
- process / specialist marker
- team or run
- current status
- progress
- current/latest stage and detail
- start time
- SourceMargin-specific recent activity

This is an observability surface only; it is not a second execution authority.

## Certification status

The previously identified legacy eBay bypass boundary is now closed. The current Amazon specialist persistence chain and the legacy eBay canonical transition chain both require Factory-controlled authorization before canonical promotion.

This clears the specific governance blocker identified before the untouched-leaf certification run. Certification should still attempt adversarial bypasses during the run; no architecture claim should depend only on static inspection.
