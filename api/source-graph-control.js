'use strict';

const { requireUser } = require('./_firebase-auth');

const DEFAULT_SOURCE_MARGIN_URL = 'https://aittnuqrrenkencygfje.supabase.co';
const DEFAULT_SOURCE_MARGIN_PUBLISHABLE_KEY = 'sb_publishable_S3buIQQxe2IwDyTTsTBf3w_npgRsXAV';

function json(res, status, body) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  return res.status(status).json(body);
}

function sourceMarginUrl() {
  return String(process.env.SOURCE_MARGIN_SUPABASE_URL || DEFAULT_SOURCE_MARGIN_URL).replace(/\/+$/, '');
}

function publishableKey() {
  return String(process.env.SOURCE_MARGIN_SUPABASE_PUBLISHABLE_KEY || DEFAULT_SOURCE_MARGIN_PUBLISHABLE_KEY);
}

async function fetchDashboard() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(`${sourceMarginUrl()}/rest/v1/rpc/source_graph_control_dashboard`, {
      method: 'POST',
      headers: {
        apikey: publishableKey(),
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: '{}',
      signal: controller.signal,
    });
    const text = await response.text();
    let payload = null;
    if (text) {
      try { payload = JSON.parse(text); }
      catch { payload = { error: text.slice(0, 500) }; }
    }
    if (!response.ok) {
      const error = new Error(payload?.message || payload?.error || `SOURCE_GRAPH_RPC_HTTP_${response.status}`);
      error.status = response.status;
      throw error;
    }
    if (!payload || payload.version !== 'source-graph-control-v1') {
      throw new Error('SOURCE_GRAPH_CONTROL_CONTRACT_INVALID');
    }
    return payload;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return json(res, 405, { ok: false, error: 'METHOD_NOT_ALLOWED' });
    }

    const user = await requireUser(req);
    const dashboard = await fetchDashboard();

    console.log(JSON.stringify({
      logger: 'source-graph-control',
      event: 'dashboard-read',
      actorUid: user.uid,
      actorEmail: user.email,
      mode: dashboard?.authority?.mode || 'UNKNOWN',
      at: new Date().toISOString(),
    }));

    return json(res, 200, {
      ok: true,
      source: 'sourcemargin-source-graph',
      ...dashboard,
    });
  } catch (error) {
    const status = error.status && error.status >= 400 && error.status < 600 ? error.status : 503;
    console.error('[source-graph-control]', error?.stack || error?.message || String(error));
    return json(res, status, {
      ok: false,
      error: error.message || 'SOURCE_GRAPH_CONTROL_UNAVAILABLE',
    });
  }
};
