const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Core = require('../core.js');

const ROOT = path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(ROOT, name), 'utf8');

test('offline fallback stages locally and never claims execution', () => {
  const req = Core.createRunRequest({ teamId: 'SW-PROD-014', teamName: 'Software Product Engineering', instruction: 'Build a bounded internal demo', priority: 'high', now: '2026-08-23T03:01:00Z' });
  assert.equal(req.source, 'local-draft');
  assert.equal(req.status, 'queued');
  assert.equal(req.stages[1].state, 'blocked');
  assert.match(req.result.detail, /No Factory run was claimed/);
});

test('offline dispatch guard remains fail closed', () => {
  assert.deepEqual(Core.dispatchGuard(false), { allowed: false, reason: 'EXECUTION_ADAPTER_DISCONNECTED' });
  assert.deepEqual(Core.dispatchGuard(undefined), { allowed: false, reason: 'EXECUTION_ADAPTER_DISCONNECTED' });
  assert.deepEqual(Core.dispatchGuard(true), { allowed: true, reason: 'ADAPTER_CONNECTED' });
});

test('offline approval record cannot impersonate transmitted authority', () => {
  const approval = { id: 'A-1', title: 'Preview deploy', status: 'pending' };
  const { approval: updated, event } = Core.applyApproval(approval, 'approved', '2026-08-23T03:02:00Z');
  assert.equal(updated.transmitted, false);
  assert.match(event.detail, /not transmitted/i);
});

test('browser API client is same-origin only', () => {
  const client = read('api-client.js');
  assert.match(client, /startsWith\('\/api\/v1\/'\)/);
  assert.doesNotMatch(client, /https?:\/\//i);
  assert.doesNotMatch(client, /XMLHttpRequest|WebSocket|sendBeacon|EventSource/);
});

test('runtime has no dynamic code execution', () => {
  const runtime = ['core.js', 'api-client.js', 'app.js'].map(read).join('\n');
  assert.doesNotMatch(runtime, /\beval\s*\(|new\s+Function\s*\(/);
});

test('UI exposes the six required owner workflows', () => {
  const html = read('index.html');
  for (const label of ['Teams', 'Work', 'Approvals', 'History']) assert.match(html, new RegExp(`>${label}<`));
  assert.match(html, /Run team/i);
  const app = read('app.js');
  assert.match(app, /openWorkDetail/);
  assert.match(app, /decideApproval/);
  assert.match(app, /result/i);
});

test('canonical registry preserves the reserved Run 013 gap', () => {
  const registry = JSON.parse(read('registry.json'));
  const numbers = registry.teams.map((team) => team.runNumber);
  assert.deepEqual(registry.reservedRuns, [13]);
  assert.equal(new Set(numbers).size, numbers.length);
  assert.equal(numbers.includes(12), true);
  assert.equal(numbers.includes(13), false);
  assert.equal(numbers.includes(14), true);
});

test('pilot and operations core are not presented as runnable teams', () => {
  const registry = JSON.parse(read('registry.json'));
  assert.equal(registry.teams.find((team) => team.runNumber === 5).runnable, false);
  assert.equal(registry.teams.find((team) => team.runNumber === 8).runnable, false);
  assert.equal(registry.teams.find((team) => team.runNumber === 14).runnable, true);
});

test('registry is source-referenced rather than a new authority store', () => {
  const registry = JSON.parse(read('registry.json'));
  assert.match(registry.sourcePolicy, /not a new authority store/i);
  assert.equal(registry.teams.every((team) => /^https:\/\/app\.notion\.com\//.test(team.notionUrl)), true);
});

test('Factory v0.1 recovery anchor remains visible and development line explicit', () => {
  const html = read('index.html');
  const readme = read('README.md');
  assert.match(html, /v0\.1 recovery anchor preserved/);
  assert.match(readme, /develop\/factory-v0\.2/);
  assert.match(readme, /archive\/factory-v0\.1\.0/);
});

test('HTML provides responsive viewport and accessible drawer semantics', () => {
  const html = read('index.html');
  assert.match(html, /name="viewport"/);
  assert.match(html, /aria-hidden="true"/);
  assert.match(html, /aria-label="Work Control detail panel"/);
});

test('control API connection is visibly distinct from worker execution', () => {
  const html = read('index.html');
  const app = read('app.js');
  assert.match(html, /Control API checking/);
  assert.match(app, /executor waiting for a worker adapter/i);
  assert.match(app, /No terminal receipt yet|terminal receipt/i);
});
