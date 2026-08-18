# Run 010 — B0 Run Boundary Contract v1.0

**Run ID:** AP-RECOVERY-010  
**Decision:** PASS  
**Authority ceiling:** INTERNAL_REVIEW_ONLY

## Closed loop
Customer-authorized document set → validated evidence inventory → normalized AP records → candidate discrepancies → evidence-backed findings → QA → Recovery-Ready Claim Packet v1.0.

## Inputs
At minimum:
- invoice and/or payment evidence;
- governing comparison source when required: contract, PO, rate card, vendor statement, credit memo, amendment, or other customer-authorized evidence.

## Outputs
Recovery-Ready Claim Packet v1.0:
- engagement ID
- vendor identity
- finding ID + issue class
- affected invoice/payment IDs
- claimed/review amount
- exact calculation
- governing evidence + provenance
- confidence
- unresolved questions
- duplicate/idempotency key
- QA verdict
- recommended next action
- authority state = INTERNAL_REVIEW_ONLY

## In scope
- file inventory and evidence completeness checks
- vendor/entity normalization
- invoice/payment/contract/rate/credit matching
- duplicate/payment candidate detection
- contract/rate variance analysis
- missed-credit detection
- unsupported-fee detection
- reconciliation discrepancy detection
- evidence reconstruction
- QA, rejection, remediation, and claim-packet assembly

## Out of scope
- autonomous vendor contact
- claim submission
- negotiation
- legal interpretation
- tax advice
- accounting writes
- payment/refund actions
- signing agreements
- production recurring monitoring

## Completion condition
The loop is complete only when a supplied test set can be processed reproducibly with:
- preserved provenance;
- duplicate suppression;
- explicit reject/remediation routing;
- no orphan findings;
- zero external, payment, accounting, or money-movement actions.

## Material-scope change rule
Any expansion into vendor contact, production monitoring, bank/accounting mutation, legal/tax interpretation, or autonomous recovery requires an Architecture Amendment and a new boundary-contract version.
