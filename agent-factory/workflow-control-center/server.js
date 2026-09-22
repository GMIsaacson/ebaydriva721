const http = require('http');
const crypto = require('crypto');
const { Pool } = require('pg');
const { parse: flattedParse } = require('flatted');

const PORT = Number(process.env.PORT || 8790);
const FIREBASE_PROJECT_ID = 'salescope-7f11d';
const FIREBASE_ISSUER = `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`;
const FIREBASE_CERTS_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
const OWNER_BOOTSTRAP_HASH = '79f2db0865cfb8154111c45b38f49e5bf21833fa7cd5de1a3449cfc1b3a49b12';
let firebaseCertCache = { expiresAt: 0, certs: {} };
const ACTION_URL = process.env.ACTION_URL || 'http://172.24.0.1:8791/control';
const ACTION_TOKEN = process.env.ACTION_TOKEN || '';
const MANAGED_WORKFLOWS = ['ACQ001FACTORYDEMO','CI001HEARTBEATV1','DEMO10SCONTROLLED','EMAILINTELV1','FACTORYARCHWATCHV1','OPP011LIVEWATCH003','SOURCEMARGINACQDISPATCHG6','SMEBAYLEAFCENSUS259340'];
const CONTROL_PLANE_VERSION = '7.0';
const pool = new Pool({
  host: process.env.PGHOST || 'postgres',
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  max: 4,
  idleTimeoutMillis: 10000,
});


function decodeFirebaseSegment(value) {
  return JSON.parse(Buffer.from(value.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
}

function firebaseSignatureBuffer(value) {
  return Buffer.from(value.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

async function getFirebaseCerts() {
  if (firebaseCertCache.expiresAt > Date.now() && Object.keys(firebaseCertCache.certs).length) return firebaseCertCache.certs;
  const response = await fetch(FIREBASE_CERTS_URL, { headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`firebase_cert_fetch_${response.status}`);
  const certs = await response.json();
  const cacheControl = response.headers.get('cache-control') || '';
  const match = cacheControl.match(/max-age=(\d+)/i);
  const ttlMs = match ? Number(match[1]) * 1000 : 60 * 60 * 1000;
  firebaseCertCache = { certs, expiresAt: Date.now() + Math.max(60_000, ttlMs - 30_000) };
  return certs;
}

async function verifyFirebaseRequest(req) {
  const auth = String(req.headers.authorization || '');
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) throw Object.assign(new Error('firebase_auth_required'), { status: 401 });
  const parts = token.split('.');
  if (parts.length !== 3) throw Object.assign(new Error('invalid_firebase_token'), { status: 401 });

  let header, payload;
  try {
    header = decodeFirebaseSegment(parts[0]);
    payload = decodeFirebaseSegment(parts[1]);
  } catch {
    throw Object.assign(new Error('invalid_firebase_token'), { status: 401 });
  }

  if (header.alg !== 'RS256' || !header.kid) throw Object.assign(new Error('invalid_firebase_token'), { status: 401 });
  const certs = await getFirebaseCerts();
  const cert = certs[header.kid];
  if (!cert) throw Object.assign(new Error('invalid_firebase_token'), { status: 401 });

  const valid = crypto.verify(
    'RSA-SHA256',
    Buffer.from(`${parts[0]}.${parts[1]}`),
    cert,
    firebaseSignatureBuffer(parts[2])
  );
  if (!valid) throw Object.assign(new Error('invalid_firebase_token'), { status: 401 });

  const now = Math.floor(Date.now() / 1000);
  if (payload.iss !== FIREBASE_ISSUER || payload.aud !== FIREBASE_PROJECT_ID) throw Object.assign(new Error('invalid_firebase_token'), { status: 401 });
  if (!payload.sub || String(payload.sub).length > 128) throw Object.assign(new Error('invalid_firebase_token'), { status: 401 });
  if (!payload.exp || Number(payload.exp) <= now - 30) throw Object.assign(new Error('firebase_token_expired'), { status: 401 });
  if (payload.email && payload.email_verified === false) throw Object.assign(new Error('firebase_email_unverified'), { status: 403 });
  return { uid: String(payload.sub), email: payload.email ? String(payload.email).toLowerCase() : null };
}

async function ensureOwnerTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS workflow_control_owner (
      singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton = true),
      owner_uid text,
      owner_email text,
      bootstrap_hash text,
      claimed_at timestamptz,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`
    INSERT INTO workflow_control_owner(singleton, bootstrap_hash)
    VALUES (true, $1)
    ON CONFLICT (singleton) DO NOTHING
  `, [OWNER_BOOTSTRAP_HASH]);
  await pool.query(
    'UPDATE workflow_control_owner SET bootstrap_hash=$1, updated_at=now() WHERE singleton=true AND owner_uid IS NULL AND bootstrap_hash IS NULL',
    [OWNER_BOOTSTRAP_HASH]
  );
}

async function readOwnerRow() {
  await ensureOwnerTable();
  const result = await pool.query('SELECT owner_uid,owner_email,bootstrap_hash,claimed_at,updated_at FROM workflow_control_owner WHERE singleton=true');
  return result.rows[0] || {};
}

async function ownerStatus(req) {
  const identity = await verifyFirebaseRequest(req);
  const row = await readOwnerRow();
  return {
    ok: true,
    enrolled: !!row.owner_uid,
    isOwner: !!row.owner_uid && row.owner_uid === identity.uid,
    claimedAt: row.claimed_at || null,
    bootstrapRequired: !row.owner_uid,
  };
}

async function enrollOwner(req) {
  const identity = await verifyFirebaseRequest(req);
  const body = await readJsonBody(req);
  const code = String(body.code || '').trim();
  if (!code) return { status: 400, body: { ok: false, error: 'bootstrap_code_required' } };

  await ensureOwnerTable();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query('SELECT owner_uid,bootstrap_hash FROM workflow_control_owner WHERE singleton=true FOR UPDATE');
    const row = result.rows[0] || {};
    if (row.owner_uid) {
      await client.query('ROLLBACK');
      if (row.owner_uid === identity.uid) return { status: 200, body: { ok: true, enrolled: true, isOwner: true, alreadyOwned: true } };
      return { status: 409, body: { ok: false, error: 'owner_already_enrolled' } };
    }
    if (!row.bootstrap_hash) {
      await client.query('ROLLBACK');
      return { status: 503, body: { ok: false, error: 'bootstrap_not_configured' } };
    }
    const supplied = crypto.createHash('sha256').update(code).digest();
    const expected = Buffer.from(String(row.bootstrap_hash), 'hex');
    if (expected.length !== supplied.length || !crypto.timingSafeEqual(expected, supplied)) {
      await client.query('ROLLBACK');
      return { status: 403, body: { ok: false, error: 'invalid_bootstrap_code' } };
    }
    await client.query(
      'UPDATE workflow_control_owner SET owner_uid=$1, owner_email=$2, bootstrap_hash=NULL, claimed_at=now(), updated_at=now() WHERE singleton=true',
      [identity.uid, identity.email]
    );
    await client.query('COMMIT');
    return { status: 200, body: { ok: true, enrolled: true, isOwner: true } };
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch {}
    throw error;
  } finally {
    client.release();
  }
}

async function controlWorkflowWithFirebase(req) {
  const identity = await verifyFirebaseRequest(req);
  const row = await readOwnerRow();
  if (!row.owner_uid) return { status: 403, body: { ok: false, error: 'owner_not_enrolled' } };
  if (row.owner_uid !== identity.uid) return { status: 403, body: { ok: false, error: 'owner_required' } };
  return controlWorkflow(req);
}

const preferredResultNode = {
  ACQ001FACTORYDEMO: 'Build Owner Brief',
  OPP011LIVEWATCH003: 'OPP-011 Weekly Watch Result',
  DEMO10SCONTROLLED: 'Pulse Counter',
  FACTORYARCHWATCHV1: 'Detect Architecture Signals',
};

function json(res, code, value) {
  const body = JSON.stringify(value);
  res.writeHead(code, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body),
    'x-content-type-options': 'nosniff',
  });
  res.end(body);
}

