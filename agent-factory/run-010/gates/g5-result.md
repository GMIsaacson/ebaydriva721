# Run 010 — G5 Shadow Result

**Status:** PASS — controlled calibration shadow  
**Authority:** `INTERNAL_REVIEW_ONLY`

GitHub Actions run `31989678829`, job `95270851095` passed the heterogeneous sanitized/synthetic shadow benchmark.

## Benchmark
- 8 shadow cases
- 7 true-positive finding classes
- 0 false-positive finding classes
- 0 false-negative finding classes
- precision: 1.00 on this controlled labeled set
- recall: 1.00 on this controlled labeled set
- 1 correct remediation route for missing rate evidence
- estimated human review burden: 34 minutes
- aggregate synthetic review amount: 28,750 cents

Controls included:
- clean/no-finding invoice;
- rate mismatch;
- unsupported fee;
- duplicate payment;
- missing credit;
- missing governing evidence;
- already-applied credit;
- combined multi-error invoice.

## Authority/safety
- external actions: 0
- accounting writes: 0
- payment actions: 0
- money movement: 0
- recurring production monitoring: not implemented

## Limitation
This is calibration evidence only. It does not establish real-customer incidence, recoverability, vendor response, recovered dollars, willingness to pay, or production reliability on arbitrary source documents.

## Gate decision
**G5 PASS at controlled shadow level.** Proceed to D0 Downstream Readiness: prove a Recovery-Ready Claim Packet has a durable receiver, versioned handoff, ownership, reject/remediation path, dedupe/idempotency, provenance retention and no orphan findings before C0 commercial validation.
