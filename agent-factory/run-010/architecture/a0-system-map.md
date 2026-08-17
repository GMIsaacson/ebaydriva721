# Run 010 — A0 Architecture Discovery

**Run ID:** AP-RECOVERY-010  
**Opportunity:** Vendor Invoice Overcharge Recovery  
**Decision:** PASS  
**Authority:** INTERNAL_REVIEW_ONLY

## Ultimate outcome
Turn customer-authorized accounts-payable history into defensible, quantified vendor-overcharge findings and recovery-ready claim packets, then measure verified recovered value through a separately governed downstream recovery loop.

## Whole value chain
Customer acquisition → secure document intake → file inventory/data validation → vendor/entity normalization → invoice/payment/contract/PO/rate/credit matching → discrepancy detection → evidence reconstruction → QA/confidence → recovery-ready claim packet → human approval → vendor recovery communication → response/settlement tracking → recovered-value verification → commercial fee calculation → learning/monitoring.

## Natural system boundaries
1. Audit Intake & Evidence Loop
2. Overcharge Detection & Claim Assembly Loop
3. Recovery Coordination Loop
4. Commercial & Client Operations

## Canonical objects
- Customer / audit engagement
- Vendor
- Contract / rate schedule / PO
- Invoice / invoice line
- Payment
- Credit / adjustment
- Evidence artifact + provenance
- Finding / claim candidate
- Recovery case
- Recovery event / outcome

## Initial finding classes
- Duplicate invoice/payment
- Contract or rate-card mismatch
- Missed discount/credit
- Unsupported fee/surcharge
- Statement/payment reconciliation discrepancy

## Controls
- Only customer-authorized source records may be processed.
- Do not request bank credentials, tax IDs, payroll, medical data, or unrelated sensitive records.
- Every finding must include amount, issue class, exact calculation, governing evidence, provenance, confidence, unresolved questions, and next action.
- An anomaly is not a recoverable claim until QA establishes an evidentiary basis.
- Vendor communication or claim submission requires explicit approval.
- Agents may not modify accounting records, payments, refunds, contracts, or bank details.
- Idempotency and duplicate controls apply across invoices, payments, findings, claims, and recovery events.

## Unknowns to validate
- Best initial vendor category / vertical
- Typical SMB document completeness
- Recoverable-dollar density per 100 invoices
- Human-review minutes per validated claim
- Vendor response and time-to-credit
- Fixed-fee vs contingency willingness to pay

## Recommended decomposition
The first bounded Run stops at a recovery-ready claim packet. Recovery execution is downstream and separately approval-gated.
