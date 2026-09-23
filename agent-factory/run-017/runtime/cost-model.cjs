'use strict';

const DEFAULTS = Object.freeze({
  contractMultiplier: 100,
  commissionPerContractPerLegSideUsd: 0.70,
  nbboFillFractionOfHalfSpread: 0.50,
  extraSlippageCentsPerLeg: 1.0,
  maxQuoteAgeSeconds: 2,
  maxSpreadPctOfMid: 20,
  aggregatePenaltyPctOfPremium: 0.03,
  aggregateMinPenaltyUsdPerLeg: 0.02,
  aggregateMaxPenaltyUsdPerLeg: 0.12
});

function finite(n, name) {
  if (!Number.isFinite(n)) throw new TypeError(`${name} must be finite`);
  return n;
}

function round4(n) { return Math.round(n * 10000) / 10000; }

function validateQuote(q, cfg = DEFAULTS) {
  const bid = finite(q.bid, 'bid');
  const ask = finite(q.ask, 'ask');
  const age = finite(q.ageSeconds ?? 0, 'ageSeconds');
  if (bid < 0 || ask <= 0 || ask < bid) return { ok: false, reason: 'invalid-nbbo' };
  const mid = (bid + ask) / 2;
  const spread = ask - bid;
  const spreadPct = mid > 0 ? (spread / mid) * 100 : Infinity;
  if (age > cfg.maxQuoteAgeSeconds) return { ok: false, reason: 'stale-option-quote', mid, spread, spreadPct };
  if (spreadPct > cfg.maxSpreadPctOfMid) return { ok: false, reason: 'option-spread-too-wide', mid, spread, spreadPct };
  return { ok: true, mid, spread, spreadPct };
}

function executableNbboPrice({ side, bid, ask, ageSeconds = 0 }, overrides = {}) {
  const cfg = { ...DEFAULTS, ...overrides };
  const v = validateQuote({ bid, ask, ageSeconds }, cfg);
  if (!v.ok) return { fillable: false, reason: v.reason, ...v };
  const halfSpread = v.spread / 2;
  const spreadPenalty = halfSpread * cfg.nbboFillFractionOfHalfSpread;
  const extra = cfg.extraSlippageCentsPerLeg / 100;
  const px = side === 'BUY' ? v.mid + spreadPenalty + extra : v.mid - spreadPenalty - extra;
  return {
    fillable: true,
    price: round4(Math.max(0.01, px)),
    mid: round4(v.mid),
    spread: round4(v.spread),
    spreadPct: round4(v.spreadPct)
  };
}

function executableAggregatePrice({ side, referencePrice }, overrides = {}) {
  const cfg = { ...DEFAULTS, ...overrides };
  const ref = finite(referencePrice, 'referencePrice');
  if (ref <= 0) return { fillable: false, reason: 'invalid-aggregate-reference' };
  const penalty = Math.min(
    cfg.aggregateMaxPenaltyUsdPerLeg,
    Math.max(cfg.aggregateMinPenaltyUsdPerLeg, ref * cfg.aggregatePenaltyPctOfPremium)
  );
  return {
    fillable: true,
    price: round4(side === 'BUY' ? ref + penalty : Math.max(0.01, ref - penalty)),
    referencePrice: round4(ref),
    penalty: round4(penalty)
  };
}

function priceLeg(leg, mode, overrides) {
  if (mode === 'NBBO') return executableNbboPrice(leg, overrides);
  if (mode === 'AGGREGATE') return executableAggregatePrice(leg, overrides);
  throw new Error(`Unsupported execution mode: ${mode}`);
}

function priceSpread({ legs, mode = 'NBBO', contracts = 1, config = {} }) {
  const cfg = { ...DEFAULTS, ...config };
  if (!Array.isArray(legs) || legs.length < 1) throw new TypeError('legs required');
  if (!Number.isInteger(contracts) || contracts < 1) throw new TypeError('contracts must be a positive integer');

  let signedPremium = 0;
  const fills = [];
  for (const leg of legs) {
    const qty = Number.isInteger(leg.quantity) && leg.quantity > 0 ? leg.quantity : 1;
    const fill = priceLeg(leg, mode, cfg);
    if (!fill.fillable) return { fillable: false, reason: fill.reason, fills };
    const cashSign = leg.side === 'BUY' ? -1 : 1;
    signedPremium += cashSign * fill.price * qty;
    fills.push({ ...leg, ...fill, quantity: qty });
  }

  const totalLegContracts = legs.reduce((n, leg) => n + (leg.quantity || 1), 0) * contracts;
  const fees = totalLegContracts * cfg.commissionPerContractPerLegSideUsd;
  const premiumCashUsd = signedPremium * cfg.contractMultiplier * contracts;

  return {
    fillable: true,
    mode,
    contracts,
    premiumCashUsd: round4(premiumCashUsd),
    feesUsd: round4(fees),
    netCashUsd: round4(premiumCashUsd - fees),
    fills
  };
}

function roundTripPnl({ entry, exit }) {
  if (!entry?.fillable || !exit?.fillable) return { valid: false, reason: 'unfillable-round-trip' };
  const pnlUsd = entry.netCashUsd + exit.netCashUsd;
  return {
    valid: true,
    pnlUsd: round4(pnlUsd),
    totalFeesUsd: round4(entry.feesUsd + exit.feesUsd),
    executionModes: [entry.mode, exit.mode]
  };
}

module.exports = {
  DEFAULTS,
  validateQuote,
  executableNbboPrice,
  executableAggregatePrice,
  priceSpread,
  roundTripPnl
};
