'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const Core = require('./server-core.cjs');

const ROOT = __dirname;
const DEFAULT_DATA_DIR = path.join(ROOT, 'runtime-data');
const MAX_BODY_BYTES = 64 * 1024;
const WORKER_ONLINE_MS = 30_000;
const STATIC_FILES = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ['/core.js', ['core.js', 'application/javascript; charset=utf-8']],
  ['/api-client.js', ['api-client.js', 'application/javascript; charset=utf-8']],
  ['/app.js', ['app.js', 'application/javascript; charset=utf-8']]
]);

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

function ensureDirs(dataDir) {
  for (const name of ['commands', 'receipts', 'approvals', 'claims']) fs.mkdirSync(path.join(dataDir, name), { recursive: true });
  const ledger = path.join(dataDir, 'events.jsonl');
  if (!fs.existsSync(ledger)) fs.writeFileSync(ledger, '');
}

function atomicWriteJson(file, value) {
  const dir = path.dirname(file);
  fs.mkdirSync(dir, { recursive: true });
  const temp = `${file}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
  fs.renameSync(temp, file);
}

function replaceJson(file, value) {
  const temp = `${file}.next-${process.pid}-${Date.now()}`;
  fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
  fs.renameSync(temp, file);
}

function appendEvent(dataDir, event) {
  fs.appendFileSync(path.join(dataDir, 'events.jsonl'), `${JSON.stringify(event)}\n`);
}

function readEvents(dataDir) {
  try {
    return fs.readFileSync(path.join(dataDir, 'events.jsonl'), 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line));
  } catch { return []; }
}

function listJson(dir) {
  try {
    return fs.readdirSync(dir).filter((name) => name.endsWith('.json')).sort().map((name) => readJson(path.join(dir, name), null)).filter(Boolean);
  } catch { return []; }
}

function commandFile(dataDir, id) { return path.join(dataDir, 'commands', `${Core.safeId(id)}.json`); }
function receiptFile(dataDir, id) { return path.join(dataDir, 'receipts', `${Core.safeId(id)}.json`); }
function approvalFile(dataDir, id) { return path.join(dataDir, 'approvals', `${Core.safeId(id)}.json`); }
function claimFile(dataDir, id) { return path.join(dataDir, 'claims', `${Core.safeId(id)}.json`); }
function workerStatusFile(dataDir) { return path.join(dataDir, 'worker-status.json'); }

function json(res, status, payload, extraHeaders = {}) {
  const body = `${JSON.stringify(payload)}\n`;
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
    ...extraHeaders
  });
  res.end(body);
}

function securityHeaders(res) {
  res.setHeader('x-content-type-options', 'nosniff');
  res.setHeader('x-frame-options', 'DENY');
  res.setHeader('referrer-policy', 'no-referrer');
  res.setHeader('content-security-policy', "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('BODY_TOO_LARGE'), { statusCode: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); }
      catch { reject(Object.assign(new Error('INVALID_JSON'), { statusCode: 400 })); }
    });
    req.on('error', reject);
  });
}

function workerAuthorized(req, workerToken) {
  if (!workerToken) return false;
  const supplied = String(req.headers['x-work-control-worker-token'] || '');
  if (supplied.length !== workerToken.length) return false;
  try { return require('crypto').timingSafeEqual(Buffer.from(supplied), Buffer.from(workerToken)); } catch { return false; }
}

function workerOnline(dataDir, now = Date.now()) {
  const status = readJson(workerStatusFile(dataDir), null);
  if (!status?.at) return false;
  const age = now - new Date(status.at).getTime();
  return Number.isFinite(age) && age >= 0 && age <= WORKER_ONLINE_MS;
}

function buildState({ dataDir, registry, bootstrap }) {
  const commands = listJson(path.join(dataDir, 'commands'));
  const receipts = new Map(listJson(path.join(dataDir, 'receipts')).map((receipt) => [receipt.commandId, receipt]));
  const claims = new Map(listJson(path.join(dataDir, 'claims')).map((claim) => [claim.commandId, claim]));
  const runtimeWork = commands.map((command) => Core.commandToWork(
    command,
    receipts.get(command.commandId) || null,
    claims.has(command.commandId) && !receipts.has(command.commandId) ? 'CLAIMED' : null
  ));
  const approvals = listJson(path.join(dataDir, 'approvals'));
  const runtimeHistory = readEvents(dataDir).map((event) => ({
    id: event.eventId,
    at: event.at,
    title: event.title,
    detail: event.detail,
    type: event.type || 'control'
  }));
  const online = workerOnline(dataDir);
  return {
    schemaVersion: '1.0',
    connection: { connected: true, mode: online ? 'GOVERNED_WORKER' : 'QUEUE_ONLY', executor: online ? 'ONLINE' : 'WAITING_WORKER', persistent: true },
    meta: {
      product: 'Work Control',
      version: '1.1.0-governed-worker',
      registryAsOf: registry.asOf,
      reservedRuns: registry.reservedRuns,
      recoveryBaseline: '37392d74728a44c3e502959c09e6400de40b846e'
    },
    teams: registry.teams,
    work: [...runtimeWork, ...(bootstrap.work || [])],
    approvals: [...approvals, ...(bootstrap.approvals || [])],
    history: [...runtimeHistory, ...(bootstrap.history || [])]
  };
}

function eventForCommand(command) {
  return {
    eventId: `EV-${command.commandId}-QUEUED`,
    at: command.requestedAt,
    type: 'command',
    title: 'Governed team assignment queued',
    detail: `${command.team.name}: ${command.instruction}. Integrity ${command.integritySha256.slice(0, 12)}…; model budget ${command.modelBudgetCents}¢; zero external authority.`
  };
}

function sortPendingCommands(commands) {
  const order = { urgent: 0, high: 1, normal: 2, low: 3 };
  return commands.slice().sort((a, b) => (order[a.priority] ?? 9) - (order[b.priority] ?? 9) || String(a.requestedAt).localeCompare(String(b.requestedAt)));
}

function claimNext(dataDir, workerId) {
  const receipts = new Set(listJson(path.join(dataDir, 'receipts')).map((r) => r.commandId));
  const claims = new Set(listJson(path.join(dataDir, 'claims')).map((c) => c.commandId));
  for (const command of sortPendingCommands(listJson(path.join(dataDir, 'commands')))) {
    if (receipts.has(command.commandId) || claims.has(command.commandId)) continue;
    if (!Core.verifyCommand(command)) continue;
    const claim = { schemaVersion: '1.0', commandId: command.commandId, workerId, state: 'CLAIMED', claimedAt: new Date().toISOString() };
    try {
      fs.writeFileSync(claimFile(dataDir, command.commandId), `${JSON.stringify(claim, null, 2)}\n`, { flag: 'wx' });
      appendEvent(dataDir, { eventId: `EV-${command.commandId}-CLAIMED`, at: claim.claimedAt, type: 'worker', title: 'Team assignment claimed', detail: `${command.team.name} assignment claimed by governed worker ${workerId}.` });
      return { command, claim };
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
  }
  return null;
}

function createApp(options = {}) {
  const dataDir = path.resolve(options.dataDir || process.env.WORK_CONTROL_DATA_DIR || DEFAULT_DATA_DIR);
  const registry = options.registry || readJson(path.join(ROOT, 'registry.json'), { teams: [], reservedRuns: [13], asOf: null });
  const bootstrap = options.bootstrap || readJson(path.join(ROOT, 'bootstrap-state.json'), { work: [], approvals: [], history: [] });
  const workerToken = options.workerToken !== undefined ? options.workerToken : process.env.WORK_CONTROL_WORKER_TOKEN;
  ensureDirs(dataDir);

  return http.createServer(async (req, res) => {
    securityHeaders(res);
    const url = new URL(req.url, 'http://localhost');
    const pathname = url.pathname;

    try {
      if (req.method === 'GET' && pathname === '/api/v1/health') {
        return json(res, 200, { status: 'ok', mode: workerOnline(dataDir) ? 'GOVERNED_WORKER' : 'QUEUE_ONLY', workerReceiptApi: workerToken ? 'enabled' : 'disabled', workerOnline: workerOnline(dataDir), registryTeams: registry.teams.length });
      }
      if (req.method === 'GET' && pathname === '/api/v1/state') {
        return json(res, 200, buildState({ dataDir, registry, bootstrap }));
      }
      if (req.method === 'POST' && pathname === '/api/v1/commands') {
        const body = await readBody(req);
        const command = Core.createCommand({ registry, teamId: body.teamId, instruction: body.instruction, priority: body.priority || 'normal' });
        atomicWriteJson(commandFile(dataDir, command.commandId), command);
        appendEvent(dataDir, eventForCommand(command));
        return json(res, 201, { status: 'QUEUED_GOVERNED', command, work: Core.commandToWork(command) });
      }
      if (req.method === 'GET' && pathname.startsWith('/api/v1/commands/')) {
        const id = Core.safeId(pathname.slice('/api/v1/commands/'.length));
        const command = readJson(commandFile(dataDir, id), null);
        if (!command) return json(res, 404, { error: 'COMMAND_NOT_FOUND' });
        const receipt = readJson(receiptFile(dataDir, id), null);
        const claim = readJson(claimFile(dataDir, id), null);
        return json(res, 200, { command, receipt, claim, work: Core.commandToWork(command, receipt, claim && !receipt ? 'CLAIMED' : null) });
      }
      if (req.method === 'POST' && /^\/api\/v1\/approvals\/[A-Za-z0-9._-]+\/decision$/.test(pathname)) {
        const id = Core.safeId(pathname.split('/')[4]);
        const current = readJson(approvalFile(dataDir, id), null);
        if (!current) return json(res, 404, { error: 'APPROVAL_NOT_FOUND' });
        const body = await readBody(req);
        const decided = Core.decideApproval(current, body.decision);
        replaceJson(approvalFile(dataDir, id), decided);
        appendEvent(dataDir, {
          eventId: `EV-${id}-${decided.status.toUpperCase()}`,
          at: decided.decidedAt,
          type: 'approval',
          title: `Approval ${decided.status}`,
          detail: `${decided.title}; decision recorded in Work Control. Executor transmission remains disabled.`
        });
        return json(res, 200, { approval: decided });
      }
      if (req.method === 'POST' && pathname === '/api/v1/worker/heartbeat') {
        if (!workerAuthorized(req, workerToken)) return json(res, 403, { error: 'WORKER_AUTH_REQUIRED' });
        const body = await readBody(req);
        const status = { workerId: Core.safeId(body.workerId || 'factory-worker-v1'), model: Core.normalizeText(body.model || 'unknown', 80), state: Core.normalizeText(body.state || 'ONLINE', 40), at: new Date().toISOString() };
        replaceJson(workerStatusFile(dataDir), status);
        return json(res, 200, { status: 'OK', worker: status });
      }
      if (req.method === 'POST' && pathname === '/api/v1/worker/next') {
        if (!workerAuthorized(req, workerToken)) return json(res, 403, { error: 'WORKER_AUTH_REQUIRED' });
        const body = await readBody(req);
        const workerId = Core.safeId(body.workerId || 'factory-worker-v1');
        const claimed = claimNext(dataDir, workerId);
        if (!claimed) return json(res, 200, { status: 'IDLE' });
        return json(res, 200, { status: 'CLAIMED', ...claimed });
      }
      if (req.method === 'POST' && pathname === '/api/v1/worker/approvals') {
        if (!workerAuthorized(req, workerToken)) return json(res, 403, { error: 'WORKER_AUTH_REQUIRED' });
        const body = await readBody(req);
        const command = readJson(commandFile(dataDir, Core.safeId(body.commandId)), null);
        if (!command) return json(res, 404, { error: 'COMMAND_NOT_FOUND' });
        const approval = Core.createApprovalRequest({ command, ...body });
        atomicWriteJson(approvalFile(dataDir, approval.approvalId), approval);
        appendEvent(dataDir, { eventId: `EV-${approval.approvalId}-REQUESTED`, at: approval.requestedAt, type: 'approval', title: 'Owner approval requested', detail: approval.title });
        return json(res, 201, { approval });
      }
      if (req.method === 'POST' && pathname === '/api/v1/worker/receipts') {
        if (!workerAuthorized(req, workerToken)) return json(res, 403, { error: 'WORKER_AUTH_REQUIRED' });
        const receipt = await readBody(req);
        const command = readJson(commandFile(dataDir, Core.safeId(receipt.commandId)), null);
        if (!command) return json(res, 404, { error: 'COMMAND_NOT_FOUND' });
        if (readJson(receiptFile(dataDir, command.commandId), null)) return json(res, 409, { error: 'RECEIPT_ALREADY_EXISTS' });
        const claim = readJson(claimFile(dataDir, command.commandId), null);
        if (!claim) return json(res, 409, { error: 'CLAIM_REQUIRED' });
        Core.validateReceipt(command, receipt);
        atomicWriteJson(receiptFile(dataDir, command.commandId), receipt);
        replaceJson(claimFile(dataDir, command.commandId), { ...claim, state: 'COMPLETED', completedAt: receipt.completedAt || new Date().toISOString() });
        appendEvent(dataDir, {
          eventId: `EV-${command.commandId}-${receipt.terminalState}`,
          at: receipt.completedAt || new Date().toISOString(),
          type: 'receipt',
          title: `Team assignment ${receipt.terminalState.toLowerCase().replace('_', ' ')}`,
          detail: receipt.summary || command.instruction
        });
        return json(res, 201, { accepted: true, work: Core.commandToWork(command, receipt) });
      }
      if (req.method === 'GET' && STATIC_FILES.has(pathname)) {
        const [name, contentType] = STATIC_FILES.get(pathname);
        const file = path.join(ROOT, name);
        const data = fs.readFileSync(file);
        res.writeHead(200, { 'content-type': contentType, 'content-length': data.length, 'cache-control': 'no-cache' });
        return res.end(data);
      }
      return json(res, 404, { error: 'NOT_FOUND' });
    } catch (error) {
      const clientErrors = ['TEAM_NOT_FOUND', 'TEAM_NOT_RUNNABLE', 'RUN_013_RESERVED', 'INSTRUCTION_REQUIRED', 'INVALID_PRIORITY', 'INVALID_MODEL_BUDGET', 'INVALID_ID', 'APPROVAL_ALREADY_DECIDED', 'INVALID_DECISION'];
      const status = Number(error.statusCode) || (clientErrors.includes(error.message) ? 400 : 500);
      return json(res, status, { error: error.message || 'INTERNAL_ERROR' });
    }
  });
}

function main() {
  const host = process.env.WORK_CONTROL_HOST || '127.0.0.1';
  const port = Number(process.env.WORK_CONTROL_PORT || 8787);
  const server = createApp();
  server.listen(port, host, () => console.log(JSON.stringify({ status: 'READY', host, port, mode: 'QUEUE_ONLY' })));
}

if (require.main === module) main();
module.exports = { createApp, buildState, readJson, atomicWriteJson, replaceJson, appendEvent, workerOnline, claimNext };