function html(res, body) {
  res.writeHead(200, {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-store',
    'x-frame-options': 'DENY',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
  });
  res.end(body);
}

function parseMaybe(v, fallback) {
  if (v == null) return fallback;
  if (typeof v === 'object') return v;
  try { return JSON.parse(v); } catch { return fallback; }
}

function durationMs(start, stop) {
  if (!start || !stop) return null;
  const n = new Date(stop).getTime() - new Date(start).getTime();
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function scheduleText(nodes, staticData) {
  const list = Array.isArray(nodes) ? nodes : [];
  const schedule = list.find(n => n && n.type === 'n8n-nodes-base.scheduleTrigger');
  const webhook = list.find(n => n && n.type === 'n8n-nodes-base.webhook');
  const g = staticData && staticData.global;
  if (g && Number.isFinite(Number(g.intervalMinutes)) && schedule) {
    return `Every ${Number(g.intervalMinutes)} min (5-min poll gate)`;
  }
  if (schedule) {
    const interval = schedule?.parameters?.rule?.interval?.[0] || {};
    if (interval.field === 'seconds') return `Every ${interval.secondsInterval || 1} sec`;
    if (interval.field === 'minutes') return `Every ${interval.minutesInterval || 1} min`;
    if (interval.field === 'hours') return `Every ${interval.hoursInterval || 1} hr`;
    if (interval.field === 'days') return `Every ${interval.daysInterval || 1} day`;
    if (interval.field === 'weeks') return `Every ${interval.weeksInterval || 1} week`;
    if (interval.field === 'cronExpression') return schedule.name || interval.expression || 'Cron schedule';
    return schedule.name || 'Scheduled';
  }
  if (webhook) return 'On demand / webhook';
  return 'Manual / event-driven';
}

function compact(value, depth = 0) {
  if (depth > 7) return '[depth limit]';
  if (value == null || typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.length > 2500 ? value.slice(0, 2500) + '…' : value;
  if (Array.isArray(value)) {
    const sliced = value.slice(0, 40).map(v => compact(v, depth + 1));
    if (value.length > 40) sliced.push(`[${value.length - 40} more items]`);
    return sliced;
  }
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value).slice(0, 60)) {
      if (/credential|password|token|secret|authorization/i.test(k)) continue;
      out[k] = compact(v, depth + 1);
    }
    return out;
  }
  return String(value);
}

function runOutput(runData, nodeName) {
  const runs = runData && runData[nodeName];
  if (!Array.isArray(runs)) return null;
  for (let i = runs.length - 1; i >= 0; i--) {
    const main = runs[i]?.data?.main;
    if (!Array.isArray(main)) continue;
    const items = main.flat().filter(Boolean).map(x => (x && typeof x === 'object' && 'json' in x) ? x.json : x);
    if (items.length) return compact(items.length === 1 ? items[0] : items);
  }
  return null;
}

function bestOutput(runData, workflowId) {
  if (!runData || typeof runData !== 'object') return { node: null, payload: null, nodes: [] };
  const names = Object.keys(runData);
  const preferred = preferredResultNode[workflowId];
  if (preferred) {
    const payload = runOutput(runData, preferred);
    if (payload != null) return { node: preferred, payload, nodes: names };
  }
  const skip = /(^CIL\b|Close Run|Open Run|Respond|Trigger$|Context$|Gate$)/i;
  for (const name of [...names].reverse()) {
    if (skip.test(name)) continue;
    const payload = runOutput(runData, name);
    if (payload != null) return { node: name, payload, nodes: names };
  }
  for (const name of [...names].reverse()) {
    const payload = runOutput(runData, name);
    if (payload != null) return { node: name, payload, nodes: names };
  }
  return { node: null, payload: null, nodes: names };
}

async function serviceJson(url, timeoutMs = 1800) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { headers: { accept: 'application/json' }, signal: ctrl.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally { clearTimeout(timer); }
}


function dependencyKind(node) {
  const type = String(node?.type || '').toLowerCase();
  const name = String(node?.name || '').toLowerCase();
  if (type.includes('gmail') || name.includes('gmail')) return { key: 'gmail', name: 'Gmail', category: 'oauth' };
  if (type.includes('googlesheets') || name.includes('google sheet')) return { key: 'google_sheets', name: 'Google Sheets', category: 'oauth' };
  if (type.includes('postgres') || name.includes('postgres')) return { key: 'postgres', name: 'PostgreSQL', category: 'database' };
  if (type.includes('supabase') || name.includes('supabase')) return { key: 'supabase', name: 'Supabase', category: 'database' };
  if (type.includes('slack') || name.includes('slack')) return { key: 'slack', name: 'Slack', category: 'oauth' };
  if (type.includes('openai') || name.includes('openai')) return { key: 'openai', name: 'OpenAI', category: 'api' };
  if (type.includes('http') || name.includes('http request')) return { key: 'external_http', name: 'External HTTP API', category: 'api' };
  if (type.includes('webhook') || name.includes('webhook')) return { key: 'webhook', name: 'Webhook endpoint', category: 'trigger' };
  return null;
}

function dependencyInventory(nodes, special) {
  const found = new Map();
  for (const node of Array.isArray(nodes) ? nodes : []) {
    const dep = dependencyKind(node);
    if (!dep) continue;
    const previous = found.get(dep.key) || { ...dep, nodeCount: 0, nodes: [], state: 'unknown', detail: 'Discovered from the workflow graph; no active probe is registered.' };
    previous.nodeCount += 1;
    if (previous.nodes.length < 8) previous.nodes.push(node?.name || 'Unnamed node');
    found.set(dep.key, previous);
  }
  if (found.has('gmail') && String(special?.gmailState || '').toLowerCase() === 'needs_reconnect') {
    found.set('gmail', { ...found.get('gmail'), state: 'attention', detail: 'Gmail authorization requires reconnection.', recovery: { adapter: 'oauth_reconnect', available: false, reason: 'Safe in-cockpit OAuth recovery adapter is not deployed yet.' } });
  }
  return [...found.values()];
}

