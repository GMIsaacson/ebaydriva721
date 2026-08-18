# DataScout Live Sourcing MVP — Slices 1–7

Run `DS-S2M-004` now has a permission-first sourcing path from owner-authorized product data to evidence-backed **BUY / WATCH / REJECT** decision support.

## Slice 1 — Source Access Registry
Every source/access route is registered GREEN, YELLOW or RED. Unknown or unclear machine access fails closed. Machine retrieval requires an explicitly approved API/feed/download mode, current rights evidence and an inactive kill switch. Owner upload does not grant machine-fetch rights.

## Slice 2 — Authorized product-data intake
Owner-attested UTF-8 CSV/JSON is normalized into canonical sourcing records: supplier/SKU, MPN, UPC/GTIN, brand, pack quantity, integer-cent cost, MOQ, inventory, weight/dimensions and provenance. Deterministic IDs/hashes, exact duplicate suppression, conflict REVIEW and invalid-row isolation are enforced. Default cap: 5,000 rows. Scale acceptance covers 600 records.

## Slice 3 — Deterministic source-side prescreen
The system applies explicit source-cost/outlay caps, stock-vs-MOQ checks, owner-excluded terms and identity/completeness scoring. Ambiguous title-only identity routes to REVIEW. Human marketplace verification is bounded to 100 candidates, default 50. Acceptance proves **600 eligible → 50 VERIFY + 550 DEFERRED** with no marketplace retrieval.

## Slice 4 — Manual eBay verification
A registered YELLOW/manual-only route captures current Product Research or completed-listing observations. Exact candidate identity, verifier, evidence reference, timestamp, observation window, sold units and sold price are required. Stale/future/uncertain evidence cannot advance; zero sold evidence rejects rather than inferring demand. Default freshness: 72 hours, hard maximum seven days. Automated eBay retrieval remains zero.

## Slice 5 — Shipping + authoritative economics
Fresh marketplace evidence is combined with sale quantity, inbound freight, packaging, current fee rate/fixed fee plus fee provenance, explicit risk reserve and current shipping evidence. Multiple shipping quotes use the conservative maximum. Marketplace and shipping freshness are rechecked at decision time. `datascout-landed-economics/1.0.0` remains the authoritative formula for profit, margin, ROI and break-even. Explicit owner thresholds produce BUY, WATCH or REJECT; missing/stale evidence yields BLOCKED/REVIEW/INCOMPLETE.

## Slice 6 — Authenticated Sourcing Workspace
DataScout now exposes the governed workflow at protected route `/sourcing`:

`authorized CSV/JSON → normalize/dedupe → source-side prescreen → ranked eBay verification queue → manual eBay evidence → fee/shipping evidence → BUY/WATCH/REJECT`

The browser-safe intake/prescreen and decision modules have parity tests against the authoritative CJS modules, including deterministic candidate IDs, dataset hashes, queue selection, economics output and stale-evidence behavior. The workspace performs zero supplier/eBay retrieval and zero external actions. Session data is currently local-only.

The old Resources profitability calculator was retired because it contained fixed marketplace/payment/shipping assumptions. Live Sourcing is the single evidence-backed profitability path.

## Slice 7 — Isolated sourcing Firestore data plane
A new emulator-only data plane defines `sourcingRuns` with controlled `candidates`, `verifications` and `decisions` subcollections. Security rules require a dedicated sourcing-operator claim, owner isolation, fixed Run 004 identity, zero external actions, zero spend, manual-only marketplace evidence, the locked economics version and BUY/WATCH/REJECT-only decision records. Extra action/credential fields and deletes are denied; unmatched/legacy collections remain default-denied.

The sourcing Firestore rules passed their allow/deny suite in the disposable emulator. **They are not deployed to production and must not replace the existing production rules without a separate reviewed integration.**

## Current architecture
`authorized dataset → access gate → normalize/dedupe → prescreen → bounded manual eBay verification → fresh fees/shipping → authoritative economics → BUY/WATCH/REJECT`

Application logic is usable in the authenticated browser workspace; persistence is proven only in the isolated Firestore emulator. The next decisive milestone is a **real owner-authorized 500+ product dataset** processed through the workspace, followed by manual verification of enough finalists to demonstrate useful complete decisions. Production persistence and any machine source connector remain separately gated.

## Safety boundary
No restricted scraping, logged-in marketplace automation, CAPTCHA/proxy circumvention, purchases, bids, messages, listing publication or money movement is enabled. No special eBay API approval is required for the current architecture.

## Test
```bash
npm run test:run004:sourcing
```

Dedicated CI also reruns the existing Run 004 G4 tests, builds DataScout and runs the isolated sourcing Firestore emulator security suite.
