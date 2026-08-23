'use strict';

(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.OpportunityScore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const DIMENSIONS = Object.freeze([
    { key: 'demand', label: 'Demand', weight: 0.30 },
    { key: 'speed', label: 'Speed to cash', weight: 0.25 },
    { key: 'margin', label: 'Margin potential', weight: 0.20 },
    { key: 'automation', label: 'Automation fit', weight: 0.15 },
    { key: 'advantage', label: 'Competition advantage', weight: 0.10 }
  ]);

  function clampScore(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 1;
    return Math.min(10, Math.max(1, Math.round(n)));
  }

  function decisionFor(score) {
    if (score >= 75) return 'BUILD';
    if (score >= 55) return 'VALIDATE';
    return 'KILL';
  }

  function scoreOpportunity(input) {
    const values = {};
    let weighted = 0;

    for (const dimension of DIMENSIONS) {
      const value = clampScore(input && input[dimension.key]);
      values[dimension.key] = value;
      weighted += value * dimension.weight;
    }

    const score = Math.round(weighted * 10);
    const ranked = DIMENSIONS
      .map((dimension) => ({ ...dimension, value: values[dimension.key] }))
      .sort((a, b) => b.value - a.value || b.weight - a.weight);

    const strongest = ranked[0];
    const weakest = ranked[ranked.length - 1];
    const decision = decisionFor(score);

    return {
      score,
      decision,
      values,
      strongest: strongest.key,
      weakest: weakest.key,
      rationale: `${decision}: strongest signal is ${strongest.label} (${strongest.value}/10); weakest is ${weakest.label} (${weakest.value}/10).`
    };
  }

  return Object.freeze({ DIMENSIONS, clampScore, decisionFor, scoreOpportunity });
});