function redactErrorText(value) {
  return String(value || '')
    .replace(/Bearer\s+[A-Za-z0-9._~+\/=-]+/gi, 'Bearer [redacted]')
    .replace(/((?:api[_-]?key|token|secret|password|authorization)\s*[:=]\s*)[^\s,;]+/gi, '$1[redacted]')
    .replace(/([?&](?:key|token|secret|password|api_key)=)[^&\s]+/gi, '$1[redacted]')
    .slice(0, 1800);
}

function executionNodeRuns(parsed, workflowNodes) {
  const runData = parsed?.resultData?.runData && typeof parsed.resultData.runData === 'object' ? parsed.resultData.runData : {};
  const ordered = [];
  for (const node of Array.isArray(workflowNodes) ? workflowNodes : []) if (node?.name && !ordered.includes(node.name)) ordered.push(node.name);
  for (const name of Object.keys(runData)) if (!ordered.includes(name)) ordered.push(name);
  return ordered.map((name, index) => {
    const runs = Array.isArray(runData[name]) ? runData[name] : [];
    const latest = runs.length ? runs[runs.length - 1] : null;
    const error = latest?.error || null;
    return {
      order: index + 1,
      name,
      status: !latest ? 'not_run' : error ? 'error' : 'success',
      runs: runs.length,
      executionTimeMs: Number.isFinite(Number(latest?.executionTime)) ? Number(latest.executionTime) : null,
      error: error ? { name: redactErrorText(error.name || error.type || 'NodeError'), message: redactErrorText(error.message || error.description || 'Node failed.'), description: redactErrorText(error.description || '') } : null,
    };
  });
}

