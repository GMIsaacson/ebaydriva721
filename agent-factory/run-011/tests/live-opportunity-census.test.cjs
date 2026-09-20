'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  safeJsonParse,
  candidateIdFor,
  normalizeCandidate,
  applyReview,
  mergeCandidates,
  dispositionCounts,
  nextTerritories,
} = require('../runtime/live-opportunity-census.cjs');

test('safeJsonParse accepts fenced strict JSON', () => {
  assert.deepEqual(safeJsonParse('```json\n{"ok":true}\n```'), { ok: true });
});

test('candidate identity is stable', () => {
  const a = candidateIdFor({ niche:'Inspection', customer:'Inspector', problem:'Annual reminders' });
  const b = candidateIdFor({ niche:'Inspection', customer:'Inspector', problem:'Annual reminders' });
  assert.equal(a, b);
  assert.match(a, /^OPP-[A-F0-9]{12}$/);
});

test('normalization drops invented evidence refs and blocks unsupported advance', () => {
  const territory = { id:'inspection', label:'Inspection' };
  const allowed = new Set(['https://example.com/evidence']);
  const candidate = normalizeCandidate({
    niche:'Inspection',
    customer:'Commercial inspector',
    problem:'Recurring annual service reminders are manual',
    evidenceRefs:['https://example.com/evidence','https://invented.invalid/x'],
    decision:'ADVANCE',
    confidence:80,
  }, territory, allowed, '2026-09-19T00:00:00Z');
  assert.deepEqual(candidate.evidenceRefs, ['https://example.com/evidence']);
  assert.equal(candidate.decision, 'ADVANCE');

  const unsupported = normalizeCandidate({
    niche:'Inspection',
    customer:'Commercial inspector',
    problem:'No evidence',
    evidenceRefs:['https://invented.invalid/x'],
    decision:'ADVANCE',
  }, territory, allowed, '2026-09-19T00:00:00Z');
  assert.equal(unsupported.decision, 'BLOCKED_EVIDENCE');
});

test('independent review can block an analyst advance', () => {
  const candidate = {
    candidateId:'OPP-ABCDEF123456',
    decision:'ADVANCE',
    evidenceRefs:['https://example.com'],
  };
  const [reviewed] = applyReview([candidate], {
    verdict:'PASS',
    acceptedCandidateIds:[],
    rejectedCandidateIds:['OPP-ABCDEF123456'],
    overrides:[{candidateId:'OPP-ABCDEF123456',decision:'BLOCKED_EVIDENCE',reason:'Thin evidence'}],
  });
  assert.equal(reviewed.reviewerStatus, 'FAIL');
  assert.equal(reviewed.decision, 'BLOCKED_EVIDENCE');
});

test('mergeCandidates retains prior and new evidence', () => {
  const merged = mergeCandidates(
    [{candidateId:'OPP-1', evidenceRefs:['https://a'], painEvidence:['a'], checkedAt:'old'}],
    [{candidateId:'OPP-1', evidenceRefs:['https://b'], painEvidence:['b'], checkedAt:'new'}]
  );
  assert.deepEqual(merged[0].evidenceRefs.sort(), ['https://a','https://b']);
  assert.equal(merged[0].firstCheckedAt, 'old');
});

test('disposition counts preserve rejects', () => {
  const counts = dispositionCounts([
    {decision:'ADVANCE'},
    {decision:'KILL'},
    {decision:'KILL'},
    {decision:'BLOCKED_EVIDENCE'},
  ]);
  assert.equal(counts.ADVANCE, 1);
  assert.equal(counts.KILL, 2);
  assert.equal(counts.BLOCKED_EVIDENCE, 1);
});

test('nextTerritories skips processed and respects retry ceiling', () => {
  const state = {
    coverage: {
      'construction-trades': {status:'PROCESSED', attempts:1},
      'hvac-plumbing-electrical': {status:'RETRY_EXECUTION', attempts:3},
    }
  };
  const selected = nextTerritories(state).map((x) => x.id);
  assert.ok(!selected.includes('construction-trades'));
  assert.ok(!selected.includes('hvac-plumbing-electrical'));
  assert.ok(selected.length > 0);
});
