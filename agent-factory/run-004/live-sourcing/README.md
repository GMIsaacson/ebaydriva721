# DataScout Live Sourcing MVP — Slices 1–5

This directory contains the permission-first sourcing foundation for Run `DS-S2M-004`.

## Slice 1 — Source Access Registry

Every source adapter must prove its access rights and exact access mode before DataScout may retrieve or process data. Unknown or unclear machine access fails closed.

Access classes:

- **GREEN** — the recorded access method is permitted for the exact use case. Machine retrieval still requires `machineFetchAllowed=true`, an approved machine access mode, recorded rights evidence, a current review, and an inactive kill switch.
- **YELLOW** — manual verification only. No automated retrieval.
- **RED** — blocked.

Approved modes: `owner_upload`, `manual_verification`, `official_api`, `licensed_feed`, `public_download`.

## Slice 2 — Authorized product-data intake

DataScout can parse owner-authorized UTF-8 CSV and JSON datasets into one canonical sourcing record without contacting the underlying supplier website.

The intake runtime requires explicit owner attestation, normalizes common product/cost/stock/shipping fields, stores money as integer cents, creates deterministic IDs/hashes, preserves provenance, suppresses exact duplicates, routes conflicting duplicates to REVIEW, isolates invalid rows, and is bounded to 5,000 records by default. Acceptance coverage includes a 600-record batch.

## Slice 3 — Deterministic source-side prescreen

Normalized candidates can be reduced to a bounded marketplace-verification queue before any eBay research occurs.

The prescreen applies owner cost/outlay caps, stock-vs-MOQ checks, excluded terms, identity-quality controls and source-side completeness scoring. It caps the human verification queue at 100 and defaults to 50. Eligible overflow is DEFERRED rather than falsely rejected. Marketplace demand remains explicitly unknown at this stage.

The scale acceptance case proves 600 eligible normalized records can become 50 VERIFY candidates plus 550 DEFERRED records with zero marketplace retrieval.

## Slice 4 — Manual eBay verification contract

The bounded queue has a typed path for current eBay evidence gathered by a human operator. It accepts manual Product Research/completed-listing observations, enforces candidate identity and freshness, records sold-price/demand facts with evidence provenance, rejects zero sold evidence, and performs zero automated eBay retrieval.

The default marketplace-evidence freshness window is 72 hours and cannot be expanded beyond seven days.

## Slice 5 — Shipping, authoritative economics and deal decision

A VERIFIED candidate can now be converted into a deterministic **BUY / WATCH / REJECT** decision without hard-coded marketplace assumptions.

The deal decision:

- rechecks marketplace-evidence freshness at decision time so a previously VERIFIED object cannot be reused after it becomes stale;
- allocates source-pack cost to the exact quantity sold on eBay;
- requires explicit current inbound freight and packaging inputs;
- requires marketplace fee percentage, fixed fee and an evidence reference instead of relying on the legacy hard-coded eBay/PayPal calculator;
- accepts one or more shipping quotes with timestamp/evidence and uses the conservative maximum as modeled outbound postage;
- rejects stale/future shipping evidence and caps shipping-evidence freshness at seven days;
- treats observed buyer shipping charges as collected revenue when present, while actual outbound postage remains a separate cost;
- applies an explicit risk-reserve rate;
- delegates authoritative profit, margin, ROI and break-even to `datascout-landed-economics/1.0.0`;
- requires owner-defined BUY thresholds for profit, ROI, margin and normalized 30-day sales rate;
- returns **BUY** only when every threshold passes, **WATCH** for positive economics below one or more BUY thresholds, and **REJECT** for non-positive landed economics;
- returns BLOCKED / REVIEW / INCOMPLETE rather than guessing when required evidence is missing or stale;
- performs zero marketplace fetches, machine retrieval, purchases, listings, external actions or spend.

The acceptance fixture proves pack-cost allocation, conservative shipping, BUY/WATCH/REJECT branching, fee-provenance requirements, stale-market/stale-shipping controls and preservation of the existing deterministic economics engine.

## Current architecture

`authorized dataset → Source Access Registry → normalize/dedupe → source-side prescreen → bounded eBay verification queue → manual verified marketplace facts → shipping + authoritative landed economics → BUY/WATCH/REJECT`

The backend decision path is now complete. The next slice is application/data-plane integration: expose this governed workflow through DataScout without duplicating business logic in the React client, then persist the sourcing run/queue/results under reviewed Firestore rules and perform a real authorized 500+ record end-to-end acceptance.

## Safety boundary

Slices 1–5 do not scrape supplier or marketplace sites, automate logged-in sessions, solve CAPTCHAs, rotate proxies, purchase inventory, place bids, publish listings, send messages, or spend money.

A real machine source can be added only after the exact API/feed/download rights are reviewed and recorded.

## Test

```bash
npm run test:run004:sourcing
```

The dedicated GitHub Actions workflow also reruns the existing Run 004 G4 tests and the DataScout Vite build to detect regressions.
