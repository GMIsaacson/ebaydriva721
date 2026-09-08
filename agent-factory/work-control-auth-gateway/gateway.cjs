'use strict';

const http = require('http');
const crypto = require('crypto');

const PORT = Number(process.env.PORT || 8791);
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'salescope-7f11d';
const UPSTREAM = process.env.WORK_CONTROL_UPSTREAM || 'http://factory-work-control-v1:8787';
const CERT_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
const ALLOWED_ORIGINS = new Set((process.env.ALLOWED_ORIGINS || '').split(',').map(v => v.trim()).filter(Boolean));
const ALLOWED_METHODS = 'GET,POST,OPTIONS';
const ALLOWED_HEADERS = 'authorization,content-type';
let certCache = { certs: null, expiresAt: 0 };

function b64urlJson(segment) {
  const text = Buffer.from(segment.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
  return JSON.parse(text);
}

function json(res, code, payload, origin) {
  const body = Buffer.from(JSON.stringify(payload));
  const headers = {
    'content-type': 'application/json',
    'content-length': body.length,
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  };
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers['access-control-allow-origin'] = origin;
    headers['vary'] = 'Origin';
  }
  res.writeHead(code, headers);
  res.end(body);
}

async function getCerts() {
  const now = Date.now();
  if (certCache.certs && certCache.expiresAt > now) return certCache.certs;
  const response = await fetch(CERT_URL, { headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`cert_fetch_${response.status}`);
  const certs = await response.json();
  const cacheControl = response.headers.get('cache-control') || '';
  const match = cacheControl.match(/max-age=(\d+)/i);
  const ttlMs = match ? Number(match[1]) * 1000 : 60 * 60 * 1000;
  certCache = { certs, expiresAt: now + Math.max(60_000, ttlMs - 60_000) };
  return certs;
}

async function verifyFirebaseToken(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) throw new Error('invalid_jwt');
  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = b64urlJson(encodedHeader);
  const payload = b64urlJson(encodedPayload);
  if (header.alg !== 'RS256' || !header.kid) throw new Error('invalid_header');
  const certs = await getCerts();
  const cert = certs[header.kid];
  if (!cert) throw new Error('unknown_kid');
  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(`${encodedHeader}.${encodedPayload}`);
  verifier.end();
  const signature = Buffer.from(encodedSignature.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  if (!verifier.verify(cert, signature)) throw new Error('bad_signature');
  const now = Math.floor(Date.now() / 1000);
  if (payload.aud !== FIREBASE_PROJECT_ID) throw new Error('bad_audience');
  if (payload.iss !== `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`) throw new Error('bad_issuer');
  if (!payload.sub || String(payload.sub).length > 128) throw new Error('bad_subject');
  if (!Number.isFinite(payload.exp) || payload.exp <= now) throw new Error('expired');
  if (!Number.isFinite(payload.iat) || payload.iat > now + 300) throw new Error('bad_iat');
  if (payload.auth_time && payload.auth_time > now + 300) throw new Error('bad_auth_time');
  return payload;
}

function routeToUpstream(reqPath, method) {
  if (method === 'GET' && reqPath === '/v1/state') return '/api/v1/state';
  if (method === 'POST' && reqPath === '/v1/commands') return '/api/v1/commands';
  if (method === 'GET' && /^\/v1\/commands\/[A-Za-z0-9._-]+$/.test(reqPath)) {
    return '/api/v1/commands/' + reqPath.slice('/v1/commands/'.length);
  }
  if (method === 'POST' && /^\/v1\/approvals\/[A-Za-z0-9._-]+\/decision$/.test(reqPath)) {
    const id = reqPath.split('/')[3];
    return `/api/v1/approvals/${id}/decision`;
  }
  return null;
}

async function readBody(req) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 65536) throw new Error('body_too_large');
  }
  return raw;
}

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin || '';
  const url = new URL(req.url, 'http://gateway.local');

  if (req.method === 'OPTIONS') {
    if (!ALLOWED_ORIGINS.has(origin)) return json(res, 403, { error: 'origin_not_allowed' });
    res.writeHead(204, {
      'access-control-allow-origin': origin,
      'access-control-allow-methods': ALLOWED_METHODS,
      'access-control-allow-headers': ALLOWED_HEADERS,
      'access-control-max-age': '600',
      'vary': 'Origin',
    });
    return res.end();
  }

  if (req.method === 'GET' && url.pathname === '/health') {
    return json(res, 200, {
      status: 'READY',
      service: 'work-control-auth-gateway',
      version: '1.0',
      firebaseProjectId: FIREBASE_PROJECT_ID,
      upstream: 'configured',
      allowedRouteCount: 4,
    }, origin);
  }

  if (origin && !ALLOWED_ORIGINS.has(origin)) return json(res, 403, { error: 'origin_not_allowed' });

  const upstreamPath = routeToUpstream(url.pathname, req.method);
  if (!upstreamPath) return json(res, 404, { error: 'route_not_allowed' }, origin);

  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return json(res, 401, { error: 'firebase_auth_required' }, origin);

  try {
    const claims = await verifyFirebaseToken(auth.slice(7));
    const raw = req.method === 'POST' ? await readBody(req) : '';
    const upstreamResponse = await fetch(UPSTREAM + upstreamPath, {
      method: req.method,
      headers: {
        accept: 'application/json',
        ...(req.method === 'POST' ? { 'content-type': 'application/json' } : {}),
        'x-work-control-user': String(claims.sub),
      },
      ...(req.method === 'POST' ? { body: raw || '{}' } : {}),
    });
    const text = await upstreamResponse.text();
    let payload;
    try { payload = text ? JSON.parse(text) : {}; }
    catch { payload = { error: 'invalid_upstream_json' }; }
    return json(res, upstreamResponse.status, payload, origin);
  } catch (error) {
    console.error(JSON.stringify({ event: 'gateway_request_failed', path: url.pathname, error: error.message }));
    const authErrors = new Set(['invalid_jwt','invalid_header','unknown_kid','bad_signature','bad_audience','bad_issuer','bad_subject','expired','bad_iat','bad_auth_time']);
    const code = authErrors.has(error.message) ? 401 : error.message === 'body_too_large' ? 413 : 502;
    return json(res, code, { error: code === 401 ? 'invalid_firebase_token' : error.message }, origin);
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(JSON.stringify({ status: 'READY', port: PORT, service: 'work-control-auth-gateway' }));
});
