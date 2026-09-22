# Amazon generic leaf runner V2 — Cable Ties live acceptance

**Status (2026-09-22): LIVE ACCEPTANCE COMPLETED / ZERO QUALIFYING OPPORTUNITIES.**

This record preserves the second bounded Amazon leaf acceptance after Plant Labels. Plant Labels V1 remains unchanged as the baseline. V2 removes the hard-coded leaf/run scope and accepts a governed payload containing `runId`, `leafId`, `leafName`, `stage`, `specialist`, and explicit `priorCommandIds`.

## Run

- Run: `SM-AMZ-CABLE-TIES-001`
- Amazon US leaf: Cable Ties `507844`
- Candidate cap: 5
- Authority: read-only public research; zero supplier messages, purchases, listings, publication, spend, or production marketplace mutation.
- Runtime: existing Run 004 / Work Control / three governed workers.
- Independent Q2: `SPC-EVID-001`.

## Canonical successful stage trail

| Stage | Governed command | Outcome |
| --- | --- | --- |
| ASIN_DISCOVERY | `WC-20260922073818-2757c04de1` | PASS — 5/5 exact Amazon product pages independently verified |
| DEMAND_VALIDATION | `WC-20260922074138-cd914897b5` | PASS — all five retained with current rounded bought-in-past-month signals |
| SOURCING | `WC-20260922074349-a291474cde` | PASS — one exact source-equivalent offer; four blocked on equivalence |
| LANDED_COST | `WC-20260922074426-6c53700707` | BLOCKED — surviving source lacked publicly quantified inbound freight/import/logistics |
| ECONOMICS | `WC-20260922074548-3df0ef4e0c` | BLOCKED — no complete evidence-backed economics packet |
| EVIDENCE_QA | `WC-20260922074741-13bc1eea2c` | BLOCKED — independent Q2 confirmed all five terminal blocked dispositions |

Final funnel: **5 discovered → 5 demand-validated → 1 source-equivalent → 0 landed-cost complete → 0 economics-complete → 0 research candidates / SAMPLE_READY / publishable.**

## Candidate that reached sourcing

Amazon ASIN `B09PJ8L58G`: 8-inch black cable ties, 100 pack, 40 lb tensile strength.

- Amazon: https://www.amazon.com/dp/B09PJ8L58G
- Observed Amazon price: $3.99
- Demand badge: 10K+ bought in past month (rounded lower-bound, not exact monthly sales)
- Exact source: https://www.alibaba.com/product-introduction/China-Factory-Plastic-Nylon-Cable-Tie_1600120680478.html
- Match: black nylon/plastic, self-locking, 8-inch / 200 mm, 40 lb, 100 pieces per pack.
- Public source price tiers observed during the run: approximately $0.27–$0.30 for 1–199 bags, $0.26–$0.29 for 200–999, and $0.25–$0.28 for 1,000+.
- Blocker: supplier page did not publicly quantify supplier shipping, inbound freight, import duty, or other logistics. Q2 also confirmed unresolved marketplace-fee, fulfillment, outbound-shipping, packaging, and risk-reserve inputs. No zero-cost assumptions were accepted.

## V2 changes proven live

- Dynamic leaf/run scope replaces Plant Labels hard-coding.
- Deterministic category-page discovery reads `https://www.amazon.com/b?node=<leafId>`, extracts up to five candidate ASINs, then verifies exact public Amazon product pages.
- Discovery and demand validation can run with deterministic Amazon HTTP evidence and zero model web-search calls.
- Prior stage context is hydrated only from explicit governed Work Control receipt IDs with run/leaf scope checks.
- Terminal rejected/blocked candidates cannot be reopened.
- Independent Q2 remains a distinct Work Control command and specialist identity.
- V1 remains deployed alongside V2 for rollback/baseline comparison.

## Budget acceptance finding

The default Run 004 command budget is 2¢. Search-heavy supplier/freight research exceeded that ceiling and correctly failed closed. Work Control already supports a per-command governed budget up to 10¢, so the successful SOURCING and LANDED_COST commands used a bounded 5¢ ceiling; ECONOMICS and Q2 used 3¢. External-action and commercial-spend authority remained zero.

Fail-closed budget attempts retained for audit:
- `WC-20260922073416-34571bcc92` — discovery, MODEL_BUDGET_EXCEEDED
- `WC-20260922073626-8cc92cd06e` — discovery, MODEL_BUDGET_EXCEEDED
- `WC-20260922073906-6d68c5c9e2` — demand validation, MODEL_BUDGET_EXCEEDED
- `WC-20260922074227-a541ba9976` — sourcing, MODEL_BUDGET_EXCEEDED

## Architectural conclusion

Cable Ties demonstrated that the recurring blocker is no longer discovery or basic supplier equivalence. A product can have very strong demand, a large apparent source-price spread, and an exact configuration match yet still fail correctly because the system lacks deterministic delivered/inbound cost and a governed Amazon fulfillment/fee basis.

The next system improvement should therefore be an evidence-backed Amazon economics assumptions/profile layer rather than repeatedly changing leaves. It should make fulfillment mode, first-party fee schedules, package dimensions/weight, inbound logistics basis, packaging, and risk/returns reserve explicit and versioned. It must never silently convert unresolved inputs to zero.

Runtime note: the V2 executor was deployed side-by-side with V1 on the three existing governed workers for this acceptance. The live `worker.cjs` route was updated to select V2 before V1; the canonical V2 executor is stored in this branch.