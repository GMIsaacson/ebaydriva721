# Factory Readiness Engine v0.1

## Placement

The Readiness Engine is an **extension of Run 008 Operations Core**, not a new Factory, scheduler authority, database, control center, or SourceMargin-specific orchestration plane.

Existing ownership remains:

- **Work Control / Agent 000** — execution truth, claiming, terminal state and authority accounting;
- **Run 008 Operations Core** — shared deterministic operational primitives;
- **Run 004** — SourceMargin domain execution ownership;
- **n8n** — connector/execution transport where useful;
- **domain state stores** — canonical facts/evidence for the product that owns them.

The Readiness Engine answers one bounded question:

> Given a versioned micro-workflow contract and a current subject snapshot, are the workflow's declared ingredients satisfied?

It does not execute the workflow.

## State model

Each evaluation returns exactly one of:

- `READY` — all required ingredients are satisfied and no hard blocker matches;
- `WAITING` — one or more required ingredients are not yet satisfied;
- `BLOCKED` — a declared hard-stop condition matches;
- `INVALID` — contract or subject snapshot is malformed.

A READY result includes an idempotent **proposed work key**. v0.1 does not submit that key to Work Control.

## Contract

A micro-workflow declares:

```json
{
  "workflowId": "amazon-seller-enrichment-v1",
  "version": "1.0.0",
  "owner": "Run 004 / Seller Graph",
  "priority": 70,
  "dispatchTarget": {
    "kind": "WORK_CONTROL_WORKER",
    "id": "amazon-seller-enrichment-v1"
  },
  "requires": [
    {"fact":"seller.id","operator":"EXISTS"},
    {"fact":"listingClassification.classification","operator":"EXISTS"}
  ],
  "blocksIf": [],
  "produces": [
    "seller.type",
    "seller.classificationConfidence"
  ],
  "authority": {
    "mode": "INTERNAL_WRITE",
    "externalActionAuthorized": false,
    "costCeilingCents": 0
  }
}
```

The engine never infers undeclared prerequisites.

## Independent execution model

Suppose one ASIN snapshot contains:

```text
asin                  yes
amazonUrl             yes
seller.id             yes
listingClassification no
supplierCandidate     yes
```

The readiness results may be:

```text
Demand Validation     READY
Seller Enrichment     WAITING
Price Validation      READY
PP Equivalence        WAITING or BLOCKED depending on its own contract
```

No global "current stage" is required.

When a new fact arrives, only the affected contracts need to be reevaluated. A Seller Enrichment task can therefore wake up later without delaying Demand Validation or another supplier branch.

## Coordinator model

The coordinator consumes a batch readiness view rather than sequencing every worker itself:

```text
READY      -> candidates that may be proposed to Work Control
WAITING    -> exact missing ingredients
BLOCKED    -> exact hard-stop conditions
INVALID    -> contract/state defects requiring repair
```

Priority affects ordering inside the READY set. It does not grant execution authority.

## v0.1 authority boundary

This release is deliberately **evaluation-only**:

- no Work Control mutation;
- no task claim;
- no n8n invocation;
- no recurring schedule;
- no external action;
- no spend;
- no production domain writeback.

`dispatchAuthorized` is always false in v0.1.

The next governed phase can add a narrow adapter:

```text
READY decision
  -> Work Control proposed assignment
  -> existing claim / authority / retry / completion machinery
```

That adapter must reuse Work Control rather than create another execution ledger.

## Why this belongs in Run 008

Run 008 already owns the Dependency & Blocker Graph, idempotency, recovery, health, cost and authority primitives. The missing capability is deterministic **readiness evaluation** over those dependencies.

This is therefore a bounded extension of an existing core responsibility rather than a new scheduler/control plane.

## First proof target

Use SourceMargin micro-workflows as the first compatibility proof:

- Demand Validation V1;
- Seller Enrichment V1;
- Supplier Discovery V2;
- Product/Pack Equivalence V1.

The acceptance condition is that multiple workflows can be READY simultaneously, each becomes READY only from its own declared ingredients, hard stops remain fail-closed, and replay produces the same proposed work key.
