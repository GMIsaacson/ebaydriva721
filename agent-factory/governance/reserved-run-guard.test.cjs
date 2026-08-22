'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const guard = require('./reserved-run-guard.cjs');

const reserved = [13];

test('Run 013 is blocked even when the path is otherwise structurally valid', () => {
  const result = guard.evaluate([
    { status: 'A', path: 'agent-factory/run-013/contracts/team-contract.json' },
  ], reserved);
  assert.equal(result.length, 1);
  assert.equal(result[0].runNumber, 13);
  assert.match(result[0].reason, /permanently reserved/);
});

test('Run 015 is not blocked by the reserved-number guard', () => {
  const result = guard.evaluate([
    { status: 'A', path: 'agent-factory/run-015/contracts/team-contract.json' },
  ], reserved);
  assert.equal(result.length, 0);
});

test('deleting historical Run 013 material is not blocked', () => {
  const result = guard.evaluate([
    { status: 'D', path: 'agent-factory/run-013/legacy.txt' },
  ], reserved);
  assert.equal(result.length, 0);
});

test('renamed target into Run 013 is blocked', () => {
  const result = guard.evaluate([
    { status: 'R', oldPath: 'agent-factory/run-015/team.json', path: 'agent-factory/run-013/team.json' },
  ], reserved);
  assert.equal(result.length, 1);
});
