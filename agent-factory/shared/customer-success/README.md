# CUST-SUCCESS-001 — Customer Success Reuse Module

P4 generalizes the existing registered `Customer Success` unit (`KIN-CS-01`) as the shared portfolio-wide post-delivery capability under CCLC-001 v1.0.

## Canonical path

`delivered_engagement_v1`
→ Customer Success accepts ownership
→ `ACCEPTANCE_SUPPORT`
→ customer acceptance/support handling
→ `SUCCESS_ACTIVE`
→ evidence-backed outcome recording
→ optional `success_outcome_v1` to Growth/Proof + Analytics
→ evidence-backed `renewal_or_expansion_opportunity_v1`
→ Commercial Conversion
→ `RENEWAL_EXPANSION`

Terminal outcomes may become `CLOSED_SUCCESS` or `CHURNED` only with authoritative evidence/rules. Silence is never enough to infer either.

## Support routing

- Clarification: Customer Success owns; draft response only.
- Correction / in-scope revision / incident requiring artifact change: `fulfillment_remediation_request_v1` → Fulfillment Control; preserve original delivery/version, require independent QA and a new delivery approval if artifacts change.
- New scope request: `renewal_or_expansion_opportunity_v1` → Commercial Conversion; Customer Success does not quote or commit price/scope.
- Refund request / material complaint: owner/finance escalation; no refund or money authority.

## Proof and permission

Measured outcomes require evidence or must be `NOT_MEASURED`. Customer statements, internal interpretation and measured facts must remain distinct.

Public proof is blocked by default. Testimonials, logos, quotes, case studies and referral actions require explicit applicable permission evidence. Internal analytics may receive non-public success outcomes without granting publication authority.

## Authority boundary

P4 may maintain internal success state, classify support, draft responses, prepare fulfillment remediation, prepare renewal/expansion opportunities and record authoritative customer feedback.

P4 may not independently:
- send customer communications;
- grant or execute refunds;
- move money;
- change price or accepted scope;
- promise outcomes;
- publish customer proof;
- externally request referrals/testimonials;
- make renewal/expansion commercial commitments.

Any customer-facing action requires a separate exact action/payload-hash permit and remains outside this module's execution path during validation.

## Validation

P4 validation is simulation-only. `externalActionsPerformed=0` and `moneyMovementPerformed=0` are invariants.

Run with:

`npm run test:customer-success`

The connected `npm run test:run012` suite includes CCLC, Commercial Conversion, Fulfillment, Customer Success and Run 012 policy checks.
