# A0 Review — SourceMargin Resolver Execution Integration

**Decision:** `A0-SOURCEMARGIN-RESOLVER-EXEC-001`  
**Verdict:** **EXTEND** existing Factory capability; **do not create a new team or agent system**.  
**Phase authorized by this review:** architecture + shadow-only implementation boundary. Production resolver mutation remains blocked.

## Why EXTEND

SourceMargin already has a real resolver queue and bounded contracts for supplier evidence and landed-cost components. Factory 1 already has the owners needed around that queue:

- **Run 004** owns source-to-marketplace research.
- **Work Control** owns execution state.
- **Run 008** owns deterministic retry/dead-letter/recovery patterns.
- **SPC-SOURCE-001** owns supplier search/comparison.
- **SPC-EVID-001** is the qualified Q2 evidence reviewer.
- **SPC-ECON-001 / SW-DS-ECONOMICS-001** own unit-economics calculation.
- **SPC-FREIGHT-001** exists for freight/import/landed cost but is currently **UNPROVEN**.

The only missing capability is the narrow execution adapter between a SourceMargin resolver task and the existing Factory execution/evidence machinery.

Therefore the labels “Supplier Verification Agent” and “Landed Cost Agent” are **task-role labels**, not authorization to mint new canonical agents. Supplier tasks route to existing sourcing + evidence QA. Landed-cost tasks route to the existing freight/import capability in shadow mode until that capability is qualified.

## Authority boundary for the Thermal Pads pilot

The pilot may read resolver/task state and, once the shadow adapter is implemented under the same A0 change set, create an idempotent internal Work Control shadow assignment. It may generate proposed structured evidence, run deterministic economics, and produce Q1/Q2 receipts.

It may **not** claim or complete a SourceMargin resolver task, write canonical supplier/cost evidence, contact a supplier, send an RFQ, authenticate to a marketplace, purchase/bid/list/message, spend money, promote `RESEARCH_SAMPLE_READY` to `SAMPLE_READY`, or publish a customer opportunity.

The current Factory governed reasoning worker also has no browser/connectors. The shadow adapter must not pretend otherwise. Public-web research may be added only by reusing a currently authorized research mechanism or by a separately covered structural/authority change.

## Thermal Pads shadow test

Current test object: Amazon Thermal Pads / benchmark ASIN `B096ZNHY8F`.

Current SourceMargin state provides eight resolver tasks:

1. canonical supplier product link;
2. product cost;
3. international freight;
4. duty/tariff;
5. packaging;
6. inspection;
7. prep/labeling;
8. domestic inbound freight.

The shadow succeeds only if the Factory can mirror these tasks without changing them, route them to the correct existing capability, produce evidence-bearing proposed results or explicit blockers, remain idempotent, and leave every canonical SourceMargin/publication field unchanged.

For landed cost, an unresolved or blocked answer is a valid result. Inventing a value is a failure.

## Professional-readiness constraint

The canonical capability map already states that freight/import/landed-cost professional judgment is blocked until `SPC-FREIGHT-001` is qualified. This review does not waive that condition.

Accordingly:

`evidence collected` ≠ `professionally verified landed cost`

and

`RESEARCH_SAMPLE_READY` ≠ `SAMPLE_READY`.

A future production write-back path must preserve that distinction.

## Already-applied SourceMargin changes

The resolver tables/functions/UI already applied in SourceMargin are retained in place because they currently fail closed, no Factory worker is consuming them, and they make publication semantics stricter rather than looser. This review does **not** retroactively treat those mutations as A0-authorized Factory execution.

No additional production mutation is authorized by this review.

## Next gate

The next implementation should be **one shadow adapter inside Run 004**, not a new worker fleet:

`SourceMargin resolver task (read only) → Work Control shadow assignment → existing specialist route → proposed evidence/result → Q1/Q2 → shadow receipt → stop`

The A0 decision must be updated in the same structural change set when that adapter is implemented, because A0 approvals are not inherited across change sets.

Only after the eight-task Thermal Pads shadow passes may the owner consider a fresh bounded decision for production claim/write-back.
