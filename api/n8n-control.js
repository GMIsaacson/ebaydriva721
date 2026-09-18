'use strict';

const crypto = require('crypto');

const FIREBASE_PROJECT_ID = 'salescope-7f11d';
const FIREBASE_ISSUER = `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`;
const FIREBASE_CERTS_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
const MAX_PAGES = 5;
const PAGE_SIZE = 100;

let certCache = { expiresAt: 0, certs: {} };

function json(res, status, body) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  return res.status(status).json(body);
}

function decodeSegment(value) {
  return JSON.parse(Buffer.from(value.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
}

function signatureBuffer(value) {
  return Buffer.from(value.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

async function getFirebaseCerts() {
  if (certCache.expiresAt > Date.now() && Object.keys(certCache.certs).length) return certCache.certs;
  const response = await fetch(FIREBASE_CERTS_URL, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`FIREBASE_CERT_FETCH_FAILED:${response.status}`);
  const certs = await response.json();
  const cacheControl = response.headers.get('cache-control') || '';
  const match = cacheControl.match(/max-age=(\d+)/i);
  const ttlMs = match ? Number(match[1]) * 1000 : 60 * 60 * 1000;
  certCache = { certs, expiresAt: Date.now() + Math.max(60_000, ttlMs - 30_000) };
  return certs;
}

async function verifyFirebaseIdToken(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) throw new Error('AUTH_MALFORMED_TOKEN');

  let header;
  let payload;
  try {
    header = decodeSegment(parts[0]);
    payload = decodeSegment(parts[1]);
  } catch {
    throw new Error('AUTH_INVALID_TOKEN');
  }

  if (header.alg !== 'RS256' || !header.kid) throw new Error('AUTH_UNSUPPORTED_TOKEN');
  const certs = await getFirebaseCerts();
  const cert = certs[header.kid];
  if (!cert) throw new Error('AUTH_UNKNOWN_KEY');

  const verified = crypto.verify(
    'RSA-SHA256',
    Buffer.from(`${parts[0]}.${parts[1]}`),
    cert,
    signatureBuffer(parts[2])
  );
  if (!verified) throw new Error('AUTH_BAD_SIGNATURE');

  const now = Math.floor(Date.now() / 1000);
  if (payload.iss !== FIREBASE_ISSUER) throw new Error('AUTH_BAD_ISSUER');
  if (payload.aud !== FIREBASE_PROJECT_ID) throw new Error('AUTH_BAD_AUDIENCE');
  if (!payload.sub || String(payload.sub).length > 128) throw new Error('AUTH_BAD_SUBJECT');
  if (!payload.exp || Number(payload.exp) <= now - 30) throw new Error('AUTH_EXPIRED');
  if (payload.iat && Number(payload.iat) > now + 60) throw new Error('AUTH_NOT_ACTIVE');
  if (payload.email && payload.email_verified === false) throw new Error('AUTH_EMAIL_UNVERIFIED');

  return {
    uid: String(payload.sub),
    email: payload.email ? String(payload.email).toLowerCase() : null,
  };
}

async function requireUser(req) {
  const auth = String(req.headers.authorization || '');
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) throw Object.assign(new Error('AUTH_REQUIRED'), { status: 401 });
  try {
    return await verifyFirebaseIdToken(token);
  } catch (error) {
    throw Object.assign(error, { status: 401 });
  }
}

function ownerGateConfigured() {
  return Boolean(process.env.N8N_CONTROL_OWNER_UID || process.env.N8N_CONTROL_OWNER_EMAIL);
}

function isOwner(user) {
  const uid = String(process.env.N8N_CONTROL_OWNER_UID || '').trim();
  const email = String(process.env.N8N_CONTROL_OWNER_EMAIL || '').trim().toLowerCase();
  if (uid && user.uid === uid) return true;
  if (email && user.email === email) return true;
  return false;
}

function getN8nConfig() {
  const rawBase = String(process.env.N8N_BASE_URL || '').trim().replace(/\/+$/, '');
  const apiKey = String(process.env.N8N_API_KEY || '').trim();
  if (!rawBase || !apiKey) {
    throw Object.assign(new Error('N8N_NOT_CONFIGURED'), { status: 503 });
  }
  const apiRoot = /\/api\/v1$/i.test(rawBase) ? rawBase : `${rawBase}/api/v1`;
  const instanceUrl = rawBase.replace(/\/api\/v1$/i, '');
  return { apiRoot, instanceUrl, apiKey };
}

async function n8nRequest(path, { method = 'GET', body } = {}) {
  const { apiRoot, apiKey } = getN8nConfig();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(`${apiRoot}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-N8N-API-KEY': apiKey,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });

    const text = await response.text();
    let payload = null;
    if (text) {
      try { payload = JSON.parse(text); } catch { payload = { message: text.slice(0, 500) }; }
    }

    if (!response.ok) {
      const error = new Error(payload?.message || payload?.error || `N8N_REQUEST_FAILED:${response.status}`);
      error.status = response.status;
      error.upstream = payload;
      throw error;
    }
    return payload;
  } finally {
    clearTimeout(timer);
  }
}

async function listPaginated(path, params = {}) {
  const collected = [];
  let cursor = null;
  let page = 0;
  let truncated = false;

  while (page < MAX_PAGES) {
    const query = new URLSearchParams({ limit: String(PAGE_SIZE), ...params });
    if (cursor) query.set('cursor', cursor);
    const payload = await n8nRequest(`${path}?${query.toString()}`);
    const rows = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];
    collected.push(...rows);
    cursor = payload?.nextCursor || null;
    page += 1;
    if (!cursor) break;
  }

  if (cursor) truncated = true;
  return { data: collected, truncated };
}

function triggerLabels(nodes = []) {
  const labels = new Set();
  for (const node of Array.isArray(nodes) ? nodes : []) {
    const type = String(node?.type || '').toLowerCase();
    if (!type) continue;
    if (type.includes('scheduletrigger') || type.includes('.cron')) labels.add('Schedule');
    else if (type.includes('webhook')) labels.add('Webhook');
    else if (type.includes('manualtrigger')) labels.add('Manual');
    else if (type.includes('trigger')) labels.add(node?.name || 'Trigger');
  }
  return Array.from(labels);
}

function normalizeWorkflow(workflow) {
  return {
    id: String(workflow.id),
    name: workflow.name || 'Untitled workflow',
    active: Boolean(workflow.active),
    createdAt: workflow.createdAt || null,
    updatedAt: workflow.updatedAt || null,
    versionId: workflow.versionId || null,
    tags: (workflow.tags || []).map((tag) => tag?.name || tag?.id || String(tag)).filter(Boolean),
    triggers: triggerLabels(workflow.nodes),
  };
}

function normalizeExecution(execution, workflowNames) {
  const startedAt = execution.startedAt || execution.startTime || null;
  const stoppedAt = execution.stoppedAt || execution.stopTime || null;
  const started = startedAt ? Date.parse(startedAt) : NaN;
  const stopped = stoppedAt ? Date.parse(stoppedAt) : NaN;
  const workflowId = execution.workflowId ? String(execution.workflowId) : null;
  return {
    id: String(execution.id),
    workflowId,
    workflowName: execution.workflowData?.name || workflowNames.get(workflowId) || 'Unknown workflow',
    status: execution.status || (execution.finished ? 'success' : 'running'),
    mode: execution.mode || null,
    startedAt,
    stoppedAt,
    waitTill: execution.waitTill || null,
    retryOf: execution.retryOf || null,
    retrySuccessId: execution.retrySuccessId || null,
    durationMs: Number.isFinite(started) && Number.isFinite(stopped) ? Math.max(0, stopped - started) : null,
  };
}

function buildMetrics(workflows, executions) {
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const recent = executions.filter((row) => row.startedAt && Date.parse(row.startedAt) >= dayAgo);
  const failedStates = new Set(['error', 'crashed', 'canceled']);
  const success = recent.filter((row) => row.status === 'success').length;
  const failures = recent.filter((row) => failedStates.has(row.status)).length;
  const settled = success + failures;

  return {
    workflows: workflows.length,
    activeWorkflows: workflows.filter((row) => row.active).length,
    scheduledWorkflows: workflows.filter((row) => row.triggers.includes('Schedule')).length,
    executions24h: recent.length,
    failures24h: failures,
    running: executions.filter((row) => ['running', 'new', 'waiting'].includes(row.status)).length,
    successRate24h: settled ? Math.round((success / settled) * 1000) / 10 : null,
  };
}

async function snapshot(user) {
  const { instanceUrl } = getN8nConfig();
  const [workflowResult, executionResult] = await Promise.all([
    listPaginated('/workflows'),
    listPaginated('/executions', { includeData: 'false' }),
  ]);

  const workflows = workflowResult.data.map(normalizeWorkflow).sort((a, b) => a.name.localeCompare(b.name));
  const workflowNames = new Map(workflows.map((row) => [row.id, row.name]));
  const executions = executionResult.data
    .map((row) => normalizeExecution(row, workflowNames))
    .sort((a, b) => Date.parse(b.startedAt || 0) - Date.parse(a.startedAt || 0));

  return {
    ok: true,
    connected: true,
    configured: true,
    instanceUrl,
    fetchedAt: new Date().toISOString(),
    writeGateConfigured: ownerGateConfigured(),
    writeEnabled: ownerGateConfigured() && isOwner(user),
    sampleTruncated: workflowResult.truncated || executionResult.truncated,
    metrics: buildMetrics(workflows, executions),
    workflows,
    executions,
  };
}

function safeId(value) {
  const id = String(value || '').trim();
  if (!id || !/^[A-Za-z0-9_-]{1,128}$/.test(id)) {
    throw Object.assign(new Error('INVALID_WORKFLOW_ID'), { status: 400 });
  }
  return id;
}

async function handleWrite(req, res, user) {
  if (!ownerGateConfigured()) {
    return json(res, 403, { ok: false, error: 'CONTROL_WRITES_NOT_CONFIGURED' });
  }
  if (!isOwner(user)) {
    return json(res, 403, { ok: false, error: 'OWNER_REQUIRED' });
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const action = String(body.action || '');
  if (!['activate', 'deactivate'].includes(action)) {
    return json(res, 400, { ok: false, error: 'UNSUPPORTED_CONTROL_ACTION' });
  }

  const workflowId = safeId(body.workflowId);
  const path = action === 'activate'
    ? `/workflows/${encodeURIComponent(workflowId)}/activate`
    : `/workflows/${encodeURIComponent(workflowId)}/deactivate`;

  const upstream = await n8nRequest(path, { method: 'POST' });
  const workflow = normalizeWorkflow(upstream || { id: workflowId, name: workflowId, active: action === 'activate' });

  console.log(JSON.stringify({
    logger: 'n8n-control-center',
    event: 'workflow-control',
    action,
    workflowId,
    actorUid: user.uid,
    actorEmail: user.email,
    at: new Date().toISOString(),
  }));

  return json(res, 200, { ok: true, action, workflow });
}

module.exports = async function handler(req, res) {
  let user;
  try {
    user = await requireUser(req);
  } catch (error) {
    return json(res, error.status || 401, { ok: false, error: error.message || 'AUTH_REQUIRED' });
  }

  try {
    if (req.method === 'GET') {
      const payload = await snapshot(user);
      return json(res, 200, payload);
    }
    if (req.method === 'POST') {
      return await handleWrite(req, res, user);
    }
    res.setHeader('Allow', 'GET, POST');
    return json(res, 405, { ok: false, error: 'METHOD_NOT_ALLOWED' });
  } catch (error) {
    const status = error.status && error.status >= 400 && error.status < 600 ? error.status : 503;
    console.error('[n8n-control-center]', error?.stack || error?.message || String(error));
    return json(res, status, {
      ok: false,
      configured: error.message !== 'N8N_NOT_CONFIGURED',
      error: error.message || 'N8N_CONTROL_UNAVAILABLE',
      upstreamStatus: error.status || null,
    });
  }
};
