'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { executableNbboPrice, priceSpread, roundTripPnl } = require('../runtime/cost-model.cjs');
const { replayS003 } = require('../runtime/underlying-proxy-s003.cjs');
const { replayEpisodes } = require('../runtime/options-replay.cjs');

function bar(dateEt, timeEt, open, high, low, close, volume = 1000) {
  return { dateEt, timeEt, open, high, low, close, volume, timestampMs: Date.parse(`${dateEt}T${timeEt}:00Z`) };
}

test('NBBO fill penalizes midpoint and rejects stale quotes', () => {
  const buy = executableNbboPrice({ side: 'BUY', bid: 1.00, ask: 1.10, ageSeconds: 0 });
  assert.equal(buy.fillable, true);
  assert.ok(buy.price > 1.05);
  const stale = executableNbboPrice({ side: 'SELL', bid: 1.00, ask: 1.10, ageSeconds: 5 });
  assert.equal(stale.fillable, false);
  assert.equal(stale.reason, 'stale-option-quote');
});

test('defined-risk spread round trip includes fees', () => {
  const entry = priceSpread({
    mode: 'NBBO', contracts: 1,
    legs: [
      { side: 'BUY', bid: 2.00, ask: 2.10, ageSeconds: 0 },
      { side: 'SELL', bid: 1.00, ask: 1.08, ageSeconds: 0 }
    ]
  });
  const exit = priceSpread({
    mode: 'NBBO', contracts: 1,
    legs: [
      { side: 'SELL', bid: 2.50, ask: 2.58, ageSeconds: 0 },
      { side: 'BUY', bid: 1.05, ask: 1.12, ageSeconds: 0 }
    ]
  });
  const rt = roundTripPnl({ entry, exit });
  assert.equal(rt.valid, true);
  assert.ok(rt.totalFeesUsd > 0);
  assert.ok(Number.isFinite(rt.pnlUsd));
});

test('generic options replay returns net R after spread and fees', () => {
  const replay = replayEpisodes([{
    id: 'E1', setupId: 'S001_FAILED_NEWS_BREAKDOWN', date: '2026-08-03',
    executionMode: 'NBBO', contracts: 1, maxLossUsd: 120,
    entry: { legs: [
      { side: 'BUY', bid: 2.00, ask: 2.10, ageSeconds: 0 },
      { side: 'SELL', bid: 0.90, ask: 1.00, ageSeconds: 0 }
    ]},
    exit: { legs: [
      { side: 'SELL', bid: 2.70, ask: 2.80, ageSeconds: 0 },
      { side: 'BUY', bid: 0.75, ask: 0.85, ageSeconds: 0 }
    ]}
  }]);
  assert.equal(replay.metrics.attempted, 1);
  assert.equal(replay.metrics.filled, 1);
  assert.ok(replay.results[0].r > 0);
  assert.ok(replay.metrics.totalFeesUsd > 0);
});

test('S003 replay detects a long break-retest and target', () => {
  const d = '2026-08-03';
  const bars = [
    bar(d,'09:30',100.00,100.20,99.90,100.10),
    bar(d,'09:35',100.10,100.25,100.00,100.20),
    bar(d,'09:40',100.20,100.30,100.10,100.25),
    bar(d,'09:45',100.25,100.28,100.05,100.10),
    bar(d,'09:50',100.10,100.22,99.95,100.15),
    bar(d,'09:55',100.15,100.26,100.02,100.20),
    bar(d,'10:00',100.20,100.55,100.18,100.48),
    bar(d,'10:05',100.48,100.52,100.29,100.36),
    bar(d,'10:10',100.36,101.00,100.34,100.95),
    bar(d,'10:15',100.95,101.30,100.90,101.20),
    bar(d,'15:45',101.20,101.25,101.15,101.20)
  ];
  const result = replayS003(bars, { breakoutBufferPct: 0.0005, targetR: 1.5 });
  assert.equal(result.episodes.length, 1);
  assert.equal(result.episodes[0].direction, 'LONG');
  assert.match(result.episodes[0].exitReason, /TARGET/);
  assert.ok(result.episodes[0].proxyNetR > 1);
});

test('S003 replay stays empty when there is no breakout', () => {
  const d = '2026-08-04';
  const bars = [
    bar(d,'09:30',100,100.2,99.8,100),
    bar(d,'09:35',100,100.2,99.9,100),
    bar(d,'09:40',100,100.2,99.9,100),
    bar(d,'09:45',100,100.2,99.9,100),
    bar(d,'09:50',100,100.2,99.9,100),
    bar(d,'09:55',100,100.2,99.9,100),
    bar(d,'10:00',100,100.19,99.91,100),
    bar(d,'10:05',100,100.18,99.92,100)
  ];
  const result = replayS003(bars);
  assert.equal(result.episodes.length, 0);
});
