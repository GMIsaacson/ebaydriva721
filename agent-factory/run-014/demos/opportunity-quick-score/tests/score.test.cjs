'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { clampScore, decisionFor, scoreOpportunity } = require('../score.js');

test('documented sample scores 76 and returns BUILD', () => {
  const result = scoreOpportunity({ demand: 8, speed: 7, margin: 8, automation: 9, advantage: 5 });
  assert.equal(result.score, 76);
  assert.equal(result.decision, 'BUILD');
  assert.equal(result.strongest, 'automation');
  assert.equal(result.weakest, 'advantage');
});

test('decision thresholds are exact', () => {
  assert.equal(decisionFor(75), 'BUILD');
  assert.equal(decisionFor(74), 'VALIDATE');
  assert.equal(decisionFor(55), 'VALIDATE');
  assert.equal(decisionFor(54), 'KILL');
});

test('all sixes produce a 60 VALIDATE result', () => {
  const result = scoreOpportunity({ demand: 6, speed: 6, margin: 6, automation: 6, advantage: 6 });
  assert.equal(result.score, 60);
  assert.equal(result.decision, 'VALIDATE');
});

test('all fives produce a 50 KILL result', () => {
  const result = scoreOpportunity({ demand: 5, speed: 5, margin: 5, automation: 5, advantage: 5 });
  assert.equal(result.score, 50);
  assert.equal(result.decision, 'KILL');
});

test('competition advantage contributes positively', () => {
  const weak = scoreOpportunity({ demand: 7, speed: 7, margin: 7, automation: 7, advantage: 1 });
  const strong = scoreOpportunity({ demand: 7, speed: 7, margin: 7, automation: 7, advantage: 10 });
  assert.equal(strong.score - weak.score, 9);
});

test('invalid inputs clamp safely to 1-10', () => {
  assert.equal(clampScore(-100), 1);
  assert.equal(clampScore(100), 10);
  assert.equal(clampScore('not-a-number'), 1);
  assert.equal(clampScore(7.6), 8);
});

test('scoring never mutates the caller input', () => {
  const input = Object.freeze({ demand: 8, speed: 7, margin: 8, automation: 9, advantage: 5 });
  assert.doesNotThrow(() => scoreOpportunity(input));
  assert.deepEqual(input, { demand: 8, speed: 7, margin: 8, automation: 9, advantage: 5 });
});
