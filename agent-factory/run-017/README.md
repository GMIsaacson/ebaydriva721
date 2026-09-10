# Run 017 — Short-Duration Index Trading Research

Run 017 is the Factory's bounded research and paper-trading team for SPY, SPX, and XSP options with 0–5 days to expiration.

## Objective

Prove or reject one repeatable short-duration index-options setup that retains positive out-of-sample expectancy after realistic spread, slippage, and execution assumptions.

## Current state

- Lifecycle: **G3 research build / paper-only**
- Live broker routing: **disabled**
- External trade authority: **none**
- Capital authority: **$0**
- Universe: **SPY, SPX, XSP; 0–5 DTE**
- Default output: **NO TRADE** unless a predefined setup and risk gate both pass

## Pipeline

Market/event data → normalization → regime classification → setup detection → options construction → independent risk veto → paper candidate → simulated execution → outcome capture → Q1/Q2/Q3 review → strategy statistics.

## Initial setup library

1. `S001_FAILED_NEWS_BREAKDOWN` — bad-news gap, failed rebound/VWAP reclaim, confirming rates/breadth, downside continuation.
2. `S002_FAILED_NEWS_REVERSAL` — bad news is absorbed, opening low holds, VWAP is reclaimed, confirming reversal.
3. `S003_OPENING_RANGE_RETEST` — opening-range break, controlled retest, trend continuation.
4. `S004_VWAP_RATES_CONFIRMATION` — VWAP rejection/reclaim aligned with Treasury-rate impulse and breadth.
5. `S005_RANGE_MEAN_REVERSION` — low-volatility, non-event regime only; fade statistically stretched range extremes.

## Professional disciplines

Run 017 separates macro/event interpretation, market structure, derivatives construction, quantitative research, data quality, risk, simulation/execution, and independent QA. A single generalist may not substitute for these disciplines at a professional gate.

## Promotion gates

Run 017 cannot progress toward live capital without all of the following:

- reproducible historical dataset and provenance;
- realistic transaction-cost model;
- walk-forward / time-split out-of-sample testing;
- minimum sample-size gate defined before result inspection;
- stable expectancy across materially different market regimes;
- maximum-drawdown and losing-streak analysis;
- paper/shadow execution evidence with timestamped decisions;
- independent Q1 operational, Q2 evidence/compliance, and Q3 professional-excellence PASS;
- explicit owner approval for any future broker connection or capital limit.

No file in this run grants broker or trading authority.
