# Run 011 — Adversarial Opportunity Gate v1

Effective 2026-09-03, the canonical opportunity-promotion policy adds a fail-closed adversarial gate on top of the existing 100-point OIT rubric.

The aggregate OIT score remains a comparison instrument. It is not sufficient evidence that an opportunity is commercially valid.

## Promotion sequence

1. C0 Candidate
2. C1 Fatal-flaw scan
3. C2 Evidence / input reality
4. C3 Economic reality
5. C4 Buyer reality
6. C5 Acquisition reality
7. C6 Competitive reality
8. C7 Factory advantage
9. C8 Tiny live validation
10. C9 Promotion eligibility

## Evidence states

Every critical assumption is classified as one of:

- `P` — Proven by current attributable evidence.
- `I` — Inferred from evidence but not directly demonstrated.
- `A` — Assumed and unverified.
- `U` — Unknown.

A critical assumption marked `P` must carry an evidence reference. An existential `A` or `U` cannot support `ADVANCE`.

## Weakest-link rule

The gate scores seven existential dimensions from 0–100:

- evidence / input reality
- economic reality
- buyer reality
- acquisition reality
- competitive reality
- Factory advantage
- tiny-test readiness

`Weakest-Link Score = minimum(existential dimension scores)`.

Any Weakest-Link Score below `60` blocks `ADVANCE`, regardless of the canonical aggregate OIT score.

## Terminal decision

The adversarial layer returns exactly one decision:

- `KILL` → conservative route ceiling `Archive`
- `HOLD` → conservative route ceiling `Watch`
- `ADVANCE` → may request `Escalate` only when all additional gates pass

For `ADVANCE`, the deterministic engine additionally requires:

- Weakest-Link Score >= 60
- no existential `A` or `U`
- C8 status = `PASSED`
- C9 status = `ELIGIBLE`
- the pre-existing Run 011 escalation rules still pass (aggregate threshold, evidence rating, duplicate/material-variant constraints, no fatal risk)

`HOLD` and `KILL` must preserve a failure reason and restart condition so the Factory does not rediscover the same failed thesis as if it were new.

## Migration rule

Historical G4/G5 packets remain replayable for audit. Their old `Escalate` route is explicitly marked `LEGACY_REPLAY_NOT_PROMOTION_ELIGIBLE` and cannot be consumed as a current promotion receipt.

A current promotion requires an `adversarial_opportunity_gate_v1` receipt. The helper `isPromotionReceiptEligible()` is the deterministic contract intended for Factory Director 000 or another downstream promotion controller.

## Build discipline

No substantial product build is accepted as a substitute for commercial validation. Before C8, use the cheapest reversible proof instrument: public evidence, scripts, spreadsheets, existing Factory agents, manual/concierge workflows, mocks, quote checks, or bounded customer tests. Run 014 should normally enter after the market-critical assumptions survive.

## Initial calibration set

The canonical Notion Run 011 record contains three initial calibrations:

- Website Business — `HOLD`; Weakest-Link 25 (acquisition reality)
- Commercial Trigger Intelligence — `HOLD`; Weakest-Link 40 (acquisition reality, with lead-time/actionability also blocking)
- Nairobi Hardware Price Intelligence — `HOLD` for the narrow quote-validated thesis; Weakest-Link 30 (evidence/input executability). Broad displayed-price arbitrage is not promotion-eligible.

These calibrations are evidence-policy examples, not customer-validation claims.
