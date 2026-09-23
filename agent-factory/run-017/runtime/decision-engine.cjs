'use strict';

const ALLOWED = new Set(['SPY', 'SPX', 'XSP']);
const SETUPS = new Set([
  'S001_FAILED_NEWS_BREAKDOWN',
  'S002_FAILED_NEWS_REVERSAL',
  'S003_OPENING_RANGE_RETEST',
  'S004_VWAP_RATES_CONFIRMATION',
  'S005_RANGE_MEAN_REVERSION'
]);

function clamp(n, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, n));
}

function asBool(v) { return v === true; }

function scoreCandidate(input) {
  const m = input.market || {};
  const c = input.candidate || {};
  const confirmations = c.confirmations || {};
  const vetoReasons = [];

  if (input.mode !== 'PAPER_ONLY' || input.liveRoutingRequested === true) vetoReasons.push('live-routing-requested');
  if (!ALLOWED.has(m.underlying)) vetoReasons.push('unsupported-underlying');
  if (!Number.isInteger(m.dte) || m.dte < 0 || m.dte > 5) vetoReasons.push('dte-out-of-range');
  if (!SETUPS.has(c.setupId)) vetoReasons.push('setup-not-in-library');
  if (!asBool(c.definedRisk)) vetoReasons.push('undefined-risk');
  if (!c.invalidation || !String(c.invalidation).trim()) vetoReasons.push('missing-invalidation');
  if (!c.exitPlan || !String(c.exitPlan).trim()) vetoReasons.push('missing-exit-plan');
  if (!Number.isFinite(c.maxLossPct) || c.maxLossPct > 0.5) vetoReasons.push('candidate-loss-over-limit');
  if (!Number.isFinite(m.dataAgeSeconds) || m.dataAgeSeconds > 60) vetoReasons.push('stale-market-data');
  if (m.dte === 0 && m.entryTimeEt && m.entryTimeEt >= '15:30') vetoReasons.push('late-0dte-entry');

  const requiredText = ['thesis', 'entryTrigger', 'invalidation', 'exitPlan', 'structure'];
  const completeFields = requiredText.filter(k => c[k] && String(c[k]).trim()).length;
  const completeness = (completeFields / requiredText.length) * 20;

  const confirmationKeys = Object.keys(confirmations);
  const trueConfirmations = confirmationKeys.filter(k => confirmations[k] === true).length;
  const confirmationScore = confirmationKeys.length ? (trueConfirmations / confirmationKeys.length) * 30 : 0;

  let regime = 0;
  if (c.regimeAligned === true) regime += 12;
  if (c.eventAligned === true) regime += 4;
  if (c.crossAssetAligned === true) regime += 4;

  let instrument = 0;
  if (c.liquid === true) instrument += 5;
  if (Number.isFinite(c.spreadPct) && c.spreadPct <= 8) instrument += 5;
  if (c.structure && c.definedRisk === true) instrument += 5;

  let risk = 0;
  if (c.definedRisk === true) risk += 4;
  if (c.invalidation) risk += 4;
  if (c.exitPlan) risk += 4;
  if (Number.isFinite(c.maxLossPct) && c.maxLossPct <= 0.5) risk += 3;

  const score = Math.round(clamp(completeness + confirmationScore + regime + instrument + risk));
  const riskGate = vetoReasons.length ? 'VETO' : 'PASS';
  const outcome = riskGate === 'PASS' && score >= 70 ? 'PAPER_CANDIDATE' : 'NO_TRADE';

  return {
    score,
    riskGate,
    outcome,
    vetoReasons,
    scoreBreakdown: {
      completeness: Math.round(completeness),
      confirmations: Math.round(confirmationScore),
      regime: Math.round(regime),
      instrument: Math.round(instrument),
      risk: Math.round(risk)
    }
  };
}

module.exports = { scoreCandidate };
