import crypto from 'node:crypto';

const FIREBASE_PROJECT_ID = 'salescope-7f11d';
const FIREBASE_ISSUER = `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`;
const FIREBASE_CERTS_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
const AI_GATEWAY_URL = 'https://ai-gateway.vercel.sh/v1/responses';
const MODEL = 'openai/gpt-5.6-luna';
const MAX_CANDIDATES = 10;
const SEARCH_TOOL_COST_USD = 0.01;
const CONSERVATIVE_PER_CANDIDATE_CEILING_USD = 0.015;
const MAX_BATCH_APPROVAL_USD = 0.15;
const MAX_OUTPUT_TOKENS = 900;

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
  if (!Number.isFinite(payload.iat) || payload.iat > nowSec + 300) throw new Error('Firebase token issued-at invalid');
  return payload;
}

function clean(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

function normalizeCandidate(candidate) {
  const candidateId = clean(candidate?.candidateId);
  const title = clean(candidate?.title);
  const brand = clean(candidate?.brand);
  const mpn = clean(candidate?.mpn);
  const upc = clean(candidate?.upc);
  const packQuantity = Number(candidate?.packQuantity || 1);
  const unitCostCents = Number(candidate?.unitCostCents);
  if (!candidateId || !title) throw new Error('candidateId and title are required');
  if (!upc && !mpn) throw new Error(`${candidateId} lacks GTIN/UPC or MPN`);
  if (!Number.isSafeInteger(packQuantity) || packQuantity < 1) throw new Error(`${candidateId} pack quantity is invalid`);
  if (!Number.isSafeInteger(unitCostCents) || unitCostCents < 0) throw new Error(`${candidateId} source cost is invalid`);
  return { candidateId, title, brand, mpn, upc, packQuantity, unitCostCents };
}

function evidenceSchema() {
  return {
    type: 'object',
    properties: {
      candidateId: { type: 'string' },
      evidence: {
        type: 'array',
        maxItems: 6,
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            url: { type: 'string' },
            domain: { type: 'string' },
            observedPriceCents: { type: 'integer', minimum: 1 },
            exactIdentityConfirmed: { type: 'boolean' },
            packQuantityConfirmed: { type: 'boolean' },
            evidenceText: { type: 'string' }
          },
          required: ['title', 'url', 'domain', 'observedPriceCents', 'exactIdentityConfirmed', 'packQuantityConfirmed', 'evidenceText'],
          additionalProperties: false
        }
      }
    },
    required: ['candidateId', 'evidence'],
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

function sanitizeEvidence(candidate, parsed) {
  const observedAt = new Date().toISOString();
  const upc = candidate.upc.replace(/\D/g, '');
  const mpn = candidate.mpn.toLowerCase().replace(/[^a-z0-9]/g, '');
  const brand = candidate.brand.toLowerCase().replace(/[^a-z0-9]/g, '');
  const seenDomains = new Set();
  const evidence = [];
  for (const item of Array.isArray(parsed?.evidence) ? parsed.evidence : []) {
    let url;
    try { url = new URL(item.url); } catch { continue; }
    if (!/^https?:$/.test(url.protocol)) continue;
    const domain = url.hostname.toLowerCase().replace(/^www\./, '');
    if (!domain || domain.endsWith('ssactivewear.com') || seenDomains.has(domain)) continue;
    const text = `${clean(item.title)} ${clean(item.evidenceText)}`.toLowerCase();
    const compact = text.replace(/[^a-z0-9]/g, '');
    const exactIdPresent = (upc && text.replace(/\D/g, '').includes(upc)) || (mpn && compact.includes(mpn) && (!brand || compact.includes(brand)));
    if (!exactIdPresent || item.exactIdentityConfirmed !== true || item.packQuantityConfirmed !== true) continue;
    if (!Number.isSafeInteger(item.observedPriceCents) || item.observedPriceCents <= 0 || item.observedPriceCents > 1_000_000) continue;
    seenDomains.add(domain);
    evidence.push({
      candidateId: candidate.candidateId,
      exactIdentityConfirmed: true,
      identityBasis: upc && text.replace(/\D/g, '').includes(upc) ? 'GTIN/UPC' : 'brand + MPN',
      packQuantityConfirmed: true,
      observedPriceCents: item.observedPriceCents,
      url: url.toString(),
      domain,
      title: clean(item.title).slice(0, 240),
      evidenceText: clean(item.evidenceText).slice(0, 500),
      observedAt
    });
  }
  return evidence.sort((a, b) => a.observedPriceCents - b.observedPriceCents || a.domain.localeCompare(b.domain));
}

async function searchCandidate(candidate, oidcToken) {
  const identity = candidate.upc ? `GTIN/UPC ${candidate.upc}` : `brand ${candidate.brand || '(unknown)'} and MPN ${candidate.mpn}`;
  const prompt = `Find current US public-web retail offers for this exact product variant.\nCandidate ID: ${candidate.candidateId}\nProduct: ${candidate.title}\nExact identity: ${identity}\nPack quantity: ${candidate.packQuantity}\n\nRules: use web search; return only offers where the exact GTIN/UPC appears in the searched evidence OR the exact MPN and brand both appear. Match the same pack quantity. Exclude S&S Activewear. Do not infer a price, do not use MSRP as an offer, do not treat eBay sold demand as known, and return an empty evidence array when exact identity/pack cannot be established. observedPriceCents must be the displayed item price in USD cents, excluding tax and unknown shipping.`;
  const response = await fetch(AI_GATEWAY_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${oidcToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: MODEL,
      input: [{ type: 'message', role: 'user', content: prompt }],
      tools: [{ type: 'web_search' }],
      tool_choice: 'auto',
      max_output_tokens: MAX_OUTPUT_TOKENS,
      text: {
        format: {
          type: 'json_schema',
          name: 'datascout_public_price_evidence',
          strict: true,
          schema: evidenceSchema()
        }
      },
      providerOptions: { gateway: { only: ['openai'] } }
    })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`AI Gateway ${response.status}: ${clean(payload?.error?.message || payload?.error || 'request failed')}`);
  const output = responseOutputText(payload);
  if (!output) return { candidateId: candidate.candidateId, evidence: [], providerRequestId: payload?.id || null };
  let parsed;
  try { parsed = JSON.parse(output); } catch { throw new Error(`structured web-search output was not valid JSON for ${candidate.candidateId}`); }
  return {
    candidateId: candidate.candidateId,
    evidence: sanitizeEvidence(candidate, parsed),
    providerRequestId: payload?.id || null
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST required' });
  try {
    const user = await verifyFirebaseIdToken(req.headers.authorization);
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const candidates = (Array.isArray(body.candidates) ? body.candidates : []).map(normalizeCandidate);
    if (!candidates.length || candidates.length > MAX_CANDIDATES) return send(res, 400, { error: `candidates must contain 1-${MAX_CANDIDATES} items` });
    const approvedMaxCostUsd = Number(body.approvedMaxCostUsd || 0);
    if (!Number.isFinite(approvedMaxCostUsd) || approvedMaxCostUsd <= 0 || approvedMaxCostUsd > MAX_BATCH_APPROVAL_USD) {
      return send(res, 402, {
        status: 'COST_APPROVAL_REQUIRED',
        maxAllowedApprovalUsd: MAX_BATCH_APPROVAL_USD,
        conservativePerCandidateCeilingUsd: CONSERVATIVE_PER_CANDIDATE_CEILING_USD
      });
    }
    const affordableCount = Math.min(candidates.length, Math.floor((approvedMaxCostUsd + 1e-9) / CONSERVATIVE_PER_CANDIDATE_CEILING_USD));
    if (affordableCount < 1) {
      return send(res, 402, {
        status: 'COST_APPROVAL_REQUIRED',
        approvedMaxCostUsd,
        minimumApprovalUsd: CONSERVATIVE_PER_CANDIDATE_CEILING_USD
      });
    }
    const candidatesToSearch = candidates.slice(0, affordableCount);
    const conservativeBatchCeilingUsd = Number((candidatesToSearch.length * CONSERVATIVE_PER_CANDIDATE_CEILING_USD).toFixed(3));
    const oidcToken = process.env.VERCEL_OIDC_TOKEN;
    if (!oidcToken) return send(res, 503, { error: 'Vercel OIDC token is unavailable; deploy this endpoint through a Vercel project with OIDC enabled.' });

    const checks = [];
    for (const candidate of candidatesToSearch) checks.push(await searchCandidate(candidate, oidcToken));
    return send(res, 200, {
      schemaVersion: '2.0.0',
      provider: 'vercel-ai-gateway/openai-web-search',
      authenticatedUid: user.sub,
      approvedMaxCostUsd,
      estimatedCostUsd: conservativeBatchCeilingUsd,
      conservativeBatchCeilingUsd,
      requestedCandidates: candidates.length,
      actualSearchRequests: checks.length,
      remainingUnsearchedCandidates: candidates.length - checks.length,
      checks,
      directPublisherFetches: 0,
      ebayAutomatedFetches: 0,
      purchases: 0,
      listings: 0
    });
  } catch (error) {
    console.error('DataScout Vercel public-web precheck failed', error);
    return send(res, 500, { error: error instanceof Error ? error.message : 'precheck failed' });
  }
}