function boundedInt(value, fallback, min, max) {
  const n = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

async function executionLedger(searchParams) {
  const workflowId = searchParams.get('workflowId');
  const status = searchParams.get('status');
  const limit = boundedInt(searchParams.get('limit'), 25, 1, 100);
  const offset = boundedInt(searchParams.get('offset'), 0, 0, 100000);
  const params = [MANAGED_WORKFLOWS];
  const where = ['e."workflowId" = ANY($1::text[])', 'e."deletedAt" IS NULL'];
  if (workflowId) {
    if (!MANAGED_WORKFLOWS.includes(workflowId)) return { ok: true, total: 0, limit, offset, executions: [] };
    params.push(workflowId); where.push('e."workflowId"=$' + params.length);
  }
  if (status) { params.push(String(status)); where.push('e.status=$' + params.length); }
  params.push(limit); const limitRef = '$' + params.length;
  params.push(offset); const offsetRef = '$' + params.length;
  const sql = [
    'SELECT e.id,e.status,e.mode,e.finished,e."retryOf",e."retrySuccessId",',
    ' e."startedAt",e."stoppedAt",e."waitTill",e."workflowId",e."jsonSizeBytes",w.name AS workflow_name,',
    ' count(*) OVER()::int AS total_count',
    'FROM execution_entity e JOIN workflow_entity w ON w.id=e."workflowId"',
    'WHERE ' + where.join(' AND '),
    'ORDER BY e."startedAt" DESC NULLS LAST,e.id DESC',
    'LIMIT ' + limitRef + ' OFFSET ' + offsetRef
  ].join('\n');
  const result = await pool.query(sql, params);
  const executions = result.rows.map(row => ({
    id: String(row.id), workflowId: row.workflowId, workflowName: row.workflow_name,
    status: row.status || 'unknown', mode: row.mode || null, finished: !!row.finished,
    retryOf: row.retryOf || null, retrySuccessId: row.retrySuccessId || null,
    startedAt: row.startedAt || null, stoppedAt: row.stoppedAt || null, waitTill: row.waitTill || null,
    durationMs: durationMs(row.startedAt, row.stoppedAt), jsonSizeBytes: Number(row.jsonSizeBytes || 0)
  }));
  const total = Number(result.rows[0]?.total_count || 0);
  return { ok: true, scope: 'managed-factory-workflows', total, limit, offset, hasMore: offset + executions.length < total, executions };
}

async function executionDetail(executionId) {
  const id = Number.parseInt(String(executionId || ''), 10);
  if (!Number.isFinite(id) || id <= 0) throw Object.assign(new Error('Invalid execution id.'), { status: 400 });
  const sql = [
    'SELECT e.id,e.status,e.mode,e.finished,e."retryOf",e."retrySuccessId",',
    ' e."startedAt",e."stoppedAt",e."waitTill",e."workflowId",e."jsonSizeBytes",',
    ' d.data,w.name AS workflow_name,w.nodes',
    'FROM execution_entity e JOIN workflow_entity w ON w.id=e."workflowId"',
    'LEFT JOIN execution_data d ON d."executionId"=e.id',
    'WHERE e.id=$1 AND e."workflowId" = ANY($2::text[]) AND e."deletedAt" IS NULL LIMIT 1'
  ].join('\n');
  const result = await pool.query(sql, [id, MANAGED_WORKFLOWS]);
  if (!result.rows.length) throw Object.assign(new Error('Execution not found in managed workflow scope.'), { status: 404 });
  const row = result.rows[0];
  let parsed = null, decodeError = null;
  if (row.data) { try { parsed = flattedParse(row.data); } catch (error) { decodeError = redactErrorText(error.message); } }
  const nodes = parseMaybe(row.nodes, []);
  const nodeRuns = parsed ? executionNodeRuns(parsed, nodes) : nodes.map((node, index) => ({ order: index + 1, name: node?.name || ('Node ' + (index + 1)), status: 'unknown', runs: 0, executionTimeMs: null, error: null }));
  const rawError = parsed?.resultData?.error || null;
  const error = rawError ? { name: redactErrorText(rawError.name || rawError.type || 'ExecutionError'), message: redactErrorText(rawError.message || rawError.description || 'Execution failed.'), description: redactErrorText(rawError.description || ''), node: redactErrorText(rawError.node?.name || rawError.node || '') } : null;
  return {
    ok: true,
    execution: { id: String(row.id), workflowId: row.workflowId, workflowName: row.workflow_name, status: row.status || 'unknown', mode: row.mode || null, finished: !!row.finished, retryOf: row.retryOf || null, retrySuccessId: row.retrySuccessId || null, startedAt: row.startedAt || null, stoppedAt: row.stoppedAt || null, waitTill: row.waitTill || null, durationMs: durationMs(row.startedAt, row.stoppedAt), jsonSizeBytes: Number(row.jsonSizeBytes || 0) },
    error, decodeError, nodeRuns,
    privacy: { rawInputsExposed: false, rawOutputsExposed: false, note: 'Only state, timings, and redacted errors are exposed. Raw node payloads remain private.' }
  };
}

function diagnose(workflow, detail) {
  const dep = (workflow?.dependencies || []).find(item => item.state === 'attention');
  const failedNode = (detail?.nodeRuns || []).find(item => item.status === 'error') || null;
  const error = detail?.error || failedNode?.error || null;
  const message = [dep?.detail, error?.message, error?.description].filter(Boolean).join(' ').toLowerCase();
  let category = 'operational', title = 'Workflow requires review', explanation = 'Review dependency state and the latest execution before applying recovery.';
  if (dep?.category === 'oauth' || /oauth|credential|unauthoriz|401|token.*expir|reconnect/.test(message)) {
    category = 'authentication'; title = (dep?.name || 'External service') + ' authentication requires attention'; explanation = 'An authenticated dependency is blocking useful work even if scheduler ticks still succeed.';
  } else if (/429|rate.?limit|too many requests/.test(message)) {
    category = 'rate_limit'; title = 'External service rate limit detected'; explanation = 'The provider is throttling requests; immediate retry can repeat the failure.';
  } else if (/timeout|timed out|etimedout|econnreset/.test(message)) {
    category = 'timeout'; title = 'Dependency timeout detected'; explanation = 'A node exceeded its response window or lost the upstream connection.';
  } else if (/column .* does not exist|relation .* does not exist|sql|postgres|database|schema/.test(message)) {
    category = 'database'; title = 'Database or schema issue detected'; explanation = 'The failure appears related to database availability, SQL, or an expected schema object.';
  } else if (/webhook|404|not found/.test(message)) {
    category = 'webhook'; title = 'Webhook or endpoint registration issue detected'; explanation = 'A trigger or endpoint may no longer be registered at the expected path.';
  } else if (/econnrefused|dns|enotfound|network|socket/.test(message)) {
    category = 'network'; title = 'Network dependency issue detected'; explanation = 'The workflow could not reach an upstream service or host.';
  } else if (error) {
    category = 'execution'; title = 'n8n execution failure detected'; explanation = 'The latest failed execution contains a node or workflow error that needs inspection.';
  } else if (workflow?.operationalState === 'paused') {
    category = 'paused'; title = 'Workflow is paused'; explanation = 'The workflow will not accept its normal triggers until resumed.';
  }
  return {
    category, title, explanation,
    evidence: { dependency: dep || null, executionError: detail?.error || null, failedNode },
    recovery: { lifecycle: { pause: true, resume: true, reregister: true }, testDependency: false, reconnectDependency: false, runNow: false, retryExecution: false, note: 'Unsupported actions remain disabled until a validated adapter exists.' }
  };
}

async function diagnoseWorkflow(workflowId) {
  if (!MANAGED_WORKFLOWS.includes(workflowId)) throw Object.assign(new Error('Workflow is not managed by this control center.'), { status: 404 });
  const snap = await workflowSnapshot();
  const workflow = snap.workflows.find(item => item.id === workflowId);
  if (!workflow) throw Object.assign(new Error('Workflow not found.'), { status: 404 });
  let detail = null;
  if (workflow.latestExecution?.id) { try { detail = await executionDetail(workflow.latestExecution.id); } catch {} }
  return { ok: true, workflowId, workflowName: workflow.name, state: workflow.operationalState, dependencies: workflow.dependencies || [], latestExecution: detail, diagnosis: diagnose(workflow, detail), checkedAt: new Date().toISOString() };
}

async function dependencySnapshot() {
  const snap = await workflowSnapshot();
  const groups = new Map();
  for (const workflow of snap.workflows) for (const dep of workflow.dependencies || []) {
    const current = groups.get(dep.key) || { key: dep.key, name: dep.name, category: dep.category, state: 'unknown', workflows: [], affected: 0, recovery: dep.recovery || null };
    current.workflows.push({ id: workflow.id, name: workflow.name, state: dep.state, detail: dep.detail });
    if (dep.state === 'attention') { current.state = 'attention'; current.affected += 1; current.recovery = dep.recovery || current.recovery; }
    groups.set(dep.key, current);
  }
  return { ok: true, checkedAt: new Date().toISOString(), dependencies: [...groups.values()].sort((a,b) => a.state === 'attention' ? -1 : b.state === 'attention' ? 1 : a.name.localeCompare(b.name)) };
}

async function workflowSnapshot() {
  const sql = `
    SELECT w.id,w.name,w.active,w.nodes,w."staticData",
      le.id AS latest_execution_id, le.status AS latest_status,
      le."startedAt" AS latest_started_at, le."stoppedAt" AS latest_stopped_at,
      ce.id AS completed_execution_id, ce.status AS completed_status,
      ce."startedAt" AS completed_started_at, ce."stoppedAt" AS completed_stopped_at,
      COALESCE(err.err24,0)::int AS errors_24h
    FROM workflow_entity w
    LEFT JOIN LATERAL (
      SELECT e.id,e.status,e."startedAt",e."stoppedAt"
      FROM execution_entity e WHERE e."workflowId"=w.id AND e."deletedAt" IS NULL
      ORDER BY e."startedAt" DESC LIMIT 1
    ) le ON true
    LEFT JOIN LATERAL (
      SELECT e.id,e.status,e."startedAt",e."stoppedAt"
      FROM execution_entity e WHERE e."workflowId"=w.id AND e."deletedAt" IS NULL AND e."stoppedAt" IS NOT NULL
      ORDER BY e."startedAt" DESC LIMIT 1
    ) ce ON true
    LEFT JOIN LATERAL (
      SELECT count(*) AS err24 FROM execution_entity e
      WHERE e."workflowId"=w.id AND e.status='error' AND e."startedAt">now()-interval '24 hours'
    ) err ON true
    WHERE w.id = ANY($1::text[]) AND COALESCE(w."isArchived",false)=false
    ORDER BY w.name`;
  const [rowsResult, metricsResult] = await Promise.all([
    pool.query(sql, [MANAGED_WORKFLOWS]),
    pool.query(`SELECT
      count(*) FILTER (WHERE status='running' AND "deletedAt" IS NULL)::int AS running,
      count(*) FILTER (WHERE status='success' AND "startedAt">now()-interval '24 hours' AND "deletedAt" IS NULL)::int AS success24,
      count(*) FILTER (WHERE status='error' AND "startedAt">now()-interval '24 hours' AND "deletedAt" IS NULL)::int AS error24
      FROM execution_entity`)
  ]);

  let demoStatus = null, emailStatus = null;
  await Promise.all([
    serviceJson('http://n8n-demo-ui:8788/api/status').then(x => demoStatus = x).catch(() => {}),
    serviceJson('http://n8n-email-ui:8789/api/status').then(x => emailStatus = x).catch(() => {}),
  ]);

  const workflows = rowsResult.rows.map(row => {
    const nodes = parseMaybe(row.nodes, []);
    const sd = parseMaybe(row.staticData, {});
    const storedInternalEnabled = typeof sd?.global?.enabled === 'boolean' ? sd.global.enabled : null;
    const special = row.id === 'DEMO10SCONTROLLED' ? compact(demoStatus) : row.id === 'EMAILINTELV1' ? compact(emailStatus) : null;
    const liveInternalEnabled = special && typeof special.enabled === 'boolean' ? special.enabled : null;
    const internalEnabled = liveInternalEnabled !== null ? liveInternalEnabled : storedInternalEnabled;
    return {
      id: row.id,
      name: row.name,
      published: !!row.active,
      operationalState: !row.active || internalEnabled === false ? 'paused' : row.latest_status === 'running' ? 'running' : 'active',
      schedule: scheduleText(nodes, sd),
      latestExecution: row.latest_execution_id ? {
        id: row.latest_execution_id,
        status: row.latest_status,
        startedAt: row.latest_started_at,
        stoppedAt: row.latest_stopped_at,
        durationMs: durationMs(row.latest_started_at, row.latest_stopped_at),
      } : null,
      latestCompleted: row.completed_execution_id ? {
        id: row.completed_execution_id,
        status: row.completed_status,
        startedAt: row.completed_started_at,
        stoppedAt: row.completed_stopped_at,
        durationMs: durationMs(row.completed_started_at, row.completed_stopped_at),
      } : null,
      errors24h: row.errors_24h,
      special,
      dependencies: dependencyInventory(nodes, special),
      nodes: nodes.map((node, index) => ({
        order: index + 1,
        name: node?.name || `Node ${index + 1}`,
        type: node?.type || 'unknown',
        disabled: !!node?.disabled,
      })),
    };
  });
  const metrics = metricsResult.rows[0];
  metrics.published = workflows.filter(w => w.published).length;
  metrics.managed = workflows.length;
  return { ok: true, checkedAt: new Date().toISOString(), version: CONTROL_PLANE_VERSION, capabilities: { lifecycle: { pause: true, resume: true, reregister: true }, executionLedger: true, nodeInspection: true, troubleshooting: true, dependencyInventory: true, testDependency: false, reconnectDependency: false, runNow: false, retryExecution: false }, metrics, workflows };
}


async function architectureSnapshot() {
  const [watchResult, workControlState, cilResult] = await Promise.all([
    resultFor('FACTORYARCHWATCHV1').catch(error => ({ ok: false, error: error.message })),
    serviceJson('http://factory-work-control-v1:8787/api/v1/state', 4500).catch(error => ({ connection: { connected: false }, work: [], error: error.message })),
    pool.query(`SELECT run_id,status,compliance_status,outcome_status,started_at,completed_at,latency_ms,error_count,telemetry
      FROM cil_run_contracts WHERE workflow_id='FACTORYARCHWATCHV1'
      ORDER BY started_at DESC LIMIT 1`).catch(() => ({ rows: [] })),
  ]);

  const payload = watchResult?.payload && typeof watchResult.payload === 'object' ? watchResult.payload : {};
  const signals = Array.isArray(payload.signals) ? payload.signals.map(signal => ({
    id: signal?.id || 'UNKNOWN_SIGNAL',
    severity: String(signal?.severity || 'REVIEW').toUpperCase(),
    reason: signal?.reason || 'Architecture review requested.',
    evidence: compact(signal?.evidence || {}),
  })) : [];

  const architectureWork = (Array.isArray(workControlState?.work) ? workControlState.work : [])
    .filter(item => item?.teamId === 'SYS-INT-007' && String(item?.title || '').includes('[ARCH_WATCH_V1]'))
    .sort((a,b) => new Date(b?.createdAt || 0) - new Date(a?.createdAt || 0))
    .slice(0, 12)
    .map(item => {
      const detail = String(item?.result?.detail || '');
      const decisions = [...new Set((detail.match(/\b(?:REUSE|EXTEND|NEW|DEFER)\b/g) || []))];
      return {
        id: item.id,
        status: item.status || 'unknown',
        priority: item.priority || 'normal',
        createdAt: item.createdAt || null,
        next: item.next || null,
        summary: item?.result?.summary || null,
        detail: detail || null,
        decisions,
      };
    });

  const latestReview = architectureWork[0] || null;
  const cil = cilResult?.rows?.[0] || null;
  const severityCounts = signals.reduce((acc, signal) => {
    acc[signal.severity] = (acc[signal.severity] || 0) + 1;
    return acc;
  }, {});

  return {
    ok: true,
    checkedAt: new Date().toISOString(),
    watch: {
      workflowId: 'FACTORYARCHWATCHV1',
      version: payload.watchVersion || null,
      lastScanAt: payload.asOf || watchResult?.execution?.stoppedAt || null,
      execution: watchResult?.execution || null,
      activeSignals: signals.length,
      severityCounts,
      signature: payload.signature || null,
      dispatchRequested: payload.dispatch === true,
      duplicateSuppressed: payload.duplicate === true,
      signals,
    },
    architect: {
      teamId: 'SYS-INT-007',
      connected: workControlState?.connection?.connected === true,
      latestReview,
      recentReviews: architectureWork,
    },
    telemetry: cil ? {
      runId: cil.run_id,
      status: cil.status,
      complianceStatus: cil.compliance_status,
      outcomeStatus: cil.outcome_status,
      startedAt: cil.started_at,
      completedAt: cil.completed_at,
      latencyMs: cil.latency_ms,
      errorCount: cil.error_count,
      telemetry: compact(cil.telemetry || {}),
    } : null,
  };
}

async function readJsonBody(req, maxBytes = 4096) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > maxBytes) throw new Error('Request too large');
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

