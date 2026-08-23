const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { once } = require('node:events');
const { createApp } = require('../server.cjs');

const ROOT = path.resolve(__dirname, '..');
const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'registry.json'), 'utf8'));
const bootstrap = { work: [], approvals: [], history: [] };

async function withServer(fn, options = {}) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'work-control-test-'));
  const server = createApp({ dataDir, registry, bootstrap, workerToken: options.workerToken });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  try { await fn(`http://127.0.0.1:${port}`, dataDir); }
  finally { await new Promise((resolve) => server.close(resolve)); fs.rmSync(dataDir, { recursive: true, force: true }); }
}

async function jsonRequest(url, options) {
  const response = await fetch(url, options);
  const payload = await response.json();
  return { response, payload };
}

test('health reports queue-only mode and disabled worker API without token', async () => {
  await withServer(async (base) => {
    const { response, payload } = await jsonRequest(`${base}/api/v1/health`);
    assert.equal(response.status, 200);
    assert.equal(payload.status, 'ok');
    assert.equal(payload.mode, 'QUEUE_ONLY');
    assert.equal(payload.workerReceiptApi, 'disabled');
    assert.equal(payload.registryTeams, 13);
  });
});

test('state exposes full canonical registry and no Run 013', async () => {
  await withServer(async (base) => {
    const { payload } = await jsonRequest(`${base}/api/v1/state`);
    assert.equal(payload.connection.connected, true);
    assert.equal(payload.connection.mode, 'QUEUE_ONLY');
    assert.equal(payload.connection.executor, 'WAITING_WORKER');
    assert.equal(payload.teams.some((team) => team.runNumber === 13), false);
    assert.equal(payload.meta.reservedRuns.includes(13), true);
  });
});

test('POST command persists a real governed queued assignment without claiming execution', async () => {
  await withServer(async (base, dataDir) => {
    const created = await jsonRequest(`${base}/api/v1/commands`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ teamId: 'SW-PROD-014', instruction: 'Prepare a bounded internal architecture review', priority: 'high' })
    });
    assert.equal(created.response.status, 201);
    assert.equal(created.payload.status, 'QUEUED_GOVERNED');
    assert.equal(created.payload.command.executorState, 'WAITING_WORKER');
    assert.equal(created.payload.command.authorityCeiling.maxExternalActions, 0);
    assert.equal(created.payload.work.status, 'queued');
    const commandFile = path.join(dataDir, 'commands', `${created.payload.command.commandId}.json`);
    assert.equal(fs.existsSync(commandFile), true);

    const state = await jsonRequest(`${base}/api/v1/state`);
    const work = state.payload.work.find((item) => item.id === created.payload.command.commandId);
    assert.equal(work.source, 'control-ledger');
    assert.equal(work.status, 'queued');
    assert.match(work.result.detail, /does not claim execution/i);
  });
});

test('non-runnable operations core is rejected by command endpoint', async () => {
  await withServer(async (base) => {
    const result = await jsonRequest(`${base}/api/v1/commands`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ teamId: 'OPS-CORE-008', instruction: 'run directly', priority: 'normal' })
    });
    assert.equal(result.response.status, 400);
    assert.equal(result.payload.error, 'TEAM_NOT_RUNNABLE');
  });
});

test('worker receipt endpoint fails closed when no worker token is configured', async () => {
  await withServer(async (base) => {
    const result = await jsonRequest(`${base}/api/v1/worker/receipts`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ commandId: 'WC-EXAMPLE', terminalState: 'DELIVERED' })
    });
    assert.equal(result.response.status, 403);
    assert.equal(result.payload.error, 'WORKER_AUTH_REQUIRED');
  });
});

test('static UI is served with restrictive browser security headers', async () => {
  await withServer(async (base) => {
    const response = await fetch(`${base}/`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-security-policy'), /connect-src 'self'/);
    assert.equal(response.headers.get('x-frame-options'), 'DENY');
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.match(await response.text(), /Work Control/);
  });
});

test('authorized worker receipt still cannot exceed command authority ceiling', async () => {
  await withServer(async (base) => {
    const created = await jsonRequest(`${base}/api/v1/commands`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ teamId: 'SW-PROD-014', instruction: 'Perform internal test assignment', priority: 'normal' })
    });
    const result = await jsonRequest(`${base}/api/v1/worker/receipts`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-work-control-worker-token': 'test-worker-token' },
      body: JSON.stringify({ commandId: created.payload.command.commandId, terminalState: 'DELIVERED', externalActionsPerformed: 1, spendCents: 0, productionMutation: false })
    });
    assert.equal(result.response.status, 500);
    assert.equal(result.payload.error, 'EXTERNAL_AUTHORITY_EXCEEDED');
  }, { workerToken: 'test-worker-token' });
});
