import crypto from 'node:crypto';

const FIREBASE_PROJECT_ID = 'salescope-7f11d';
const FIREBASE_ISSUER = `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`;
const FIREBASE_CERTS_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
const MAX_REDIRECTS = 3;
const FETCH_TIMEOUT_MS = 8000;
const MAX_BODY_CHARS = 400000;

let certCache = { expiresAt: 0, certs: null };

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function base64urlDecode(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(normalized + padding, 'base64');
}

async function getFirebaseCerts() {
  const now = Date.now();
  if (certCache.certs && certCache.expiresAt > now + 30000) return certCache.certs;
  const response = await fetch(FIREBASE_CERTS_URL, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Firebase cert fetch failed (${response.status})`);
  const certs = await response.json();
  const cacheControl = response.headers.get('cache-control') || '';
  const maxAge = Number(cacheControl.match(/max-age=(\d+)/i)?.[1] || 300);
  certCache = { certs, expiresAt: now + maxAge * 1000 };
  return certs;
}

async function verifyFirebaseIdToken(authHeader) {
  const token = String(authHeader || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) throw new Error('missing Firebase bearer token');
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('invalid Firebase token format');
  const header = JSON.parse(base64urlDecode(parts[0]).toString('utf8'));
  const payload = JSON.parse(base64urlDecode(parts[1]).toString('utf8'));
  if (header.alg !== 'RS256' || !header.kid) throw new Error('invalid Firebase token header');
  const certs = await getFirebaseCerts();
  const cert = certs?.[header.kid];
  if (!cert) throw new Error('Firebase signing certificate not found');
  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(`${parts[0]}.${parts[1]}`);
  verifier.end();
  if (!verifier.verify(cert, base64urlDecode(parts[2]))) throw new Error('Firebase token signature invalid');
  const nowSec = Math.floor(Date.now() / 1000);
  if (payload.aud !== FIREBASE_PROJECT_ID || payload.iss !== FIREBASE_ISSUER || !payload.sub || payload.exp <= nowSec) {
    throw new Error('Firebase token claims invalid');
  }
  return payload;
}

function isAllowedHost(hostname) {
  const host = String(hostname || '').toLowerCase().replace(/^www\./, '');
  return host === 'craigslist.org' || host.endsWith('.craigslist.org') ||
    host === 'offerup.com' || host.endsWith('.offerup.com');
}

function parseAllowedUrl(value) {
  let url;
  try { url = new URL(String(value || '').trim()); } catch { throw new Error('invalid source URL'); }
  if (url.protocol !== 'https:') throw new Error('source URL must use HTTPS');
  if (!isAllowedHost(url.hostname)) throw new Error('source host is not allowed for public verification');
  if (url.username || url.password) throw new Error('source URL credentials are not allowed');
  return url;
}

function sameMarketplacePathLooksExact(url) {
  const host = url.hostname.toLowerCase();
  const path = url.pathname.replace(/\/+$/, '') || '/';
  if (host.endsWith('craigslist.org')) return /\/\d+\.html$/i.test(path);
  if (host.endsWith('offerup.com')) return /\/(item|items)\//i.test(path) || /\/item\/detail\//i.test(path);
  return false;
}

async function fetchBounded(startUrl) {
  let current = startUrl;
  for (let i = 0; i <= MAX_REDIRECTS; i += 1) {
    const response = await fetch(current, {
      method: 'GET',
      redirect: 'manual',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'User-Agent': 'Mozilla/5.0 (compatible; DataScoutSourceVerifier/1.0; +research-only)'
      }
    });

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) return { response, finalUrl: current };
      const next = new URL(location, current);
      if (next.protocol !== 'https:' || !isAllowedHost(next.hostname)) throw new Error('redirect left allowed marketplace host');
      current = next;
      continue;
    }
    return { response, finalUrl: current };
  }
  throw new Error('too many redirects');
}

function classify(url, response, body) {
  const text = String(body || '').toLowerCase();
  const deadMarkers = [
    'page not found',
    'there is nothing here',
    '404 error',
    'this posting has been deleted',
    'this posting has expired',
    'this posting has been flagged for removal',
    'item no longer available',
  ];

  if (response.status === 404 || response.status === 410 || deadMarkers.some((marker) => text.includes(marker))) {
    return { status: 'DEAD', live: false, reason: 'listing is missing, deleted, expired, or unavailable' };
  }
  if ([401, 403, 429].includes(response.status)) {
    return { status: 'UNVERIFIABLE', live: false, reason: `marketplace returned HTTP ${response.status}` };
  }
  if (!response.ok) return { status: 'UNVERIFIABLE', live: false, reason: `marketplace returned HTTP ${response.status}` };
  if (!sameMarketplacePathLooksExact(url)) return { status: 'UNVERIFIABLE', live: false, reason: 'final URL is not an exact listing permalink' };

  const host = url.hostname.toLowerCase();
  if (host.endsWith('craigslist.org')) {
    const craigslistEvidence = /postingtitle|postinginfo|reply-button|qr code link to this post|post id:/i.test(body);
    if (!craigslistEvidence) return { status: 'UNVERIFIABLE', live: false, reason: 'HTTP 200 lacked Craigslist listing-page evidence' };
  } else if (host.endsWith('offerup.com')) {
    const offerUpEvidence = /og:title|application\/ld\+json|item condition|offerup/i.test(body);
    if (!offerUpEvidence) return { status: 'UNVERIFIABLE', live: false, reason: 'HTTP 200 lacked OfferUp listing-page evidence' };
  }

  return { status: 'HTTP_VERIFIED', live: true, reason: 'exact listing page returned live listing evidence' };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST required' });
  try {
    const user = await verifyFirebaseIdToken(req.headers.authorization);
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const requestedUrl = parseAllowedUrl(body.url);
    const { response, finalUrl } = await fetchBounded(requestedUrl);
    const text = (await response.text()).slice(0, MAX_BODY_CHARS);
    const classification = classify(finalUrl, response, text);
    return send(res, 200, {
      schemaVersion: '1.0.0',
      authenticatedUid: user.sub,
      requestedUrl: requestedUrl.toString(),
      finalUrl: finalUrl.toString(),
      httpStatus: response.status,
      checkedAt: new Date().toISOString(),
      ...classification,
      externalActions: 0,
      sellerMessages: 0,
      purchases: 0,
    });
  } catch (error) {
    console.error('Local arbitrage source verification failed', error);
    return send(res, 400, { status: 'UNVERIFIABLE', live: false, error: error instanceof Error ? error.message : 'verification failed' });
  }
}