async function controlWorkflow(req) {
  const body = await readJsonBody(req);
  const id = body && body.id;
  const action = body && body.action;
  if (!MANAGED_WORKFLOWS.includes(id)) return { status: 400, body: { ok: false, error: 'Workflow is not managed by this control center.' } };
  if (!['pause','resume','restart'].includes(action)) return { status: 400, body: { ok: false, error: 'Unsupported lifecycle action.' } };
  if (!ACTION_TOKEN) return { status: 503, body: { ok: false, error: 'Lifecycle control is not configured.' } };
  const r = await fetch(ACTION_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'accept': 'application/json', 'x-control-token': ACTION_TOKEN },
    body: JSON.stringify({ id, action }),
  });
  let payload;
  try { payload = await r.json(); } catch { payload = { ok: false, error: `Action service HTTP ${r.status}` }; }
  return { status: r.status, body: payload };
}

async function resultFor(id) {
  if (id === 'EMAILINTELV1') {
    const s = await serviceJson('http://n8n-email-ui:8789/api/status');
    return { ok: true, source: 'Email Intelligence live state', node: 'Latest digest', execution: null, payload: compact({
      monitoringEnabled: s.enabled,
      intervalMinutes: s.intervalMinutes,
      gmailState: s.gmailState,
      lastSuccessfulRunAt: s.lastSuccessfulRunAt,
      totalProcessed: s.totalProcessed,
      latestDigest: s.latestDigest || null,
    }) };
  }
  if (id === 'DEMO10SCONTROLLED') {
    const s = await serviceJson('http://n8n-demo-ui:8788/api/status');
    return { ok: true, source: '10-second demo live state', node: 'Pulse status', execution: null, payload: compact(s) };
  }
  const r = await pool.query(`
    SELECT e.id,e.status,e."startedAt",e."stoppedAt",d.data
    FROM execution_entity e
    JOIN execution_data d ON d."executionId"=e.id
    WHERE e."workflowId"=$1 AND e."deletedAt" IS NULL AND e."stoppedAt" IS NOT NULL
    ORDER BY e."startedAt" DESC LIMIT 1`, [id]);
  if (!r.rows.length) return { ok: true, source: 'n8n execution data', node: null, execution: null, payload: null, message: 'No completed execution with stored result data.' };
  const row = r.rows[0];
  let parsed;
  try { parsed = flattedParse(row.data); }
  catch (e) { return { ok: false, error: 'Stored execution data could not be decoded.', detail: e.message }; }
  const found = bestOutput(parsed?.resultData?.runData, id);
  return {
    ok: true,
    source: 'n8n execution data',
    node: found.node,
    execution: { id: row.id, status: row.status, startedAt: row.startedAt, stoppedAt: row.stoppedAt, durationMs: durationMs(row.startedAt,row.stoppedAt) },
    payload: found.payload,
    availableNodes: found.nodes,
  };
}

