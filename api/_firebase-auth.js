'use strict';

const crypto = require('crypto');

const FIREBASE_PROJECT_ID = 'salescope-7f11d';
const FIREBASE_ISSUER = `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`;
const FIREBASE_CERTS_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

let certCache = { expiresAt: 0, certs: {} };

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

module.exports = {
  requireUser,
  verifyFirebaseIdToken,
};
