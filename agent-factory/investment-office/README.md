# Factory Investment Office (FIO)

The Factory Investment Office is the Factory's long-horizon investment-intelligence capability. It separates autonomous research from capital authority: agents may discover, research, score, monitor, debate and recommend investments, but no workflow may place or authorize a trade.

## Committee

- **INV-000 — Investment Director**: synthesizes the committee, preserves dissent and issues the living decision memo.
- **INV-01 — Business Analyst**: business quality, moat, management and unit economics.
- **INV-02 — Valuation Analyst**: DCF, multiples, SOTP, scenarios and required-return discipline.
- **INV-03 — Bear / Red Team**: attacks the thesis and defines failure/kill criteria.
- **INV-04 — Market & Catalyst**: catalysts, timing, positioning and macro sensitivity.
- **INV-05 — Portfolio & Risk**: sizing, concentration, correlation and drawdown.
- **INV-06 — Long-Horizon Scout**: 5–15 year asymmetric opportunity discovery.
- **INV-07 — Monitor**: prices, filings, news and material thesis-change detection.

Required independent gates: **Q1 operational/calculation QA, Q2 evidence/provenance QA, Q3 professional-excellence QA**.

## Runtime architecture

`public/primary sources + market data → n8n → specialist agents → Q1/Q2/Q3 → INV-000 → Firebase → FIO UI → owner approval`

Firebase is the durable system of record under `factoryInvestmentOfficeV1/public`. The browser is read-only. n8n is the writer through a dedicated Google/Firebase service-account credential. Brokerage credentials and trade execution are outside FIO v1.

## Installed n8n workflows

The following workflow definitions are versioned under `agent-factory/investment-office/n8n/` and are installed in the Factory n8n instance:

- `FIOMONITORV1` — hourly portfolio/watchlist market monitor with material-move detection.
- `FIODAILYV1` — daily fresh-source thesis, valuation, catalyst and risk review.
- `FIORADARV1` — daily long-horizon opportunity discovery and ranking.
- `FIOCOMMITTEEV1` — independent specialist + Q1/Q2/Q3 committee, then INV-000 synthesis.
- `FIOBOOTSTRAPV1` — one-time Firebase seed/bootstrap workflow.

The five workflows remain **inactive until the two dedicated credentials are attached**:

1. `FIO Firebase Service Account` — Google API / Firestore service account scoped to the `salescope-7f11d` project.
2. `FIO OpenAI API` — HTTP Authorization credential for the OpenAI Responses API used by daily/radar/committee workflows.

This is intentional: inactive workflows are preferable to a stream of failed scheduled executions.

## Current first case

SpaceX / `SPCX` is the first living investment memo. The seed record is a starting thesis, not a substitute for the first live committee run. Once credentials are bound and Firebase is bootstrapped, FIO-COMMITTEE must refresh the seed against current evidence before the system treats it as current research.

## Capital-control invariant

- Research autonomy: **enabled**
- Monitoring autonomy: **enabled once runtime credentials are attached**
- Opportunity discovery autonomy: **enabled once runtime credentials are attached**
- Trade execution: **disabled**
- Capital action: **owner approval required**

No recommendation may silently become an order. Approval records may record an owner's decision, but FIO v1 contains no brokerage execution adapter.
