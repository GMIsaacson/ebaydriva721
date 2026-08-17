# System Map Package — A0 Template

**Opportunity / Need:**
**Architecture ID:**
**Owner:** Run 007 — Systems Intelligence & Development Team
**Status:** DRAFT | REWORK | PASS
**Date:**

## 1. Ultimate outcome
Describe the complete business/operational outcome, not the immediate component.

## 2. End-to-end value chain
`Source/Input → ... → Final customer/business/operational outcome`

## 3. Capability inventory
| Capability | Existing? | Reuse / Build / Defer / Owner-only | Owner / System | Notes |
|---|---|---|---|---|

## 4. Boundary map
### This proposed Run owns
-

### Explicitly outside this Run
-

### Shared infrastructure reused
-

## 5. Handoffs
| From | To | Trigger | Contract / Required fields | Failure path |
|---|---|---|---|---|

## 6. Canonical data and storage
| Record | System of record | Lifecycle | Evidence/provenance | Retention/sensitivity |
|---|---|---|---|---|

## 7. Dependencies and build sequence
1.
2.
3.

## 8. Authority map
| Capability/action | Observe | Draft | Execute | Owner approval required | Fail-closed rule |
|---|---|---|---|---|---|

## 9. Scale / expansion paths
Potential expansion dimensions:
- Geography:
- Niche/trade/product:
- Customer segment:
- Volume:
- Delivery/channel:

None of these are authorized merely by appearing here. Define the approval gate for each material expansion.

## 10. Operability
- Health/heartbeat:
- Staleness:
- Duplicate/idempotency:
- Retry/recovery:
- Unknown external outcome:
- Cost/resource monitoring:
- Human review queue:

## 11. Proposed Factory Run decomposition
| Sequence | Run / Capability | Why separate | Entry dependency | Output consumer |
|---|---|---|---|---|

## 12. Critical assumptions and planned tests
| Assumption / Unknown | Risk if wrong | Gate/test that will resolve it |
|---|---|---|

## 13. Challenger review
List missing capabilities, orphaned ownership, duplicated infrastructure, premature assumptions, and reasons the map might still be incomplete.

## 14. A0 decision
**PASS / REWORK**

Reason:

If PASS, G0 may begin with:
> Given the approved System Map, build/validate ____________________.
