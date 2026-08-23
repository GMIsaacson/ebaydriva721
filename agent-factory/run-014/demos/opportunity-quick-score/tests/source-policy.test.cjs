'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const combined = ['index.html', 'score.js', 'app.js', 'styles.css'].map(read).join('\n');

test('runtime contains no network APIs or remote resources', () => {
  for (const forbidden of ['fetch(', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'https://', 'http://']) {
    assert.equal(combined.includes(forbidden), false, `found forbidden runtime token: ${forbidden}`);
  }
});

test('runtime contains no persistence or dynamic code execution', () => {
  for (const forbidden of ['localStorage', 'sessionStorage', 'document.cookie', 'eval(', 'new Function']) {
    assert.equal(combined.includes(forbidden), false, `found forbidden runtime token: ${forbidden}`);
  }
});

test('opportunity name is rendered without HTML injection', () => {
  const app = read('app.js');
  assert.match(app, /opportunityLabel\.textContent = name/);
  assert.equal(app.includes('innerHTML'), false);
});

test('all five score controls have corresponding labels and outputs', () => {
  const html = read('index.html');
  for (const id of ['demand', 'speed', 'margin', 'automation', 'advantage']) {
    assert.match(html, new RegExp(`for="${id}"`));
    assert.match(html, new RegExp(`id="${id}"`));
    assert.match(html, new RegExp(`id="${id}-output"`));
  }
});

test('result region announces updates to assistive technology', () => {
  assert.match(read('index.html'), /aria-live="polite"/);
});
