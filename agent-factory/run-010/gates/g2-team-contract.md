# Run 010 — G2 Team & Control Design

**Decision:** PASS

## Team
1. **Audit Intake & Evidence Agent** — inventories customer-authorized files, validates scope, records provenance, and routes missing evidence.
2. **Vendor & Contract Normalization Agent** — normalizes vendor/entity identities, rate cards, contract amendments, fee schedules, and effective dates.
3. **Invoice Reconciliation Agent** — matches invoice lines, payments, credits, rate rules, order/shipment evidence, and flags bounded candidate discrepancies.
4. **Claim Evidence Agent** — reconstructs exact calculations and assembles candidate Recovery-Ready Claim Packets.
5. **Evidence & QA Agent** — independently verifies identity, governing evidence, amount reproducibility, provenance, duplicate state, and authority.

## Typed handoff sequence
`IntakeEvidencePackage v1 → NormalizedVendorLedger v1 → DiscrepancyCandidate v1 → RecoveryReadyClaimPacket v1 → QAVerdict v1`

## Authority matrix
All five agents may read authorized inputs, transform/normalize records, compute, classify, draft internal findings, route remediation, and log.

No agent may:
- contact a vendor;
- submit a claim;
- negotiate;
- edit customer accounting records;
- change or initiate payments/refunds;
- sign contracts;
- give legal/tax opinions;
- enable recurring production monitoring.

## Escalation
Escalate ambiguous vendor identity, conflicting contract versions, missing effective dates, unreconciled currency/tax treatment, unclear duplicate-payment status, weak source evidence, and any request for external action.

## QA independence
The Evidence & QA Agent must not self-approve a finding it created. A candidate cannot become recovery-ready without independent QA PASS.
