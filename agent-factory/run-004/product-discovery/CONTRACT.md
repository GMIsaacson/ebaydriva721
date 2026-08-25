# Run 004 — Product Opportunity Discovery Amendment

Factory provenance: Work Control command `WC-20260825012338-6ac1426d04`, terminal state `DELIVERED`.

This is an **extension of `RUN-004` / `DS-S2M-004`**, not a new team. It adds a bounded Product Opportunity Discovery lane that can find generic eBay-to-supplier opportunities independently and route survivors through the existing exact-match and deterministic-economics controls.

## Authority

Allowed: public-web research, internal screening, exact-product matching, deterministic economics, recommendations, evidence retention, and owner-review drafts.

Prohibited: purchase, bid, seller contact, messaging, listing publication, production mutation, credential harvesting, authenticated marketplace automation, access-control bypass, CAPTCHA/proxy circumvention, or unapproved spend.

## Mission

Find products that have demonstrated eBay demand and plausible source-to-retail spread, then fail closed unless the product identity, supplier equivalence, costs, and risk are strong enough for an evidence-backed decision.

## Discovery preference

Prefer, but do not blindly require:

- generic or unbranded products;
- at least 100 demonstrated eBay sold units;
- useful ASP, normally about $10–$40;
- small, light, durable, simple products;
- low IP, regulatory, electrical, medical/dental, baby-safety, and other liability exposure;
- public supplier unit cost at or below about 20% of observed eBay item price;
- multiple plausible suppliers.

A candidate below the preferred ASP must not be auto-killed. It must first be tested under free-shipping, buyer-paid-shipping, and bundle/multi-pack structures when those structures are commercially plausible.

## Roles and typed handoffs

1. **Opportunity Discovery Scout** → `discovery_candidate_v1`
   - product identity/family
   - generic/brand state
   - eBay listing URL/title
   - observed item price
   - demonstrated sold count
   - shipping mode/charge when visible
   - evidence timestamp
   - preliminary source-cost evidence
   - size/weight/risk signals

2. **Stage-1 Screener** → `stage1_decision_v1`
   - PASS / HOLD / FAIL
   - demand, ASP, sourceability, shipping, IP/compliance and return-risk rationale

3. **Product Fingerprint & Comparable Analyst** → `product_fingerprint_v1`
   - exact material, dimensions, quantity/pack, construction, compatibility/model and required attributes
   - no title-only equivalence

4. **Supplier Match Analyst** → `supplier_match_v1`
   - supplier, URL, unit price, MOQ, freight/DDP when available, package data
   - equivalence = EXACT / HIGH_CONFIDENCE / PARTIAL / NOT_EQUIVALENT

5. **Deterministic Landed-Economics Engine** → `economics_scenario_v1`
   - item price and buyer-paid shipping
   - supplier cost, inbound freight, eBay/order fees, promoted-listing allowance, outbound shipping, packaging, returns/defects reserve
   - net profit, margin, ROI, break-even
   - base / conservative / kill cases

6. **Risk & Evidence QA** → `final_decision_v1`
   - STRONG PASS / RFQ / HOLD / KILL / BUY
   - assumptions, missing evidence, kill threshold, revisit trigger

7. **Ledger/Telemetry**
   - retain winners and failures; never delete a failed research record merely because it is unattractive.

## Evidence rules

- DataScout `Sold` may be treated as authoritative when the owner supplies it as verified.
- Independently discovered sold counts must be directly observed in public evidence and labeled `WEB_OBSERVED` until incorporated into the verified catalog.
- Existing DataScout Sell/Buy URL quality is not a validity gate.
- Do not invent sold counts, prices, supplier prices, shipping, DDP, dimensions, certification, or product equivalence.
- Missing required cost inputs => `INCOMPLETE` / RFQ or HOLD, never guessed profitability.
- Stale/conflicting evidence => REVIEW/HOLD.
- Material BOM mismatch => fail exact-match gate.
- Branded demand is not transferable to generic supply without independent generic-market evidence.

## Decision gates

- **STRONG PASS:** exact/high-confidence identity, adequate demand, acceptable risk, complete base and conservative economics, and target net margin >= 20% in the conservative case.
- **RFQ:** promising economics but a supplier quote, freight/DDP, MOQ/package or another material sourcing input is missing.
- **HOLD:** unresolved identity/evidence/shipping/compliance issue that could materially change the result.
- **KILL:** failed identity, risk, or economics under realistic stress.
- **BUY:** owner-review recommendation only after exact supplier/DDP and complete economics; it never executes a purchase.

## Calibration fixtures

The lane must reproduce the screening logic on these known examples supplied during calibration:

- drill-brush set — 640 sold @ $19.79;
- car-seat gap fillers — 230 sold @ $13.95;
- telescoping magnetic pickup tools — 585 sold @ $10.99;
- reusable pet-hair roller — 125+ sold @ $10.99;
- two-pack air-fryer liners — 747 sold @ $11.53.

All five should survive Stage 1 when generic/low-risk assumptions hold. None may become BUY merely from the calibration facts.

## Promotion criteria

Product Opportunity Discovery can be promoted to bounded G5 shadow when:

1. deterministic tests cover all five calibration fixtures;
2. missing cost and identity data fail closed;
3. low-ASP free/buyer-paid/bundle cases are all supported;
4. all external-action counters remain zero;
5. public discovery is bounded by result count and owner-approved search budget;
6. output includes evidence URLs and confidence/provenance;
7. the existing Run 004 G4 suite and DataScout build remain green.

Anything beyond read-only G5 shadow requires a later explicit owner decision.