'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  hoursOld,
  safeJsonParse,
  validateSignals,
  reviewerPass,
  makeBrief,
} = require('../runtime/live-ai-platform-slice.cjs');

test('hoursOld computes bounded freshness', () => {
  assert.equal(hoursOld('2026-09-05T00:00:00Z', '2026-09-05T06:00:00Z'), 6);
});

test('safeJsonParse accepts fenced JSON', () => {
  assert.deepEqual(safeJsonParse('```json\n{"ok":true}\n```'), { ok: true });
});

test('validateSignals rejects out-of-range values', () => {
  assert.equal(validateSignals({ novelty: 90, consequence: 80, confidence: 95, immediacy: 70, adoptionReadiness: 75, watchPriority: 88 }), true);
  assert.equal(validateSignals({ novelty: 101, consequence: 80, confidence: 95, immediacy: 70, adoptionReadiness: 75, watchPriority: 88 }), false);
});

test('independent reviewer threshold is fail closed', () => {
  const pass = { verdict: 'PASS', factuality: 96, evidenceSufficiency: 95, practitionerQuality: 90, unsupportedClaims: [], sameExecutionAsSpecialist: false };
  assert.equal(reviewerPass(pass), true);
  assert.equal(reviewerPass({ ...pass, unsupportedClaims: ['unsupported adoption claim'] }), false);
  assert.equal(reviewerPass({ ...pass, practitionerQuality: 79 }), false);
  assert.equal(reviewerPass({ ...pass, verdict: 'FAIL' }), false);
});

test('brief separates urgent, daily, and watchlist items and never authorizes delivery', () => {
  const accepted = [
    { event: { eventId: 'u', title: 'urgent', summary: 's', sources: [{ url: 'https://example.com/u' }], analysis: { significance: 'x' } }, gate: { decision: 'URGENT_ALERT', score: 90 } },
    { event: { eventId: 'd', title: 'daily', summary: 's', sources: [{ url: 'https://example.com/d' }], analysis: { significance: 'x' } }, gate: { decision: 'DAILY_BRIEF', score: 70 } },
    { event: { eventId: 'w', title: 'watch', summary: 's', sources: [{ url: 'https://example.com/w' }], analysis: { significance: 'x' } }, gate: { decision: 'WATCHLIST', score: 40 } },
  ];
  const brief = makeBrief(accepted);
  assert.equal(brief.urgentAlerts.length, 1);
  assert.equal(brief.dailyBrief.length, 1);
  assert.equal(brief.watchlist.length, 1);
  assert.equal(brief.notificationAuthorized, false);
  assert.equal(brief.publicationAuthorized, false);
});
