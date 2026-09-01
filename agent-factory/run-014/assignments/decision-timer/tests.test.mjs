import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { calculateTotal, formatSeconds, decisionRationale, buildReceipt, TIMER_SECONDS } from '../../../../decision-timer-core.mjs';

const html = fs.readFileSync('index.html', 'utf8');
const css = fs.readFileSync('decision-timer.css', 'utf8');
const js = fs.readFileSync('decision-timer.js', 'utf8');

test('weighted totals are deterministic', () => {
  const criteria = [
    { weight: 3, a: 4, b: 3 },
    { weight: 4, a: 2, b: 4 },
    { weight: 2, a: 3, b: 2 },
  ];
  assert.equal(calculateTotal(criteria, 'a'), 26);
  assert.equal(calculateTotal(criteria, 'b'), 29);
});

test('timer formatter is bounded at zero', () => {
  assert.equal(TIMER_SECONDS, 180);
  assert.equal(formatSeconds(180), '03:00');
  assert.equal(formatSeconds(1), '00:01');
  assert.equal(formatSeconds(-4), '00:00');
});

test('receipt records explicit judgment', () => {
  const receipt = buildReceipt({ choiceKey: 'a', optionA: 'Build', optionB: 'Buy', totalA: 21, totalB: 24, timestamp: new Date('2026-09-01T00:00:00Z') });
  assert.match(receipt, /Decision: Build/);
  assert.match(receipt, /Build: 21/);
  assert.match(receipt, /Buy: 24/);
  assert.match(receipt, /against the weighted score by 3 points/);
  assert.match(decisionRationale('b', 21, 24), /led the weighted score by 3 points/);
});

test('shell contains exactly two options and three criteria', () => {
  assert.match(html, /id="option-a"/);
  assert.match(html, /id="option-b"/);
  assert.equal((html.match(/class="criterion-row"/g) || []).length, 3);
  assert.match(html, /id="start-timer"/);
  assert.match(html, /id="pause-timer"/);
  assert.match(html, /id="reset-timer"/);
  assert.equal((html.match(/data-choice=/g) || []).length, 2);
});

test('application has no network or persistence surface', () => {
  const source = `${html}\n${js}`;
  for (const forbidden of ['fetch(', 'XMLHttpRequest', 'WebSocket', 'localStorage', 'sessionStorage']) {
    assert.equal(source.includes(forbidden), false, `forbidden surface present: ${forbidden}`);
  }
  assert.equal(/https?:\/\//.test(html), false, 'external URL present in shell');
});

test('responsive and accessibility safeguards exist', () => {
  assert.match(css, /:focus-visible/);
  assert.match(css, /@media\(max-width:520px\)/);
  assert.match(css, /overflow-x:hidden/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(html, /aria-live="polite"/);
});
