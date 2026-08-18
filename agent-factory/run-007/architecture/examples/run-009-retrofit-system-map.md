# A0 Retrofit System Map — Municipal Development Intelligence

**Architecture ID:** A0-MUNI-INTEL-001
**Opportunity / Need:** Municipal-development intelligence as a scalable commercial data product
**Owner:** Run 007
**Status:** PASS (retrofit / architecture amendment)

## 1. Ultimate outcome
Continuously detect public development signals, maintain canonical project intelligence, convert each project into relevant trade/customer opportunities, deliver useful intelligence to paying customers, learn from response/revenue, and propose controlled geographic/trade expansion.

## 2. End-to-end value chain
`Municipal/public sources → source observations/documents → canonical development project → project lifecycle/events → trade-specific opportunity lenses → customer matching → customer delivery → response/usefulness/payment evidence → retention/value review → expansion proposals`

## 3. Capability inventory
| Capability | Disposition | Owner / System |
|---|---|---|
| Public municipal source discovery/collection | EXISTING | Run 009 Team 1 |
| Document extraction / evidence | EXISTING | Run 009 Team 1 |
| Canonical project identity / dedupe / QA | PARTIAL; EXTEND | Run 009 + future canonical project store |
| Electrical relevance analysis | EXISTING | Run 009 Team 1 |
| Multi-trade opportunity generation | BUILD | Downstream Opportunity Team |
| Customer ICP/profile & matching | BUILD | Downstream Commercial Team |
| Customer delivery/history/dedupe | BUILD | Downstream Commercial Team |
| Response / willingness-to-pay capture | BUILD | Commercial validation/ops |
| Continuous project lifecycle/change monitoring | BUILD | Project Lifecycle capability |
| Geographic/trade expansion analysis | BUILD | Run 007 + Expansion Intelligence capability |
| Durable operational project graph/store | BUILD/REUSE infra | PostgreSQL/Operations Core patterns |
| Governance/approvals/health/recovery/cost | REUSE | Run 008 Operations Core + owner gates |
| Human control/Resume Here/KPIs | REUSE | Notion Master OS / Factory Runs |

## 4. Boundary map
### Run 009 Team 1 owns
- approved municipal source discovery and read-only collection;
- extraction of project signals/evidence;
- canonicalization/deduplication at the intelligence layer;
- project quality/evidence assessment;
- initial electrical opportunity analysis;
- production of a Canonical Project Package for downstream consumers.

### Run 009 Team 1 does not own
- unrestricted city/trade expansion;
- customer acquisition;
- autonomous outbound messaging;
- customer subscription/payment operations;
- multi-trade commercialization;
- full customer-specific matching/delivery history;
- global project graph/storage architecture;
- pricing/discount/refund authority.

## 5. Required handoff
### Team 1 → Downstream Opportunity/Commercial Team
Trigger: project reaches canonical QA threshold or monitored WATCH status suitable for downstream analysis.

Canonical Project Package minimum:
- projectId
- projectName/location/municipality
- project type/scale
- current stage
- observedAt/freshness
- project parties only when evidenced
- official source/evidence references
- confidence
- unresolved questions
- lifecycle status
- initial trade hypotheses (optional)

Failure path: incomplete/contradictory/stale packages return to Team 1 or human review; downstream team may not silently invent missing fields.

## 6. Canonical data/store map
Operational source of truth should become PostgreSQL (or equivalent durable relational store) for projects/events/opportunities/customers/deliveries. Notion remains governance/control plane, not bulk record storage.

Core entities:
`municipalities → sources → source_observations/documents → projects → project_events → organizations → trade_opportunities → customers → customer_matches → deliveries → responses → commercial_outcomes`

## 7. Recommended build sequence
1. Preserve/freeze Run 009 Team 1 at G6 pre-outreach checkpoint.
2. Build durable Canonical Project Store + Project Event model, reusing Run 008 controls.
3. Build Downstream Opportunity & Commercialization Team for multi-trade lenses, customer matching, delivery history, and commercial feedback.
4. Validate commercial demand using bounded outreach before broad expansion.
5. Build/activate continuous lifecycle monitoring and customer-specific feeds only after usefulness/payment evidence.
6. Add expansion intelligence; new cities/trades remain approval-gated.

## 8. Authority map
- Team 1: read/analyze/internal write/draft; external contact remains separately gated.
- Downstream team: may analyze/match/draft internally by default.
- Customer sends, purchases, paid data, pricing exceptions, subscriptions, and recurring production authority require explicit gates.
- Expansion agent may PROPOSE city/trade additions but cannot self-authorize them.

## 9. Scale paths
- Geography: Twin Cities pilot → Minnesota → selected metros.
- Trades: electrical → HVAC/plumbing/fire protection/low voltage/roofing/etc.
- Customers: contractors → suppliers/distributors/developers/other intelligence buyers where validated.
- Data: current leads → longitudinal development graph and market analytics.

All expansion dimensions require evidence and an approval decision; none are implicit in Team 1 authority.

## 10. Architecture lesson
Run 009's Team 1 was a correct component, but it was initially treated too close to the complete business. A0 would have identified the downstream Opportunity/Commercialization Team, canonical operational store, lifecycle capability, customer matching/delivery layer, and expansion governance before Team 1 entered G0.

## 11. A0 decision
**PASS — as retrofit architecture amendment.**

Future G0 framing for downstream work:
> Given the approved Municipal Development Intelligence System Map, build/validate the downstream Opportunity & Commercialization component without expanding Team 1's authority or duplicating source intelligence.
