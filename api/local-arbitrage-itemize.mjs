import crypto from 'node:crypto';

const FIREBASE_PROJECT_ID = 'salescope-7f11d';
const FIREBASE_ISSUER = `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`;
const FIREBASE_CERTS_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
const AI_GATEWAY_URL = 'https://ai-gateway.vercel.sh/v1/responses';
const MODEL = 'openai/gpt-5.4-fast';
const MAX_IMAGES = 3;
const MAX_OUTPUT_TOKENS = 1400;
const CONSERVATIVE_PER_IMAGE_CEILING_USD = 0.02;
const MAX_BATCH_APPROVAL_USD = 0.06;

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
  if (certCache.certs && certCache.expiresAt > now + 30_000) return certCache.certs;
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
  if (payload.aud !== FIREBASE_PROJECT_ID) throw new Error('Firebase token audience invalid');
  if (payload.iss !== FIREBASE_ISSUER) throw new Error('Firebase token issuer invalid');
  if (!payload.sub || typeof payload.sub !== 'string') throw new Error('Firebase token subject missing');
  if (!Number.isFinite(payload.exp) || payload.exp <= nowSec) throw new Error('Firebase token expired');
  return payload;
}

function clean(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

function normalizeImage(value) {
  const imageUrl = clean(value);
  if (!imageUrl) throw new Error('image is required');
  if (imageUrl.startsWith('data:image/')) {
    if (imageUrl.length > 8_000_000) throw new Error('image data URL is too large');
    return imageUrl;
  }
  let parsed;
  try { parsed = new URL(imageUrl); } catch { throw new Error('image must be a public HTTPS URL or image data URL'); }
  if (parsed.protocol !== 'https:') throw new Error('image URL must use HTTPS');
  return parsed.toString();
}

function itemSchema() {
  return {
    type: 'object',
    properties: {
      summary: { type: 'string' },
      imageConfidence: { type: 'integer', minimum: 0, maximum: 100 },
      items: {
        type: 'array',
        maxItems: 25,
        items: {
          type: 'object',
          properties: {
            label: { type: 'string' },
            brand: { type: 'string' },
            modelOrMpn: { type: 'string' },
            category: { type: 'string' },
            quantity: { type: 'integer', minimum: 1, maximum: 50 },
            identityConfidence: { type: 'integer', minimum: 0, maximum: 100 },
            conditionSignal: { type: 'string' },
            visibleEvidence: { type: 'string' },
            requiresManualVerification: { type: 'boolean' }
          },
          required: ['label','brand','modelOrMpn','category','quantity','identityConfidence','conditionSignal','visibleEvidence','requiresManualVerification'],
          additionalProperties: false
        }
      }
    },
    required: ['summary','imageConfidence','items'],
    additionalProperties: false
  };
}

function responseOutputText(payload) {
  if (typeof payload?.output_text === 'string') return payload.output_text;
  for (const item of payload?.output || []) {
    for (const content of item?.content || []) {
      if (content?.type === 'output_text' && typeof content?.text === 'string') return content.text;
    }
  }
  return '';
}

function sanitize(parsed) {
  const items = (Array.isArray(parsed?.items) ? parsed.items : []).map((item) => ({
    label: clean(item.label).slice(0, 160),
    brand: clean(item.brand).slice(0, 80),
    modelOrMpn: clean(item.modelOrMpn).slice(0, 100),
    category: clean(item.category).slice(0, 80),
    quantity: Number.isSafeInteger(item.quantity) && item.quantity > 0 ? item.quantity : 1,
    identityConfidence: Math.max(0, Math.min(100, Number(item.identityConfidence) || 0)),
    conditionSignal: clean(item.conditionSignal).slice(0, 160),
    visibleEvidence: clean(item.visibleEvidence).slice(0, 300),
    requiresManualVerification: item.requiresManualVerification !== false,
  }));
  return {
    summary: clean(parsed?.summary).slice(0, 600),
    imageConfidence: Math.max(0, Math.min(100, Number(parsed?.imageConfidence) || 0)),
    items,
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST required' });
  try {
    const user = await verifyFirebaseIdToken(req.headers.authorization);
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const title = clean(body.title || 'Local marketplace listing');
    const images = (Array.isArray(body.images) ? body.images : []).slice(0, MAX_IMAGES).map(normalizeImage);
    if (!images.length) return send(res, 400, { error: `images must contain 1-${MAX_IMAGES} items` });

    const approvedMaxCostUsd = Number(body.approvedMaxCostUsd || 0);
    const conservativeBatchCeilingUsd = Number((images.length * CONSERVATIVE_PER_IMAGE_CEILING_USD).toFixed(2));
    if (!Number.isFinite(approvedMaxCostUsd) || approvedMaxCostUsd < conservativeBatchCeilingUsd || approvedMaxCostUsd > MAX_BATCH_APPROVAL_USD) {
      return send(res, 402, {
        status: 'COST_APPROVAL_REQUIRED',
        minimumApprovalUsd: conservativeBatchCeilingUsd,
        maxAllowedApprovalUsd: MAX_BATCH_APPROVAL_USD
      });
    }

    const oidcToken = process.env.VERCEL_OIDC_TOKEN;
    if (!oidcToken) return send(res, 503, { error: 'Vercel OIDC token unavailable' });

    const content = [
      {
        type: 'input_text',
        text: `Itemize the visible resale-relevant objects in this local marketplace listing image set. Listing title: ${title}.\n\nRules: identify only what is visibly supported. Never invent a model number. If a model/MPN is not legible, leave modelOrMpn empty and set requiresManualVerification=true. Distinguish separate tools, batteries, chargers, stands/cases, and accessories. Do not estimate prices or profitability. conditionSignal is visual evidence only, not a guarantee of function.`,
      },
      ...images.map((image_url) => ({ type: 'input_image', image_url, detail: 'high' }))
    ];

    const response = await fetch(AI_GATEWAY_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${oidcToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: MODEL,
        input: [{ role: 'user', content }],
        max_output_tokens: MAX_OUTPUT_TOKENS,
        text: {
          format: {
            type: 'json_schema',
            name: 'local_arbitrage_itemization',
            strict: true,
            schema: itemSchema()
          }
        },
        providerOptions: { gateway: { only: ['openai'] } }
      })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`AI Gateway ${response.status}: ${clean(payload?.error?.message || payload?.error || 'request failed')}`);
    const output = responseOutputText(payload);
    if (!output) throw new Error('vision itemization returned no structured output');
    const parsed = JSON.parse(output);
    return send(res, 200, {
      schemaVersion: '1.0.0',
      provider: `vercel-ai-gateway/${MODEL}`,
      authenticatedUid: user.sub,
      approvedMaxCostUsd,
      conservativeBatchCeilingUsd,
      externalActions: 0,
      sellerMessages: 0,
      purchases: 0,
      itemization: sanitize(parsed)
    });
  } catch (error) {
    console.error('Local arbitrage itemization failed', error);
    return send(res, 500, { error: error instanceof Error ? error.message : 'itemization failed' });
  }
}
