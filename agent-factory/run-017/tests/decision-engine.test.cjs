'use strict';
const assert = require('node:assert/strict');
const { scoreCandidate } = require('../runtime/decision-engine.cjs');

const good = {
  mode: 'PAPER_ONLY',
  market: { underlying: 'SPY', dte: 1, dataAgeSeconds: 4, entryTimeEt: '10:12' },
  candidate: {
    setupId: 'S001_FAILED_NEWS_BREAKDOWN',
    direction: 'bearish',
    thesis: 'Bad-news rebound fails at VWAP while rates and breadth confirm.',
    entryTrigger: 'Break of the post-rejection pivot low.',
    invalidation: 'Sustained VWAP reclaim.',
    exitPlan: 'Exit on invalidation or predefined paper target/time stop.',
    structure: '1DTE defined-risk put debit spread',
    definedRisk: true,
    maxLossPct: 0.25,
    confirmations: { price: true, vwap: true, rates: true, breadth: true },
    regimeAligned: true,
    eventAligned: true,
    crossAssetAligned: true,
    liquid: true,
    spreadPct: 4
  }
};

const pass = scoreCandidate(good);
assert.equal(pass.riskGate, 'PASS');
assert.equal(pass.outcome, 'PAPER_CANDIDATE');
assert.ok(pass.score >= 70);

const stale = structuredClone(good);
stale.market.dataAgeSeconds = 180;
const staleResult = scoreCandidate(stale);
assert.equal(staleResult.riskGate, 'VETO');
assert.ok(staleResult.vetoReasons.includes('stale-market-data'));
assert.equal(staleResult.outcome, 'NO_TRADE');

const live = structuredClone(good);
live.liveRoutingRequested = true;
const liveResult = scoreCandidate(live);
assert.equal(liveResult.riskGate, 'VETO');
assert.ok(liveResult.vetoReasons.includes('live-routing-requested'));

const undefinedRisk = structuredClone(good);
undefinedRisk.candidate.definedRisk = false;
const undefinedResult = scoreCandidate(undefinedRisk);
assert.equal(undefinedResult.riskGate, 'VETO');
assert.ok(undefinedResult.vetoReasons.includes('undefined-risk'));

const late0 = structuredClone(good);
late0.market.dte = 0;
late0.market.entryTimeEt = '15:45';
const lateResult = scoreCandidate(late0);
assert.equal(lateResult.riskGate, 'VETO');
assert.ok(lateResult.vetoReasons.includes('late-0dte-entry'));

console.log('Run 017 decision-engine tests: PASS');
