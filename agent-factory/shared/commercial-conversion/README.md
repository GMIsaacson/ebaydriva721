# COMM-CONV-001 — Commercial Conversion Reuse Module

This shared module adapts existing commercial components to the CCLC-001 v1.0 portfolio-wide lifecycle instead of creating a duplicate Sales team.

## Reused components

- Pipeline & Reply Coordinator — owns accepted conversion state, reply classification, next action, objections and qualification.
- Offer & Asset Builder — drafts bounded offer/scope/assets.
- Proposal Builder — versions/hashes ProposalScope records and prepares approval packets.

## Input

`qualified_opportunity_v1` from Run 012 / Demand & Acquisition.

The receiver returns exactly one typed result:

- `conversion_acceptance_v1`
- `conversion_rejection_v1`

A rejection returns ownership to Demand & Acquisition with remediation reasons.

## Authority

The module may read, classify, create internal CCLC state, and draft offers/proposals. It may not independently send external communications, change final price/scope, contract, claim payment, move money, start fulfillment, deliver work or perform customer-success actions.

Proposal external eligibility requires a separate exact owner permit matching proposal ID, version and cryptographic hash. The module still performs zero external sends itself.

Commercial acceptance must match the exact proposal version/hash and authoritative acceptance evidence. Acceptance does not establish collected payment.

## Tests

`npm run test:conversion`

The combined `npm run test:run012` includes CCLC, Commercial Conversion and Run 012 policy/workflow boundary tests.
