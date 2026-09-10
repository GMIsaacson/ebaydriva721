# Run 017 — Short-Duration Index Trading Research

Run 017 is the Factory's bounded research and paper-trading team for SPY, SPX, and XSP options with 0–5 days to expiration.

## Objective

Prove or reject one repeatable short-duration index-options setup that retains positive out-of-sample expectancy after realistic spread, slippage, fees, latency, and no-fill assumptions.

## Current state — 2026-09-10

- Lifecycle: **historical qualification / paper-only**
- Live broker routing: **disabled**
- External trade authority: **none**
- Capital authority: **$0**
- Universe: **SPY, SPX, XSP; 0–5 DTE**
- Replay policy: **frozen before first performance result**
- Transaction-cost engine: **built and tested**
- Massive cloud historical-data adapter: **built; credentials/data entitlement not assumed**
- Real underlying bootstrap acquisition: **working**
- `S003_OPENING_RANGE_RETEST` v1: **KILLED**

### First real research result

The preregistered S003 v1 SPY 5-minute directional bootstrap ran on 60 recent sessions and found 50 eligible episodes. Results were negative: overall average `-0.1076R`; the 10-episode chronological holdout averaged `-0.1485R` with profit factor `0.7838`.

Per policy, S003 v1 is closed. We will not tune its thresholds after observing the result. A materially different opening-range hypothesis must be versioned and preregistered as S003 v2 before any new test.

This bootstrap uses the underlying as a directional proxy and therefore does **not** establish options profitability. Its purpose is to stop wasting deeper options-data research on a weak frozen signal.

## Pipeline

Market/event data → normalization → regime classification → setup detection → options construction → independent risk veto → paper candidate → simulated execution → outcome capture → Q1/Q2/Q3 review → strategy statistics.

## Initial setup library

1. `S001_FAILED_NEWS_BREAKDOWN` — **awaiting full data**; bad-news gap, failed rebound/VWAP reclaim, confirming rates/breadth, downside continuation.
2. `S002_FAILED_NEWS_REVERSAL` — **awaiting full data**; bad news is absorbed, opening low holds, VWAP is reclaimed, confirming reversal.
3. `S003_OPENING_RANGE_RETEST` v1 — **killed 2026-09-10**; opening-range break, controlled retest, trend continuation.
4. `S004_VWAP_RATES_CONFIRMATION` — **awaiting full data**; VWAP rejection/reclaim aligned with Treasury-rate impulse and breadth.
5. `S005_RANGE_MEAN_REVERSION` — **awaiting full data**; low-volatility, non-event regime only; fade statistically stretched range extremes.

## Historical qualification stack

- `config/replay-policy.json` — frozen chronological splits, minimum samples, kill gates, robustness checks, and promotion rules.
- `runtime/cost-model.cjs` — NBBO and minute-aggregate execution assumptions with spread penalties, slippage, stale-quote rejection, and per-leg fees.
- `runtime/options-replay.cjs` — generic multi-leg options episode P&L and R-multiple engine.
- `runtime/providers/massive.cjs` — cloud adapter for historical contracts, aggregates, and quotes when authorized data access is present.
- `runtime/providers/yahoo-underlying.cjs` — no-key unofficial bootstrap source used only for directional proxy research.
- `scripts/run-bootstrap-replay.cjs` — real-market S003 bootstrap runner and evidence generator.
- `evidence/bootstrap-s003-2026-09-10.json` — canonical S003 kill receipt.

## Professional disciplines

Run 017 separates macro/event interpretation, market structure, derivatives construction, quantitative research, data quality, risk, simulation/execution, and independent QA. A single generalist may not substitute for these disciplines at a professional gate.

## Promotion gates

Run 017 cannot progress toward live capital without all of the following:

- reproducible historical dataset and provenance;
- research-grade historical options execution data for final P&L claims;
- realistic transaction-cost model;
- walk-forward / chronological out-of-sample testing;
- minimum sample-size gate defined before result inspection;
- stable expectancy across materially different market regimes;
- maximum-drawdown and losing-streak analysis;
- sensitivity tests with worse fills, one-bar latency, parameter neighborhoods, removal of the best month, and removal of the top five trades;
- paper/shadow execution evidence with timestamped decisions;
- independent Q1 operational, Q2 evidence/compliance, and Q3 professional-excellence PASS;
- explicit owner approval for any future broker connection or capital limit.

No file in this run grants broker or trading authority.
