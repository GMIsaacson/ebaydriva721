# DataScout Live Sourcing MVP — Slice 1

This directory contains the permission-first compliance foundation for Run `DS-S2M-004`.

## Current slice

**Slice 1: Source Access Registry + fail-closed policy gate.**

Every future source adapter must prove its access rights and exact access mode before DataScout is allowed to retrieve or process data. Unknown or unclear machine access fails closed.

## Access classes

- **GREEN** — the recorded access method is permitted for the exact use case. Machine retrieval still requires `machineFetchAllowed=true`, an approved machine access mode, recorded rights evidence, a current review, and an inactive kill switch.
- **YELLOW** — manual verification only. No automated retrieval.
- **RED** — blocked.

Approved modes: `owner_upload`, `manual_verification`, `official_api`, `licensed_feed`, `public_download`.

## Safety boundary

This slice does not fetch supplier or marketplace data. It does not scrape websites, automate logged-in sessions, solve CAPTCHAs, rotate proxies, purchase inventory, place bids, publish listings, send messages, or spend money.

The initial registry contains an owner-authorized upload route, a manual eBay verification route, and a blocked template for unverified machine sources. A real machine source can be added only after the exact API/feed/download rights are reviewed and recorded.

## Test

```bash
npm run test:run004:sourcing
```

The dedicated GitHub Actions workflow also reruns the existing Run 004 G4 tests and the DataScout Vite build to detect regressions.
