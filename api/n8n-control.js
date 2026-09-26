'use strict';

const crypto = require('crypto');

const FIREBASE_PROJECT_ID = 'salescope-7f11d';
const FIREBASE_ISSUER = `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`;
const FIREBASE_CERTS_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
const DEFAULT_CONTROL_BASE = 'https://workcontrol.159-65-169-244.sslip.io/workflows';

const WORKFLOW_PURPOSE = Object.freeze({
  ACQ001FACTORYDEMO: {
    purpose: 'Demonstrates the Business Acquisition Radar from raw acquisition listings to a ranked owner brief.',
    reads: 'Demo acquisition listings supplied through the manual or webhook trigger.',
    produces: 'Normalized and deduplicated candidates, hard-filter results, Factory specialist analysis, Q1–Q3 QA ranking, and an owner brief.',
  },
  CI001HEARTBEATV1: {
    purpose: 'Keeps the CI-001 autonomous intelligence loop alive and records whether the intelligence service is healthy.',
    reads: 'The CI-001 heartbeat endpoint every 15 minutes, plus manual canary runs.',
    produces: 'A normalized heartbeat result and CIL run record for operational monitoring.',
  },
  DEMO10SCONTROLLED: {
    purpose: 'Smoke-tests the UI-to-n8n control path, scheduling, state changes, and observable execution on a harmless 10-second pulse.',
    reads: 'A 10-second schedule plus control/status webhooks.',
    produces: 'A pulse counter, enabled/disabled state, status response, and CIL run evidence.',
  },
  EMAILINTELV1: {
    purpose: 'Monitors Gmail, classifies new inbox messages, and builds a compact digest that can be run on schedule or on demand.',
    reads: 'Recent Gmail inbox messages, a 5-minute poll gate, manual/run-now triggers, and control state.',
    produces: 'Normalized message records, classifications, a saved digest, run history, and live status/control responses.',
  },
  OPP011LIVEWATCH003: {
    purpose: 'Watches approved public sources for new opportunity signals and packages them into a weekly read-only opportunity watch.',
    reads: 'The approved OPP-011 public source map on a weekly Monday 8am CT schedule or manual canary run.',
    produces: 'A read-only signal pack and the OPP-011 weekly watch result, with CIL run evidence.',
  },
});

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
    return { ...(await verifyFirebaseIdToken(token)), token };
  } catch (error) {
    throw Object.assign(error, { status: 401 });
  }
}

async function optionalUser(req) {
  const auth = String(req.headers.authorization || '');
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) return null;
  try {
    return { ...(await verifyFirebaseIdToken(token)), token };
  } catch {
    return null;
  }
}

function controlBase() {
  return String(process.env.WORKFLOW_CONTROL_BASE_URL || DEFAULT_CONTROL_BASE).replace(/\/+$/, '');
}

