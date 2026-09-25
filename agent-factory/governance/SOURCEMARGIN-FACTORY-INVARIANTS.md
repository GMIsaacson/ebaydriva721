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

## Authority separation

- Agent 000 / Factory coordination decides and releases governed work.
- Work Control owns command, claim, receipt, and execution state.
- Specialist workers produce evidence and proposed results.
- The Work Control persistence gateway is the canonical write boundary for the RUN-004 Amazon specialist chain.
- Supabase persistence routines remain service-role-only; browser/ordinary authenticated users cannot invoke them directly.

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

## Residual scope

This invariant covers the current RUN-004 Amazon specialist receipt/persistence chain. Legacy eBay state transition routines remain service-role-gated and state-machine-gated, but should be separately bound to a Work Control authorization record before claiming universal SourceMargin enforcement across every legacy execution path.
