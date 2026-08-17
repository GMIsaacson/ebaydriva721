# Run 010 — G0 Opportunity Contract

**Decision:** PASS

## Initial wedge
3PL / fulfillment invoice overcharge audits for U.S. e-commerce brands.

## ICP hypothesis
Brands with meaningful recurring 3PL spend, a written rate card or contract, and enough invoice volume that manual line-by-line reconciliation is burdensome.

## Bounded first audit
One customer-authorized 3PL relationship, 60–90 days of invoices, current governing rate card/contract/amendments, and relevant shipment/order/adjustment evidence where needed.

## Problem hypothesis
Recoverable leakage can occur through duplicate lines/payments, wrong rates or tiers, unsupported accessorials, missed credits, and statement/reconciliation discrepancies.

## Commercial hypothesis
Service-first. Initial validation offer: no-upfront-cost recovery scan; if the customer later authorizes recovery execution, target **20% of verified recovered value**. Commercial terms remain a hypothesis until C0.

## Technical success thresholds for bounded evidence tests
- 100% provenance on every finding.
- 100% exact calculation reproducibility for promoted findings.
- >=95% precision on planted discrepancy cases.
- >=90% recall across in-scope planted issue classes.
- <=2% duplicate/false-positive leakage.
- 100% explicit remediation for under-evidenced cases.
- 0 external actions, accounting writes, payment actions, or money movement.

## Failure thresholds
Fail if the system cannot distinguish unsupported anomaly from evidence-backed claim, cannot reproduce the claimed amount, loses source provenance, or requires vendor contact/accounting mutation to complete the bounded audit.

## Authority
INTERNAL_REVIEW_ONLY through G5/D0 unless separately approved later.