async function upstream(path, { method = 'GET', body, bearerToken } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  const headers = { Accept: 'application/json' };

  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (bearerToken) headers.Authorization = `Bearer ${bearerToken}`;

  try {
    const response = await fetch(`${controlBase()}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await response.text();
    let payload = {};
    if (text) {
      try { payload = JSON.parse(text); }
      catch { payload = { error: text.slice(0, 500) }; }
    }
    if (!response.ok) {
      const error = new Error(payload?.detail || payload?.error || `WORKFLOW_CONTROL_HTTP_${response.status}`);
      error.status = response.status;
      error.upstream = payload;
      throw error;
    }
    return payload;
  } finally {
    clearTimeout(timer);
  }
}

function isScheduled(schedule) {
  const value = String(schedule || '').toLowerCase();
  return Boolean(value) && !value.includes('manual') && !value.includes('on demand') && !value.includes('event-driven');
}

function normalizeWorkflow(row) {
  const latest = row.latestExecution || null;
  const state = row.operationalState || (!row.published ? 'paused' : latest?.status === 'running' ? 'running' : 'active');
  return {
    id: String(row.id),
    name: row.name || 'Untitled workflow',
    active: Boolean(row.published),
    published: Boolean(row.published),
    managed: true,
    operationalState: state,
    schedule: row.schedule || 'Manual / event-driven',
    scheduled: isScheduled(row.schedule),
    errors24h: Number(row.errors24h || 0),
    latestExecution: latest,
    latestCompleted: row.latestCompleted || null,
    special: row.special || null,
    nodes: Array.isArray(row.nodes) ? row.nodes.map((node, index) => ({
      order: Number(node?.order || index + 1),
      name: node?.name || `Node ${index + 1}`,
      type: node?.type || 'unknown',
      disabled: Boolean(node?.disabled),
    })) : [],
    about: WORKFLOW_PURPOSE[String(row.id)] || {
      purpose: 'Managed n8n workflow. Purpose metadata has not yet been normalized.',
      reads: 'See the workflow node graph for current inputs and triggers.',
      produces: 'See the latest result for current outputs.',
    },
  };
}

function latestExecutions(workflows) {
  return workflows
    .map((workflow) => {
      const execution = workflow.latestExecution;
      if (!execution) return null;
      return {
        id: String(execution.id),
        workflowId: workflow.id,
        workflowName: workflow.name,
        status: execution.status || 'unknown',
        mode: workflow.schedule,
        startedAt: execution.startedAt || null,
        stoppedAt: execution.stoppedAt || null,
        durationMs: Number.isFinite(Number(execution.durationMs)) ? Number(execution.durationMs) : null,
      };
    })
    .filter(Boolean)
    .sort((a, b) => Date.parse(b.startedAt || 0) - Date.parse(a.startedAt || 0));
}

async function snapshot(user = null) {
  const live = await upstream('/api/workflows');
  let owner = { enrolled: null, isOwner: false, bootstrapRequired: false };
  if (user?.token) {
    try {
      owner = await upstream('/api/owner', { bearerToken: user.token });
    } catch {
      owner = { enrolled: null, isOwner: false, bootstrapRequired: false };
    }
  }
  const workflows = (live.workflows || []).map(normalizeWorkflow).sort((a, b) => a.name.localeCompare(b.name));
  const success24 = Number(live.metrics?.success24 || 0);
  const failures24h = Number(live.metrics?.error24 || 0);
  const settled = success24 + failures24h;

  return {
    ok: true,
    connected: true,
    configured: true,
    source: 'factory-workflow-control-center',
    sourceUiUrl: controlBase() + '/',
    fetchedAt: live.checkedAt || new Date().toISOString(),
    coverage: {
      mode: 'managed-factory-workflows',
      managed: Number(live.metrics?.managed ?? workflows.length),
      note: 'Live Factory-managed workflow set. n8n itself remains private on localhost.',
    },
    owner,
    writeGateConfigured: Boolean(owner?.enrolled),
    writeEnabled: Boolean(owner?.isOwner),
    metrics: {
      workflows: workflows.length,
      activeWorkflows: workflows.filter((row) => row.operationalState === 'active' || row.operationalState === 'running').length,
      scheduledWorkflows: workflows.filter((row) => row.scheduled).length,
      executions24h: success24 + failures24h,
      failures24h,
      running: Number(live.metrics?.running || 0),
      successRate24h: settled ? Math.round((success24 / settled) * 1000) / 10 : null,
    },
    workflows,
    executions: latestExecutions(workflows),
  };
}

function safeId(value) {
  const id = String(value || '').trim();
  if (!id || !/^[A-Za-z0-9_-]{1,128}$/.test(id)) {
    throw Object.assign(new Error('INVALID_WORKFLOW_ID'), { status: 400 });
  }
  return id;
}

async function resultFor(req) {
  const parsed = new URL(req.url, 'https://control.local');
  const workflowId = safeId(parsed.searchParams.get('result'));
  return upstream(`/api/result?id=${encodeURIComponent(workflowId)}`);
}

async function handleWrite(req, res, user) {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const action = String(body.action || '').toLowerCase();

  if (action === 'enroll') {
    const bootstrapCode = String(body.bootstrapCode || '').trim();
    if (!bootstrapCode) return json(res, 400, { ok: false, error: 'BOOTSTRAP_CODE_REQUIRED' });
    const owner = await upstream('/api/owner/enroll', {
      method: 'POST',
      body: { code: bootstrapCode },
      bearerToken: user.token,
    });
    return json(res, 200, { ok: true, action, owner });
  }

  if (!['pause', 'resume', 'restart'].includes(action)) {
    return json(res, 400, { ok: false, error: 'UNSUPPORTED_CONTROL_ACTION' });
  }

  const workflowId = safeId(body.workflowId);
  const payload = await upstream('/api/control-auth', {
    method: 'POST',
    body: { id: workflowId, action },
    bearerToken: user.token,
  });

  console.log(JSON.stringify({
    logger: 'n8n-control-center',
    event: 'workflow-control',
    action,
    workflowId,
    actorUid: user.uid,
    actorEmail: user.email,
    at: new Date().toISOString(),
  }));

  return json(res, 200, { ok: true, action, workflowId, upstream: payload });
}

module.exports = async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const user = await optionalUser(req);
      const parsed = new URL(req.url, 'https://control.local');
      if (parsed.searchParams.has('result')) return json(res, 200, await resultFor(req));
      return json(res, 200, await snapshot(user));
    }

    if (req.method === 'POST') {
      let user;
      try {
        user = await requireUser(req);
      } catch (error) {
        return json(res, error.status || 401, { ok: false, error: error.message || 'AUTH_REQUIRED' });
      }
      return await handleWrite(req, res, user);
    }

    res.setHeader('Allow', 'GET, POST');
    return json(res, 405, { ok: false, error: 'METHOD_NOT_ALLOWED' });
  } catch (error) {
    const status = error.status && error.status >= 400 && error.status < 600 ? error.status : 503;
    console.error('[n8n-control-center]', error?.stack || error?.message || String(error));
    return json(res, status, {
      ok: false,
      configured: true,
      error: error.message || 'N8N_CONTROL_UNAVAILABLE',
      upstreamStatus: error.status || null,
    });
  }
};
\n// Reuse the same validated Firebase JWT verifier in other owner-gated Factory APIs.\nmodule.exports.verifyFirebaseIdToken = verifyFirebaseIdToken;\n