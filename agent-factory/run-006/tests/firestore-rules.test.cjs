'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

test('Run 006 Firestore emulator configuration is isolated and default-deny', () => {
  const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'firestore/firebase.g4.emulator.json'), 'utf8'));
  const rules = fs.readFileSync(path.join(ROOT, 'firestore/firestore.g4.emulator.rules'), 'utf8');
  assert.equal(config.firestore.rules, 'firestore.g4.emulator.rules');
  assert.equal(config.emulators.firestore.port, 8096);
  assert.match(rules, /allow read, write: if false;/);
  assert.doesNotMatch(rules, /if true/);
});
