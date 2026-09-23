'use strict';

function regularSession(bars) {
  return bars.filter(b => b.timeEt >= '09:30' && b.timeEt <= '16:00');
}

function groupByDay(bars) {
  const map = new Map();
  for (const b of bars) {
    if (!map.has(b.dateEt)) map.set(b.dateEt, []);
    map.get(b.dateEt).push(b);
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, rows]) => [date, regularSession(rows).sort((a, b) => a.timestampMs - b.timestampMs)]);
}

function findEpisode(date, bars, cfg) {
  const opening = bars.filter(b => b.timeEt >= '09:30' && b.timeEt < '10:00');
  if (opening.length < 5) return null;
  const orHigh = Math.max(...opening.map(b => b.high));
  const orLow = Math.min(...opening.map(b => b.low));
  const width = orHigh - orLow;
  if (!(width > 0)) return null;

  const candidates = bars.filter(b => b.timeEt >= '10:00' && b.timeEt <= cfg.lastBreakoutTimeEt);
  let breakoutIndex = -1;
  let direction = null;
  for (const b of candidates) {
    const i = bars.indexOf(b);
    if (b.high >= orHigh * (1 + cfg.breakoutBufferPct)) { breakoutIndex = i; direction = 'LONG'; break; }
    if (b.low <= orLow * (1 - cfg.breakoutBufferPct)) { breakoutIndex = i; direction = 'SHORT'; break; }
  }
  if (breakoutIndex < 0) return null;

  const endRetest = Math.min(bars.length - 1, breakoutIndex + cfg.maxRetestBars);
  let retestIndex = -1;
  for (let i = breakoutIndex + 1; i <= endRetest; i += 1) {
    const b = bars[i];
    if (direction === 'LONG') {
      const near = b.low <= orHigh * (1 + cfg.retestBandPct);
      if (near && b.close >= orHigh) { retestIndex = i; break; }
    } else {
      const near = b.high >= orLow * (1 - cfg.retestBandPct);
      if (near && b.close <= orLow) { retestIndex = i; break; }
    }
  }
  if (retestIndex < 0) return null;

  const entryBar = bars[retestIndex];
  const entry = entryBar.close;
  const stop = direction === 'LONG'
    ? orHigh - width * cfg.stopInsideRangeFraction
    : orLow + width * cfg.stopInsideRangeFraction;
  const risk = direction === 'LONG' ? entry - stop : stop - entry;
  if (!(risk > entry * cfg.minimumRiskPctOfPrice)) return null;
  const target = direction === 'LONG' ? entry + risk * cfg.targetR : entry - risk * cfg.targetR;

  let exit = null;
  let exitReason = 'TIME';
  let exitTimeEt = null;
  const later = bars.slice(retestIndex + 1).filter(b => b.timeEt <= cfg.timeExitEt);
  for (const b of later) {
    const stopHit = direction === 'LONG' ? b.low <= stop : b.high >= stop;
    const targetHit = direction === 'LONG' ? b.high >= target : b.low <= target;
    if (stopHit && targetHit) { exit = stop; exitReason = 'STOP_SAME_BAR_PESSIMISTIC'; exitTimeEt = b.timeEt; break; }
    if (stopHit) { exit = stop; exitReason = 'STOP'; exitTimeEt = b.timeEt; break; }
    if (targetHit) { exit = target; exitReason = 'TARGET'; exitTimeEt = b.timeEt; break; }
  }
  if (exit == null) {
    const last = later.at(-1) || entryBar;
    exit = last.close;
    exitTimeEt = last.timeEt;
  }

  const grossR = direction === 'LONG' ? (exit - entry) / risk : (entry - exit) / risk;
  const frictionUsdPerShare = entry * cfg.proxyRoundTripFrictionBps / 10000;
  const proxyNetR = grossR - frictionUsdPerShare / risk;

  return {
    setupId: 'S003_OPENING_RANGE_RETEST',
    evidenceTier: 'UNDERLYING_PROXY_ONLY',
    date,
    direction,
    openingRangeHigh: orHigh,
    openingRangeLow: orLow,
    openingRangePct: width / ((orHigh + orLow) / 2),
    entryTimeEt: entryBar.timeEt,
    entry,
    stop,
    target,
    exitTimeEt,
    exit,
    exitReason,
    grossR,
    proxyNetR
  };
}

function summarize(episodes) {
  const rs = episodes.map(e => e.proxyNetR).filter(Number.isFinite);
  if (!rs.length) return { episodes: 0, averageR: null, medianR: null, winRatePct: null, profitFactor: null, maxDrawdownR: null };
  const sorted = [...rs].sort((a, b) => a - b);
  const positives = rs.filter(r => r > 0).reduce((a, b) => a + b, 0);
  const negatives = Math.abs(rs.filter(r => r < 0).reduce((a, b) => a + b, 0));
  let equity = 0, peak = 0, maxDd = 0;
  for (const r of rs) { equity += r; peak = Math.max(peak, equity); maxDd = Math.max(maxDd, peak - equity); }
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  return {
    episodes: rs.length,
    averageR: rs.reduce((a, b) => a + b, 0) / rs.length,
    medianR: median,
    winRatePct: rs.filter(r => r > 0).length / rs.length * 100,
    profitFactor: negatives > 0 ? positives / negatives : positives > 0 ? Infinity : 0,
    maxDrawdownR: maxDd
  };
}

function splitChronologically(episodes) {
  const sorted = [...episodes].sort((a, b) => a.date.localeCompare(b.date));
  const n = sorted.length;
  const a = Math.floor(n * 0.60);
  const b = Math.floor(n * 0.80);
  return {
    development: sorted.slice(0, a),
    validation: sorted.slice(a, b),
    holdout: sorted.slice(b)
  };
}

function replayS003(bars, overrides = {}) {
  const cfg = {
    breakoutBufferPct: 0.0005,
    retestBandPct: 0.0010,
    maxRetestBars: 6,
    stopInsideRangeFraction: 0.25,
    minimumRiskPctOfPrice: 0.0005,
    targetR: 1.50,
    proxyRoundTripFrictionBps: 2,
    lastBreakoutTimeEt: '14:30',
    timeExitEt: '15:45',
    ...overrides
  };
  const days = groupByDay(bars);
  const episodes = [];
  for (const [date, dayBars] of days) {
    const e = findEpisode(date, dayBars, cfg);
    if (e) episodes.push(e);
  }
  const split = splitChronologically(episodes);
  return {
    setupId: 'S003_OPENING_RANGE_RETEST',
    evidenceTier: 'UNDERLYING_PROXY_ONLY',
    config: cfg,
    tradingDaysObserved: days.length,
    episodes,
    metrics: {
      all: summarize(episodes),
      development: summarize(split.development),
      validation: summarize(split.validation),
      holdout: summarize(split.holdout)
    }
  };
}

module.exports = { replayS003, summarize, splitChronologically, groupByDay, findEpisode };