const PAGE = String.raw`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Workflow Control Center</title>
<style>
:root{font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;color:#f6f4ff;background:#0a0714;color-scheme:dark}*{box-sizing:border-box}body{margin:0;background:radial-gradient(900px 500px at 75% -10%,#24105655,transparent),#0a0714;min-height:100vh}.wrap{max-width:1180px;margin:auto;padding:28px 18px 60px}.top{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;margin-bottom:24px}.eyebrow{font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#9b8acf;font-weight:800}.title{font-size:clamp(28px,5vw,48px);line-height:1.02;margin:8px 0 8px}.sub{color:#aaa2bf;max-width:760px;line-height:1.5}.live{display:flex;gap:8px;align-items:center;font-size:13px;color:#bdb4d4;background:#151024;border:1px solid #2d2348;padding:10px 12px;border-radius:999px;white-space:nowrap}.dot{width:9px;height:9px;border-radius:50%;background:#5ee28c;box-shadow:0 0 18px #5ee28c}.metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:18px}.metric,.card,.modal-card{background:linear-gradient(180deg,#151024,#100c1d);border:1px solid #2c2340;box-shadow:0 14px 50px #0004}.metric{border-radius:16px;padding:16px}.mlabel{font-size:12px;color:#8f86a5;text-transform:uppercase;letter-spacing:.08em}.mval{font-size:28px;font-weight:800;margin-top:6px}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.card{border-radius:20px;padding:19px;position:relative;overflow:hidden}.card:before{content:"";position:absolute;inset:0 auto auto 0;width:100%;height:2px;background:linear-gradient(90deg,#7c5cff,transparent)}.row{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.name{font-size:18px;font-weight:800;line-height:1.25}.id{font:11px ui-monospace,SFMono-Regular,Menlo,monospace;color:#746a8d;margin-top:5px}.badge{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;padding:7px 9px;border-radius:999px;border:1px solid #42365f;background:#1d1730}.badge.active,.badge.success{color:#7df2a2;border-color:#275b3b;background:#10251a}.badge.running{color:#87cbff;border-color:#275071;background:#0f1d2a}.badge.paused{color:#ffc46c;border-color:#6a4d24;background:#2a1e0f}.badge.error{color:#ff8585;border-color:#6e2d35;background:#2a1115}.details{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:16px 0}.detail{padding:11px 12px;background:#0b0814;border:1px solid #231b35;border-radius:12px}.dlabel{font-size:11px;color:#7e7594;text-transform:uppercase;letter-spacing:.07em}.dvalue{font-size:13px;margin-top:5px;color:#ddd7ed;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.actions{display:flex;gap:8px;align-items:center;margin-top:14px}.btn{appearance:none;border:1px solid #493c6a;background:#241056;color:white;border-radius:11px;padding:10px 12px;font-weight:750;cursor:pointer}.btn.secondary{background:#141021}.btn.pause{background:#2b1c0d;border-color:#6a4d24;color:#ffd08a}.btn.restart{background:#191329}.btn:disabled{opacity:.48;cursor:not-allowed}.btn:hover:not(:disabled){filter:brightness(1.15)}.foot{font-size:12px;color:#7f7696;margin-top:9px}.empty{padding:22px;border:1px dashed #403653;border-radius:14px;color:#8d84a1}.modal{display:none;position:fixed;inset:0;background:#05030bbb;backdrop-filter:blur(10px);padding:18px;z-index:20;overflow:auto}.modal.show{display:flex;align-items:flex-start;justify-content:center}.modal-card{width:min(920px,100%);margin:5vh auto;border-radius:20px;padding:20px}.modal-head{display:flex;justify-content:space-between;gap:18px}.close{border:0;background:#211932;color:#fff;border-radius:10px;padding:8px 11px;cursor:pointer}.pre{margin-top:16px;background:#08060e;border:1px solid #282038;border-radius:14px;padding:15px;overflow:auto;max-height:65vh;font:12px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace;color:#dcd4ee;white-space:pre-wrap;word-break:break-word}.errorbox{padding:13px;border:1px solid #69323c;background:#2c1117;border-radius:12px;color:#ff9aa6}.spinner{opacity:.7}.link{color:#b9a6ff;text-decoration:none;font-size:13px;font-weight:700}.link:hover{text-decoration:underline}.arch{margin:0 0 18px;background:linear-gradient(180deg,#171126,#100c1d);border:1px solid #35274d;border-radius:20px;padding:19px;box-shadow:0 14px 50px #0004}.arch-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}.arch-title{font-size:20px;font-weight:850;margin-top:4px}.arch-meta{font-size:12px;color:#8f86a5;margin-top:6px}.arch-stats{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}.arch-chip{font-size:11px;font-weight:800;padding:7px 9px;border-radius:999px;border:1px solid #42365f;background:#1d1730}.arch-chip.high{color:#ff9aa6;border-color:#6e2d35;background:#2a1115}.arch-chip.medium{color:#ffd08a;border-color:#6a4d24;background:#2a1e0f}.arch-chip.low,.arch-chip.review{color:#b9a6ff}.arch-signals{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:15px}.arch-signal{background:#0b0814;border:1px solid #29203b;border-radius:14px;padding:13px}.arch-signal.high{border-color:#5e2932}.arch-signal.medium{border-color:#5f4728}.arch-signal-id{font:11px ui-monospace,SFMono-Regular,Menlo,monospace;color:#a698c4;margin-bottom:7px}.arch-reason{font-size:13px;line-height:1.45;color:#ddd7ed}.arch-review{margin-top:12px;padding:12px 13px;border:1px solid #2d2348;border-radius:13px;background:#0e0a19;display:flex;justify-content:space-between;gap:14px;align-items:center}.arch-review-text{font-size:12px;color:#aaa2bf;line-height:1.45}.arch-review-text strong{color:#eee8ff}.arch-empty{margin-top:14px;color:#8d84a1;font-size:13px}@media(max-width:900px){.arch-signals{grid-template-columns:1fr}}@media(max-width:760px){.metrics{grid-template-columns:1fr 1fr}.grid{grid-template-columns:1fr}.top{flex-direction:column}.details{grid-template-columns:1fr}.wrap{padding-top:20px}}
</style></head><body><main class="wrap"><div class="top"><div><div class="eyebrow">FACTORY · N8N OPERATIONS</div><h1 class="title">Workflow Control Center</h1><div class="sub">Live view of published workflows, execution health, schedules, and the latest useful result from each workflow. Auto-refreshes every 5 seconds.</div></div><div class="live"><span class="dot"></span><span id="checked">Connecting…</span></div></div><section class="metrics"><div class="metric"><div class="mlabel">Published</div><div id="published" class="mval">—</div></div><div class="metric"><div class="mlabel">Running now</div><div id="running" class="mval">—</div></div><div class="metric"><div class="mlabel">Success · 24h</div><div id="success24" class="mval">—</div></div><div class="metric"><div class="mlabel">Errors · 24h</div><div id="error24" class="mval">—</div></div></section><section id="architecture" class="arch"><div class="arch-head"><div><div class="eyebrow">FACTORY ARCHITECTURE</div><div class="arch-title">Architecture / Capability Gaps</div><div id="archMeta" class="arch-meta">Loading Architecture Watch…</div></div><div id="archStats" class="arch-stats"></div></div><div id="archSignals" class="arch-signals"><div class="arch-empty">Loading current signals…</div></div><div id="archReview"></div></section><section id="grid" class="grid"><div class="empty">Loading live workflows…</div></section></main>
<div id="modal" class="modal"><section class="modal-card"><div class="modal-head"><div><div class="eyebrow">LATEST RESULT</div><h2 id="modalTitle" style="margin:6px 0 0">Workflow result</h2><div id="modalMeta" class="foot"></div></div><button id="close" class="close">Close</button></div><div id="modalBody" class="pre spinner">Loading…</div></section></div>
<script>
const $=id=>document.getElementById(id);const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));function ago(v){if(!v)return'Never';const n=Date.now()-new Date(v).getTime(),s=Math.max(0,Math.round(n/1000));if(s<60)return s+'s ago';if(s<3600)return Math.round(s/60)+'m ago';if(s<86400)return Math.round(s/3600)+'h ago';return Math.round(s/86400)+'d ago'}function dur(ms){if(ms==null)return'—';if(ms<1000)return ms+' ms';if(ms<60000)return(ms/1000).toFixed(1)+' s';return(ms/60000).toFixed(1)+' min'}function badge(w){const s=w.operationalState||'active';return '<span class="badge '+esc(s)+'">'+esc(s)+'</span>'}function card(w){const e=w.latestExecution||{},c=w.latestCompleted||{};let note='';if(w.id==='EMAILINTELV1'&&w.special){note='Mail processed: '+esc(w.special.totalProcessed??0)+(w.special.gmailState==='needs_reconnect'?' · Gmail reconnect required':'')}if(w.id==='DEMO10SCONTROLLED'&&w.special){note='Pulse count: '+esc(w.special.count??w.special?.summary?.count??0)}const paused=w.operationalState==='paused';const lifecycle='<button class="btn '+(paused?'':'pause')+'" onclick="workflowAction(this,\''+esc(w.id)+'\',\''+(paused?'resume':'pause')+'\')">'+(paused?'Resume':'Pause')+'</button><button class="btn restart" onclick="workflowAction(this,\''+esc(w.id)+'\',\'restart\')">Restart</button>';return '<article class="card"><div class="row"><div><div class="name">'+esc(w.name)+'</div><div class="id">'+esc(w.id)+'</div></div>'+badge(w)+'</div><div class="details"><div class="detail"><div class="dlabel">Schedule</div><div class="dvalue" title="'+esc(w.schedule)+'">'+esc(w.schedule)+'</div></div><div class="detail"><div class="dlabel">Latest execution</div><div class="dvalue">'+esc(e.status||'none')+' · '+esc(ago(e.startedAt))+'</div></div><div class="detail"><div class="dlabel">Last completed</div><div class="dvalue">'+esc(c.status||'none')+' · '+esc(ago(c.stoppedAt))+'</div></div><div class="detail"><div class="dlabel">Duration / errors</div><div class="dvalue">'+esc(dur(c.durationMs))+' · '+esc(w.errors24h)+' errors 24h</div></div></div><div class="actions"><button class="btn secondary" onclick="showResult(\''+esc(w.id)+'\',\''+esc(w.name).replace(/'/g,'&#39;')+'\')">View Results</button>'+lifecycle+'</div><div class="foot">'+(note||((w.published?'Published':'Unpublished')+' in n8n · lifecycle controls restart the runtime briefly'))+'</div></article>'}
function archSignalCard(s){const sev=String(s.severity||'review').toLowerCase();return '<div class="arch-signal '+esc(sev)+'"><div class="row"><div class="arch-signal-id">'+esc(s.id)+'</div><span class="badge '+(sev==='high'?'error':sev==='medium'?'paused':'active')+'">'+esc(s.severity||'REVIEW')+'</span></div><div class="arch-reason">'+esc(s.reason||'Architecture review requested.')+'</div></div>'}
function renderArchitecture(a){const w=a.watch||{},arch=a.architect||{},signals=Array.isArray(w.signals)?w.signals:[];const high=Number(w.severityCounts?.HIGH||0),medium=Number(w.severityCounts?.MEDIUM||0);$('archMeta').textContent='Architecture Watch '+(w.version?('v'+w.version+' · '):'')+'last scan '+ago(w.lastScanAt)+' · SYS-INT-007 '+(arch.connected?'connected':'unavailable');let chips='<span class="arch-chip">'+signals.length+' active signal'+(signals.length===1?'':'s')+'</span>';if(high)chips+='<span class="arch-chip high">'+high+' high</span>';if(medium)chips+='<span class="arch-chip medium">'+medium+' medium</span>';$('archStats').innerHTML=chips;$('archSignals').innerHTML=signals.length?signals.map(archSignalCard).join(''):'<div class="arch-empty">No current architecture gaps crossed the watch thresholds.</div>';const r=arch.latestReview;if(r){const decisions=Array.isArray(r.decisions)&&r.decisions.length?' · '+r.decisions.join(' / '):'';$('archReview').innerHTML='<div class="arch-review"><div class="arch-review-text"><strong>Latest SYS-INT-007 review:</strong> '+esc(r.status||'unknown')+esc(decisions)+' · '+esc(ago(r.createdAt))+'<br><span class="id">'+esc(r.id)+'</span>'+(r.summary?'<br>'+esc(r.summary):'')+'</div><a class="link" href="../">Open Work Control →</a></div>'}else{$('archReview').innerHTML='<div class="arch-review"><div class="arch-review-text">No Architecture Watch review has been dispatched yet.</div><a class="link" href="../">Open Work Control →</a></div>'}}
async function load(){try{const [wr,ar]=await Promise.all([fetch('api/workflows',{cache:'no-store'}),fetch('api/architecture',{cache:'no-store'})]);const [s,a]=await Promise.all([wr.json(),ar.json()]);if(!wr.ok||!s.ok)throw new Error(s.error||'Workflow request failed');$('published').textContent=s.metrics.published??s.workflows.filter(w=>w.published).length;$('running').textContent=s.metrics.running??0;$('success24').textContent=s.metrics.success24??0;$('error24').textContent=s.metrics.error24??0;$('checked').textContent='Live · '+new Date(s.checkedAt).toLocaleTimeString();$('grid').innerHTML=s.workflows.map(card).join('')||'<div class="empty">No published workflows.</div>';if(ar.ok&&a.ok)renderArchitecture(a);else{$('archMeta').textContent='Architecture telemetry unavailable';$('archSignals').innerHTML='<div class="errorbox">'+esc(a.error||'Could not load Architecture Watch')+'</div>'}}catch(e){$('checked').textContent='Connection problem';$('grid').innerHTML='<div class="errorbox">'+esc(e.message)+'</div>';if($('archSignals'))$('archSignals').innerHTML='<div class="errorbox">'+esc(e.message)+'</div>'}}
async function workflowAction(btn,id,action){const verb=action==='pause'?'Pause':action==='resume'?'Resume':'Restart';const detail=action==='pause'?'Future triggers will stop. An execution already in progress may finish.':action==='resume'?'The workflow will be published and its triggers registered again.':'The workflow will be re-registered. The n8n runtime will briefly restart, which can affect other workflows for a few seconds.';if(!confirm(verb+' '+id+'?\n\n'+detail+'\n\nThe n8n runtime may be unavailable for a few seconds.'))return;const buttons=[...document.querySelectorAll('.btn')];buttons.forEach(b=>b.disabled=true);const old=btn.textContent;btn.textContent=verb+'…';try{const r=await fetch('api/control',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id,action})});const x=await r.json();if(!r.ok||!x.ok)throw new Error(x.detail||x.error||'Lifecycle action failed');alert(x.message||verb+' complete');await load()}catch(e){alert('Could not '+action+' workflow: '+e.message)}finally{buttons.forEach(b=>b.disabled=false);btn.textContent=old}}
async function showResult(id,name){$('modal').classList.add('show');$('modalTitle').textContent=name;$('modalMeta').textContent=id;$('modalBody').className='pre spinner';$('modalBody').textContent='Loading latest result…';try{const r=await fetch('api/result?id='+encodeURIComponent(id),{cache:'no-store'});const x=await r.json();if(!r.ok||!x.ok)throw new Error(x.error||'Could not load result');$('modalMeta').textContent=id+(x.node?' · '+x.node:'')+(x.execution?' · execution '+x.execution.id:'');$('modalBody').className='pre';$('modalBody').textContent=x.payload==null?(x.message||'No result payload stored yet.'):JSON.stringify(x.payload,null,2)}catch(e){$('modalBody').className='errorbox';$('modalBody').textContent=e.message}}
$('close').onclick=()=>$('modal').classList.remove('show');$('modal').onclick=e=>{if(e.target===$('modal'))$('modal').classList.remove('show')};load();setInterval(load,5000);
</script></body></html>`;

