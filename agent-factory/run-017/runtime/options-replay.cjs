'use strict';

const { priceSpread, roundTripPnl } = require('./cost-model.cjs');

function monthKey(isoOrDate) {
  const s = String(isoOrDate || '');
  return /^\d{4}-\d{2}/.test(s) ? s.slice(0, 7) : 'unknown';
}

function reverseLegs(legs) {
  return legs.map(l => ({ ...l, side: l.side === 'BUY' ? 'SELL' : 'BUY' }));
}

function evaluateEpisode(episode, config = {}) {
  if (!episode || !episode.entry || !episode.exit) throw new TypeError('episode entry and exit required');
  if (!(episode.maxLossUsd > 0)) throw new TypeError('episode.maxLossUsd must be positive');
  const mode = episode.executionMode || 'NBBO';
  const contracts = episode.contracts || 1;
  const entry = priceSpread({
    legs: episode.entry.legs,
    mode,
    contracts,
    config
  });
  if (!entry.fillable) {
    return { id: episode.id, setupId: episode.setupId, status: 'NO_FILL_ENTRY', reason: entry.reason };
  }

  const exitLegs = episode.exit.legs || reverseLegs(episode.entry.legs);
  const exit = priceSpread({
    legs: exitLegs,
    mode,
    contracts,
    config
  });
  if (!exit.fillable) {
    return { id: episode.id, setupId: episode.setupId, status: 'NO_FILL_EXIT', reason: exit.reason };
  }

  const rt = roundTripPnl({ entry, exit });
  const r = rt.pnlUsd / episode.maxLossUsd;
  return {
    id: episode.id,
    setupId: episode.setupId,
    date: episode.date,
    month: monthKey(episode.date),
    executionMode: mode,
    status: 'FILLED',
    pnlUsd: rt.pnlUsd,
    r,
    totalFeesUsd: rt.totalFeesUsd,
    entry,
    exit
  };
}

function summarizeFilled(results) {
  const rows = results.filter(r => r.status === 'FILLED' && Number.isFinite(r.r));
  const rs = rows.map(r => r.r);
  const sum = xs => xs.reduce((a, b) => a + b, 0);
  const grossWins = sum(rs.filter(r => r > 0));
  const grossLosses = Math.abs(sum(rs.filter(r => r < 0)));
  let equity = 0, peak = 0, maxDd = 0;
  for (const r of rs) { equity += r; peak = Math.max(peak, equity); maxDd = Math.max(maxDd, peak - equity); }
  const byMonth = {};
  for (const r of rows) byMonth[r.month] = (byMonth[r.month] || 0) + r.r;
  const positiveTotal = Object.values(byMonth).filter(v => v > 0).reduce((a, b) => a + b, 0);
  const bestMonth = Object.entries(byMonth).sort((a, b) => b[1] - a[1])[0] || null;
  return {
    attempted: results.length,
    filled: rows.length,
    noFill: results.length - rows.length,
    fillRatePct: results.length ? rows.length / results.length * 100 : 0,
    averageR: rows.length ? sum(rs) / rows.length : null,
    winRatePct: rows.length ? rs.filter(r => r > 0).length / rows.length * 100 : null,
    profitFactor: grossLosses > 0 ? grossWins / grossLosses : grossWins > 0 ? Infinity : 0,
    maxDrawdownR: maxDd,
    totalR: sum(rs),
    totalFeesUsd: sum(rows.map(r => r.totalFeesUsd || 0)),
    bestMonth: bestMonth ? { month: bestMonth[0], r: bestMonth[1] } : null,
    bestMonthContributionPct: bestMonth && positiveTotal > 0 ? Math.max(0, bestMonth[1]) / positiveTotal * 100 : null,
    monthlyR: byMonth
  };
}

function replayEpisodes(episodes, config = {}) {
  const results = episodes.map(e => evaluateEpisode(e, config));
  return { results, metrics: summarizeFilled(results) };
}

module.exports = { evaluateEpisode, replayEpisodes, summarizeFilled, reverseLegs, monthKey };
