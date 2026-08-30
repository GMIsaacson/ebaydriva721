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
const TOKEN = 'test-worker-token';

async function withServer(fn, options = {}) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'work-control-test-'));
  const server = createApp({ dataDir, registry, bootstrap, workerToken: options.workerToken });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  try { await fn(`http://127.0.0.1:${port}`, dataDir); }
  finally { await new Promise((resolve) => server.close(resolve)); fs.rmSync(dataDir, { recursive: true, force: true }); }
}

async function jsonRequest(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  return { response, payload };
}

function workerPost(base, pathName, body = {}) {
  return jsonRequest(`${base}${pathName}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-work-control-worker-token': TOKEN }, body: JSON.stringify(body) });
}

async function createCommand(base, instruction = 'Prepare a bounded internal architecture review') {
  return jsonRequest(`${base}/api/v1/commands`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ teamId: 'SW-PROD-014', instruction, priority: 'high' })
  });
}

test('health reports queue-only mode and disabled worker API without token', async () => {
  await withServer(async (base) => {
    const { response, payload } = await jsonRequest(`${base}/api/v1/health`);
    assert.equal(response.status, 200);
    assert.equal(payload.status, 'ok');
    assert.equal(payload.mode, 'QUEUE_ONLY');
    assert.equal(payload.workerReceiptApi, 'disabled');
    assert.equal(payload.workerOnline, false);
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

test('POST command persists a real governed assignment with two-cent model budget', async () => {
  await withServer(async (base, dataDir) => {
    const created = await createCommand(base);
    assert.equal(created.response.status, 201);
    assert.equal(created.payload.status, 'QUEUED_GOVERNED');
    assert.equal(created.payload.command.executorState, 'WAITING_WORKER');
    assert.equal(created.payload.command.authorityCeiling.maxExternalActions, 0);
    assert.equal(created.payload.command.modelBudgetCents, 2);
    assert.equal(created.payload.work.status, 'queued');
    const commandFile = path.join(dataDir, 'commands', `${created.payload.command.commandId}.json`);
    assert.equal(fs.existsSync(commandFile), true);
  });
});

test('non-runnable operations core is rejected by command endpoint', async () => {
  await withServer(async (base) => {
    const result = await jsonRequest(`${base}/api/v1/commands`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ teamId: 'OPS-CORE-008', instruction: 'run directly', priority: 'normal' })
    });
    assert.equal(result.response.status, 400);
    assert.equal(result.payload.error, 'TEAM_NOT_RUNNABLE');
  });
});

test('worker routes fail closed when no worker token is configured', async () => {
  await withServer(async (base) => {
    const result = await jsonRequest(`${base}/api/v1/worker/next`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    assert.equal(result.response.status, 403);
    assert.equal(result.payload.error, 'WORKER_AUTH_REQUIRED');
  });
});

test('heartbeat makes worker visibly online without exposing it publicly', async () => {
  await withServer(async (base) => {
    const heartbeat = await workerPost(base, '/api/v1/worker/heartbeat', { workerId: 'factory-worker-v1', model: 'gpt-5.6-luna', state: 'ONLINE' });
    assert.equal(heartbeat.response.status, 200);
    const state = await jsonRequest(`${base}/api/v1/state`);
    assert.equal(state.payload.connection.mode, 'GOVERNED_WORKER');
    assert.equal(state.payload.connection.executor, 'ONLINE');
  }, { workerToken: TOKEN });
});

test('worker atomically claims a pending command exactly once', async () => {
  await withServer(async (base, dataDir) => {
    const created = await createCommand(base, 'Run a bounded claim test');
    const first = await workerPost(base, '/api/v1/worker/next', { workerId: 'factory-worker-v1' });
    assert.equal(first.payload.status, 'CLAIMED');
    assert.equal(first.payload.command.commandId, created.payload.command.commandId);
    assert.equal(fs.existsSync(path.join(dataDir, 'claims', `${created.payload.command.commandId}.json`)), true);
    const second = await workerPost(base, '/api/v1/worker/next', { workerId: 'factory-worker-v1' });
    assert.equal(second.payload.status, 'IDLE');
    const state = await jsonRequest(`${base}/api/v1/state`);
    assert.equal(state.payload.work.find((w) => w.id === created.payload.command.commandId).status, 'running');
  }, { workerToken: TOKEN });
});

test('receipt requires a prior atomic claim', async () => {
  await withServer(async (base) => {
    const created = await createCommand(base, 'Receipt claim guard');
    const result = await workerPost(base, '/api/v1/worker/receipts', { commandId: created.payload.command.commandId, terminalState: 'DELIVERED', externalActionsPerformed: 0, spendCents: 0, modelExecution: { estimatedCostCents: 0.5 } });
    assert.equal(result.response.status, 409);
    assert.equal(result.payload.error, 'CLAIM_REQUIRED');
  }, { workerToken: TOKEN });
});

test('authorized worker receipt still cannot exceed command external authority ceiling', async () => {
  await withServer(async (base) => {
    const created = await createCommand(base, 'Perform internal test assignment');
    await workerPost(base, '/api/v1/worker/next', { workerId: 'factory-worker-v1' });
    const result = await workerPost(base, '/api/v1/worker/receipts', { commandId: created.payload.command.commandId, terminalState: 'DELIVERED', externalActionsPerformed: 1, spendCents: 0, productionMutation: false, modelExecution: { estimatedCostCents: 0.5 } });
    assert.equal(result.response.status, 500);
    assert.equal(result.payload.error, 'EXTERNAL_AUTHORITY_EXCEEDED');
  }, { workerToken: TOKEN });
});

test('authorized worker receipt cannot exceed model budget', async () => {
  await withServer(async (base) => {
    const created = await createCommand(base, 'Perform internal model budget test');
    await workerPost(base, '/api/v1/worker/next', { workerId: 'factory-worker-v1' });
    const result = await workerPost(base, '/api/v1/worker/receipts', { commandId: created.payload.command.commandId, terminalState: 'DELIVERED', externalActionsPerformed: 0, spendCents: 0, productionMutation: false, modelExecution: { estimatedCostCents: 2.1 } });
    assert.equal(result.response.status, 500);
    assert.equal(result.payload.error, 'MODEL_BUDGET_EXCEEDED');
  }, { workerToken: TOKEN });
});

test('bounded claimed receipt completes assignment and duplicate receipt is rejected', async () => {
  await withServer(async (base) => {
    const created = await createCommand(base, 'Complete safely');
    await workerPost(base, '/api/v1/worker/next', { workerId: 'factory-worker-v1' });
    const receipt = { commandId: created.payload.command.commandId, terminalState: 'DELIVERED', summary: 'Completed safely', detail: 'Reasoning-only assignment completed.', steps: [{ name: 'Analysis', detail: 'Reasoned from supplied instructions.' }], externalActionsPerformed: 0, spendCents: 0, productionMutation: false, modelExecution: { estimatedCostCents: 0.5 } };
    const result = await workerPost(base, '/api/v1/worker/receipts', receipt);
    assert.equal(result.response.status, 201);
    assert.equal(result.payload.work.status, 'completed');
    const duplicate = await workerPost(base, '/api/v1/worker/receipts', receipt);
    assert.equal(duplicate.response.status, 409);
    assert.equal(duplicate.payload.error, 'RECEIPT_ALREADY_EXISTS');
  }, { workerToken: TOKEN });
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
