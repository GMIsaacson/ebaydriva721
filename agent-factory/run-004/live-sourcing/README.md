# DataScout Live Sourcing MVP — Slices 1–2

This directory contains the permission-first foundation for Run `DS-S2M-004`.

## Slice 1 — Source Access Registry

Every source adapter must prove its access rights and exact access mode before DataScout may retrieve or process data. Unknown or unclear machine access fails closed.

Access classes:

- **GREEN** — the recorded access method is permitted for the exact use case. Machine retrieval still requires `machineFetchAllowed=true`, an approved machine access mode, recorded rights evidence, a current review, and an inactive kill switch.
- **YELLOW** — manual verification only. No automated retrieval.
- **RED** — blocked.

Approved modes: `owner_upload`, `manual_verification`, `official_api`, `licensed_feed`, `public_download`.

## Slice 2 — Authorized product-data intake

DataScout can now parse owner-authorized UTF-8 CSV and JSON datasets into one canonical sourcing record without contacting the underlying supplier website.

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

This is the backend intake contract. The existing dashboard bulk-upload UI is **not yet** promoted to this new governed pipeline; wiring the UI to this runtime is a later slice after the backend contract is green.

## Safety boundary

Slices 1–2 do not scrape supplier or marketplace sites, automate logged-in sessions, solve CAPTCHAs, rotate proxies, purchase inventory, place bids, publish listings, send messages, or spend money.

The initial registry contains an owner-authorized upload route, a manual eBay verification route, and a blocked template for unverified machine sources. A real machine source can be added only after the exact API/feed/download rights are reviewed and recorded.

## Test

```bash
npm run test:run004:sourcing
```

The dedicated GitHub Actions workflow also reruns the existing Run 004 G4 tests and the DataScout Vite build to detect regressions.
