# Recovery-Ready Claim Packet v1.0 — G1 Contract

## Required entities
- `engagement`
- `vendor`
- `agreement_or_rate_card`
- `invoice`
- `invoice_line`
- `payment`
- `credit_or_adjustment` when applicable
- `evidence_artifact`
- `finding`

## Finding schema
```json
{
  "findingId": "string",
  "engagementId": "string",
  "vendorId": "string",
  "issueClass": "DUPLICATE|RATE_MISMATCH|MISSING_CREDIT|UNSUPPORTED_FEE|RECONCILIATION_GAP",
  "affectedRecordIds": ["string"],
  "reviewAmountCents": 0,
  "calculation": "string",
  "governingEvidenceIds": ["string"],
  "confidence": 0,
  "unresolvedQuestions": ["string"],
  "idempotencyKey": "string",
  "qaVerdict": "PASS|REMEDIATE|REJECT",
  "recommendedNextAction": "string",
  "authority": "INTERNAL_REVIEW_ONLY"
}
```

## Promotion rules
A candidate may become a recovery-ready finding only when:
1. the affected invoice/payment identity is unambiguous;
2. the governing rule or duplicate basis is evidenced;
3. the amount is reproducible from source records;
4. provenance is retained;
5. duplicate/idempotency key is stable;
6. QA verdict is PASS.

Missing governing evidence routes to `REMEDIATE`, never to a claim.

## Data handling
Do not ingest bank credentials, tax IDs, payroll, medical data, or unrelated personal records. Customer-authorized AP exports and supporting commercial documents only.
