# Factory Investment Office (FIO)

FIO is the Factory's long-horizon investment intelligence capability. It is designed as an evidence-driven investment committee, not a single stock-picking agent.

## Operating model

1. **INV-06 Scout** finds candidates and compares them with the current watchlist leader.
2. **INV-01 Business Analyst** evaluates business quality and competitive durability.
3. **INV-02 Valuation Analyst** produces independent bear/base/bull valuation cases and expected-return ranges.
4. **INV-03 Bear / Red Team** tries to falsify the thesis and defines kill criteria.
5. **INV-04 Market & Catalyst Analyst** tracks timing-sensitive developments.
6. **INV-05 Portfolio & Risk** determines sizing and portfolio fit.
7. **INV-000 Investment Director** synthesizes the evidence into a living memo and explicit next action.
8. **INV-07 Monitor** watches owned/watchlist assets for material thesis changes and requests refreshes when required.

## Capital-control rule

Research may be autonomous. Trade execution is never autonomous. Any capital action requires an explicit owner approval gate.

## QA gates

- **Q1 Operational QA:** schemas, calculations, state transitions, retries, tests, and runtime behavior.
- **Q2 Evidence QA:** freshness, provenance, claim strength, source contradictions, and calculation traceability.
- **Q3 Professional Excellence QA:** whether the memo would meet a strong professional investment-research standard.

## Living investment record

Each asset maintains:

- thesis and anti-thesis
- evidence with source/freshness metadata
- business-quality score
- valuation range and scenario assumptions
- expected return / hurdle-rate comparison
- buy / hold / wait / reduce decision
- DCA policy and position-size range
- catalyst map
- risk map
- kill criteria
- decision history
- material thesis changes
- explicit next action and accountable agent

## MVP status

The `/investment-office` React surface is the initial operator UI. It includes SpaceX as the first committee case, a ranked watchlist, opportunity radar, research queue, agent committee, living memo, required dissent, and capital approval controls.

The next runtime layer is:

`market/source adapters -> evidence store -> specialist agents -> Q1/Q2/Q3 -> INV-000 -> living memo -> monitor loop`

The UI deliberately labels the live market-data adapter as pending until a verified data feed is connected.
