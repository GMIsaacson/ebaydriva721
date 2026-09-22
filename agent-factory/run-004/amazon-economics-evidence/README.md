# Amazon Economics Evidence Layer v1

**Live acceptance status (2026-09-22): DEPLOYED TO GOVERNED NON-PROD WORKERS / ACCEPTANCE PASS / CABLE TIES REMAINS BLOCKED.**

This layer closes the structural gap between Amazon sourcing/landed-cost research and the existing Run 004 deterministic economics engine. It does not replace `runtime/economics.cjs`; it decides whether there is enough explicit, versioned evidence to populate that existing seven-bucket cents model.

## Ownership

| Stage | Specialist | Responsibility |
| --- | --- | --- |
| LANDED_COST | `SPC-FREIGHT-001` | Supplier shipping, inbound freight, import/logistics evidence |
| ECONOMICS_EVIDENCE | `SPC-ECOM-001` | Amazon fee category, selling plan, fulfillment mode/cost, package facts, packaging/risk policy evidence |
| ECONOMICS | `SPC-ECON-001` | Deterministic cents normalization and existing Run 004 arithmetic only |
| EVIDENCE_QA | `SPC-EVID-001` | Independent Q2 provenance/completeness review |

No specialist may silently absorb another stage's missing inputs.

## Evidence packet

Schema: `amazon-economics-evidence/1.0.0`.

Each candidate packet explicitly tracks:

- sale / referral-fee basis
- source cost
- inbound freight
- fulfillment mode: FBA or FBM
- selling plan: Individual or Professional
- evidenced Amazon fee category
- other marketplace fees
- package length / width / height / weight
- FBA fulfillment amount or FBM outbound-shipping amount
- packaging amount
- risk/returns reserve amount or basis-points policy

Every numeric zero is still evidence-bearing. Missing evidence is never converted to zero.

## Referral-fee schedule

Pinned schedule: `amazon-us-referral-fees/2026-09-22`.

Source: https://sell.amazon.com/pricing

Initial bounded coverage:
- Business, Industrial, and Scientific Supplies: 12%, $0.30 minimum
- Tools and Home Improvement: 15%, $0.30 minimum
- Office Products: 15%, $0.30 minimum
- Home and Kitchen: 15%, $0.30 minimum
- Lawn and Garden: 15%, $0.30 minimum
- Everything Else: 15%, $0.30 minimum

The worker does **not** infer fee category from Amazon browse category. Amazon's first-party pricing page explicitly notes that fee category may differ from the category customers see in the store.

## Fulfillment handling

FBA and FBM are explicit policy inputs, never inferred from a competitor's offer.

- FBA requires exact package facts plus a first-party FBA fulfillment amount (Revenue Calculator, Fee Preview, or equivalent evidence) before the outbound/fulfillment bucket can be resolved.
- FBM requires exact package facts plus evidence-backed outbound-shipping cost.
- Professional plan monthly subscription is recorded as a fixed cost excluded from per-unit arithmetic unless a later owner policy explicitly allocates it.
- Packaging and risk/returns reserve require versioned owner policy or direct evidence.

## Deterministic handoff

`buildAmazonEconomicsInputs(packet)` returns:
- `Complete` only when every evidence requirement is satisfied;
- a stable evidence hash;
- exact missing and invalid fields;
- resolved referral fee / selling-plan / marketplace / fulfillment components;
- the seven existing `economics.cjs` input buckets only when complete.

The downstream ECONOMICS stage no longer trusts model-generated economics inputs. It recomputes them from the prior evidence packet. Q2 receives and preserves the same packet and assessment.

## Cable Ties live acceptance extension

Original run: `SM-AMZ-CABLE-TIES-001`, leaf `507844`.

New governed stage trail:

| Stage | Command | Result |
| --- | --- | --- |
| ECONOMICS_EVIDENCE | `WC-20260922081238-980e87dcfc` | BLOCKED — explicit missing-evidence packet produced |
| ECONOMICS | `WC-20260922081324-6e15b236bf` | BLOCKED — deterministic resolver refused incomplete packet |
| EVIDENCE_QA | `WC-20260922081404-d51f9a51d2` | BLOCKED — independent Q2 confirmed provenance/completeness failure |

An earlier evidence-stage attempt `WC-20260922081052-62adbfa1aa` failed closed on `AMAZON_ECONOMICS_EVIDENCE_URL_NOT_ATTESTED`. The validator was corrected to accept URLs already attested in prior governed receipts plus the pinned first-party fee-schedule URL; arbitrary unattested URLs remain rejected.

### Best candidate: B09PJ8L58G

Resolved:
- exact Amazon price: $3.99
- exact product configuration: 8-inch / 200 mm, black nylon/plastic, 40 lb, 100 pack
- exact supplier product page
- dated Amazon evidence packet and stable evidence hash

Still unresolved:
- exact source acquisition cost because the public supplier shows a range rather than a bound selected offer
- inbound freight / supplier shipping / import-logistics amount
- Amazon fee category
- selling plan
- FBA vs FBM mode
- exact package dimensions and package weight
- FBA fulfillment fee or FBM outbound shipping
- packaging policy
- risk/returns reserve policy
- other marketplace-fee policy/basis

The correct result remains BLOCKED. The improvement is that the system now identifies these as named, versioned evidence gaps rather than a generic "economics incomplete" condition.

## Tests and deployment

- `tests/amazon-economics-evidence.test.cjs`: 6/6 pass.
- Branch executor syntax validated in isolation before deployment.
- Exact branch files deployed to the existing three governed Work Control workers.
- Live V2 executor backup created before replacement.
- No supplier contact, purchase, listing, publication, spend, or marketplace production mutation occurred.

## Next integration targets

1. Persist economics-evidence packet/assessment in normalized SourceMargin research records.
2. Add customer/research-console rendering for each economics evidence bucket and missing field.
3. Add a governed owner policy object for selling plan, fulfillment scenario, packaging, and risk reserve instead of embedding business assumptions in prompts.
4. Add first-party fee-category classification / Revenue Calculator or SP-API evidence retrieval where authorized.
5. Add an exact source-offer/quote resolver so source-price ranges cannot masquerade as acquisition cost.
