# DataScout Live Sourcing MVP — Slices 1–4

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

The bounded queue now has a typed, deterministic path for current eBay evidence gathered by a human operator.

The validator:

- uses the registered `ebay-manual-verification` YELLOW route only;
- accepts manual eBay Product Research or manual completed-listing observations;
- requires the verification candidate ID to match the DataScout candidate exactly;
- requires verifier identity, evidence reference, timestamp and observation window;
- records units sold, average sold price and optional active-listing, sell-through and average-shipping facts;
- routes uncertain identity, future timestamps and stale evidence to REVIEW;
- rejects zero observed sold units rather than inferring demand;
- marks sold evidence without a usable average sold price INCOMPLETE;
- derives a deterministic 30-day sold-rate normalization for downstream ranking;
- performs zero eBay fetches, browser automation, external actions or spend.

The default verification freshness window is 72 hours and can be tightened by the caller. It cannot be expanded beyond seven days.

## Current architecture

`authorized dataset → Source Access Registry → normalize/dedupe → source-side prescreen → bounded eBay verification queue → manual verified marketplace facts → [next] shipping + landed economics → BUY/WATCH/REJECT`

The existing dashboard bulk-upload UI is **not yet** wired to this governed pipeline. Backend contracts are being proven first so UI behavior cannot silently redefine business rules.

## Safety boundary

Slices 1–4 do not scrape supplier or marketplace sites, automate logged-in sessions, solve CAPTCHAs, rotate proxies, purchase inventory, place bids, publish listings, send messages, or spend money.

A real machine source can be added only after the exact API/feed/download rights are reviewed and recorded.

## Test

```bash
npm run test:run004:sourcing
```

The dedicated GitHub Actions workflow also reruns the existing Run 004 G4 tests and the DataScout Vite build to detect regressions.
