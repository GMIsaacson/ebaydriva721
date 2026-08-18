# DataScout Live Sourcing MVP — Slices 1–3

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

The intake runtime:

- requires an explicit runtime owner attestation;
- passes the Source Access Registry before parsing;
- accepts field aliases for title, supplier, SKU, MPN, UPC/GTIN, brand, source cost, MOQ, availability, weight, dimensions, category, condition, currency, and source URL;
- stores money as integer cents;
- creates deterministic candidate IDs and product/offer identity keys;
- preserves file, row, rights-evidence, uploader, and observed-time provenance;
- suppresses exact duplicate offers;
- routes conflicting duplicates to review instead of selecting a value;
- isolates invalid rows rather than guessing missing economics;
- is bounded to 5,000 records by default and has acceptance coverage above 500 records;
- performs zero machine fetches, external actions, or spend.

## Slice 3 — Deterministic source-side prescreen

Normalized candidates can now be reduced to a bounded marketplace-verification queue before any eBay research occurs.

The prescreen:

- keeps the MVP at eBay US / USD;
- applies owner-controlled source-cost and minimum-order-outlay caps;
- rejects known stock below MOQ;
- supports deterministic owner-excluded terms;
- routes title-only identities to REVIEW rather than asking the operator to verify an ambiguous product;
- ranks eligible candidates using only source-side completeness and constraints: identity quality, weight/dimensions, availability, cost/outlay headroom, and source evidence;
- caps the human eBay verification queue at 100 and defaults to 50;
- marks otherwise eligible overflow candidates DEFERRED rather than pretending they are bad products;
- explicitly states that marketplace demand is still unknown at this stage;
- performs zero eBay fetches, machine retrieval, external actions, or spend.

The scale acceptance case proves that 600 eligible normalized records can be deterministically bounded to 50 VERIFY candidates with 550 DEFERRED records and no loss disguised as rejection.

## Current architecture

`authorized dataset → Source Access Registry → normalize/dedupe → source-side prescreen → bounded eBay verification queue → [next] verified marketplace facts → deterministic landed economics → BUY/WATCH/REJECT`

The existing dashboard bulk-upload UI is **not yet** wired to this governed pipeline. The backend contracts are being proven first so the UI does not become the source of business logic.

## Safety boundary

Slices 1–3 do not scrape supplier or marketplace sites, automate logged-in sessions, solve CAPTCHAs, rotate proxies, purchase inventory, place bids, publish listings, send messages, or spend money.

The initial registry contains an owner-authorized upload route, a manual eBay verification route, and a blocked template for unverified machine sources. A real machine source can be added only after the exact API/feed/download rights are reviewed and recorded.

## Test

```bash
npm run test:run004:sourcing
```

The dedicated GitHub Actions workflow also reruns the existing Run 004 G4 tests and the DataScout Vite build to detect regressions.