const server = http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, 'http://localhost');
    if (u.pathname === '/' || u.pathname === '/index.html') return html(res, PAGE);
    if (u.pathname === '/health') return json(res, 200, { ok: true, service: 'workflow-control-center' });
    if (u.pathname === '/api/workflows') return json(res, 200, await workflowSnapshot());
    if (u.pathname === '/api/executions' && req.method === 'GET') return json(res, 200, await executionLedger(u.searchParams));
    if (/^\/api\/executions\/\d+$/.test(u.pathname) && req.method === 'GET') return json(res, 200, await executionDetail(u.pathname.split('/').pop()));
    if (u.pathname === '/api/diagnose' && req.method === 'GET') { const id = u.searchParams.get('id'); if (!id) return json(res, 400, { ok: false, error: 'Missing workflow id.' }); return json(res, 200, await diagnoseWorkflow(id)); }
    if (u.pathname === '/api/dependencies' && req.method === 'GET') return json(res, 200, await dependencySnapshot());
    if (u.pathname === '/api/architecture') return json(res, 200, await architectureSnapshot());
    if (u.pathname === '/api/owner' && req.method === 'GET') return json(res, 200, await ownerStatus(req));
    if (u.pathname === '/api/owner/enroll' && req.method === 'POST') {
      const out = await enrollOwner(req);
      return json(res, out.status, out.body);
    }
    if (u.pathname === '/api/control-auth' && req.method === 'POST') {
      const out = await controlWorkflowWithFirebase(req);
      return json(res, out.status, out.body);
    }
    if (u.pathname === '/api/control' && req.method === 'POST') {
      const out = await controlWorkflow(req);
      return json(res, out.status, out.body);
    }
    if (u.pathname === '/api/result') {
      const id = u.searchParams.get('id');
      if (!id) return json(res, 400, { ok: false, error: 'Missing workflow id.' });
      return json(res, 200, await resultFor(id));
    }
    return json(res, 404, { ok: false, error: 'Not found' });
  } catch (e) {
    console.error(e);
    const status = Number(e?.status) >= 400 && Number(e?.status) < 600 ? Number(e.status) : 500;
    const error = status === 401
      ? 'Authentication required.'
      : status === 403
        ? 'Forbidden.'
        : 'Control center query failed.';
    return json(res, status, { ok: false, error, detail: e.message });
  }
});
server.listen(PORT, '0.0.0.0', () => console.log(`Workflow Control Center listening on ${PORT}`));