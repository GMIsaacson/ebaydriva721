'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { getChart } = require('../runtime/providers/yahoo-underlying.cjs');
const { replayS003 } = require('../runtime/underlying-proxy-s003.cjs');

function round(n, d = 4) {
  if (!Number.isFinite(n)) return n;
  const p = 10 ** d;
  return Math.round(n * p) / p;
}

function cleanMetrics(m) {
  return Object.fromEntries(Object.entries(m).map(([k, v]) => [k, Number.isFinite(v) ? round(v) : v]));
}

function gate(result) {
  const all = result.metrics.all;
  const holdout = result.metrics.holdout;
  if (all.episodes < 20 || holdout.episodes < 4) {
    return { status: 'INCONCLUSIVE', reason: 'insufficient-bootstrap-sample' };
  }
  if ((holdout.averageR ?? -Infinity) <= 0 || (holdout.profitFactor ?? 0) < 1.0) {
    return { status: 'KILL_BOOTSTRAP', reason: 'negative-or-subunit-holdout-edge' };
  }
  return { status: 'SURVIVES_BOOTSTRAP', reason: 'directional-proxy-cleared-minimum-gate' };
}

async function main() {
  const acquiredAt = new Date().toISOString();
  const source = await getChart({ symbol: 'SPY', range: '60d', interval: '5m' });
  if (source.bars.length < 100) throw new Error(`Too few SPY bars returned: ${source.bars.length}`);
  const replay = replayS003(source.bars);
  const decision = gate(replay);
  const dates = source.bars.map(b => b.dateEt).sort();

  const evidence = {
    schemaVersion: '1.0',
    generatedAt: acquiredAt,
    runId: 'SHORT-DURATION-INDEX-RESEARCH-017',
    setupId: replay.setupId,
    evidenceTier: 'UNDERLYING_PROXY_ONLY',
    qualificationMeaning: 'Directional sanity check only. This cannot establish options profitability or executable edge.',
    source: {
      provider: source.provider,
      symbol: source.symbol,
      interval: source.interval,
      requestedRange: source.range,
      bars: source.bars.length,
      firstDateEt: dates[0],
      lastDateEt: dates.at(-1),
      disclaimer: source.disclaimer
    },
    preregisteredConfig: replay.config,
    tradingDaysObserved: replay.tradingDaysObserved,
    gate: decision,
    metrics: {
      all: cleanMetrics(replay.metrics.all),
      development: cleanMetrics(replay.metrics.development),
      validation: cleanMetrics(replay.metrics.validation),
      holdout: cleanMetrics(replay.metrics.holdout)
    },
    episodes: replay.episodes.map(e => ({
      ...e,
      openingRangeHigh: round(e.openingRangeHigh),
      openingRangeLow: round(e.openingRangeLow),
      openingRangePct: round(e.openingRangePct, 6),
      entry: round(e.entry),
      stop: round(e.stop),
      target: round(e.target),
      exit: round(e.exit),
      grossR: round(e.grossR),
      proxyNetR: round(e.proxyNetR)
    }))
  };

  const out = process.env.RUN017_BOOTSTRAP_OUTPUT || 'run017-bootstrap-evidence.json';
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(evidence, null, 2));

  console.log('RUN017_BOOTSTRAP_SUMMARY=' + JSON.stringify({
    gate: decision.status,
    bars: source.bars.length,
    tradingDaysObserved: replay.tradingDaysObserved,
    episodes: replay.metrics.all.episodes,
    allAverageR: round(replay.metrics.all.averageR),
    holdoutEpisodes: replay.metrics.holdout.episodes,
    holdoutAverageR: round(replay.metrics.holdout.averageR),
    holdoutProfitFactor: round(replay.metrics.holdout.profitFactor),
    output: out
  }));
}

main().catch(err => {
  console.error('RUN017_BOOTSTRAP_ERROR', err?.stack || err);
  process.exit(1);
});
