import crypto from 'node:crypto';

const FIREBASE_PROJECT_ID = 'salescope-7f11d';
const FIREBASE_ISSUER = `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`;
const FIREBASE_CERTS_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
const AI_GATEWAY_URL = 'https://ai-gateway.vercel.sh/v1/responses';
const MODEL = 'openai/gpt-5.6-luna';
const MAX_RESULTS = 10;
const MAX_RUN_APPROVAL_USD = 0.05;
const CONSERVATIVE_RUN_CEILING_USD = 0.05;
const MAX_OUTPUT_TOKENS = 2400;
const HARD_RISK_TAGS = new Set([
  'medical', 'dental-instrument', 'mouth-contact-health', 'baby-sleep-safety',
  'electrical-heating', 'hazardous', 'weapon', 'prescription', 'counterfeit',
]);

let certCache = { expiresAt: 0, certs: null };

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function clean(value, max = 1000) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, max);
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
  const maxAge = Number((response.headers.get('cache-control') || '').match(/max-age=(\d+)/i)?.[1] || 300);
  certCache = { certs, expiresAt: now + maxAge * 1000 };
  return certs;
}

async function verifyFirebaseIdToken(authHeader) {
  const token = clean(authHeader, 10_000).replace(/^Bearer\s+/i, '').trim();
  if (!token) throw new Error('missing Firebase bearer token');
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('invalid Firebase token format');
  const header = JSON.parse(base64urlDecode(parts[0]).toString('utf8'));
  const payload = JSON.parse(base64urlDecode(parts[1]).toString('utf8'));
  if (header.alg !== 'RS256' || !header.kid) throw new Error('invalid Firebase token header');
  const cert = (await getFirebaseCerts())?.[header.kid];
  if (!cert) throw new Error('Firebase signing certificate not found');
  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(`${parts[0]}.${parts[1]}`);
  verifier.end();
  if (!verifier.verify(cert, base64urlDecode(parts[2]))) throw new Error('Firebase token signature invalid');
  const nowSec = Math.floor(Date.now() / 1000);
  if (payload.aud !== FIREBASE_PROJECT_ID || payload.iss !== FIREBASE_ISSUER) throw new Error('Firebase token claims invalid');
  if (!payload.sub || !Number.isFinite(payload.exp) || payload.exp <= nowSec) throw new Error('Firebase token expired or subject missing');
  return payload;
}

function discoverySchema() {
  return {
    type: 'object',
    properties: {
      candidates: {
        type: 'array',
        maxItems: MAX_RESULTS,
        items: {
          type: 'object',
          properties: {
            productTitle: { type: 'string' },
            productSummary: { type: 'string' },
            ebayTitle: { type: 'string' },
            ebayUrl: { type: 'string' },
            soldCount: { type: 'integer', minimum: 1 },
            itemPriceCents: { type: 'integer', minimum: 1 },
            shippingMode: { type: 'string', enum: ['FREE', 'BUYER_PAID', 'UNKNOWN'] },
            shippingChargeCents: { type: 'integer', minimum: 0 },
            brandState: { type: 'string', enum: ['GENERIC', 'UNBRANDED', 'BRANDED_MARKET', 'UNKNOWN'] },
            ebayEvidenceText: { type: 'string' },
            supplierName: { type: 'string' },
            supplierUrl: { type: 'string' },
            supplierUnitCostCents: { type: 'integer', minimum: 1 },
            supplierMoq: { type: 'integer', minimum: 1 },
            supplierEvidenceText: { type: 'string' },
            sizeClass: { type: 'string', enum: ['SMALL', 'MEDIUM', 'BULKY', 'UNKNOWN'] },
            weightClass: { type: 'string', enum: ['LIGHT', 'MEDIUM', 'HEAVY', 'UNKNOWN'] },
            riskTags: { type: 'array', maxItems: 8, items: { type: 'string' } },
            exactnessNotes: { type: 'string' },
            confidence: { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW'] }
          },
          required: [
            'productTitle', 'productSummary', 'ebayTitle', 'ebayUrl', 'soldCount', 'itemPriceCents',
            'shippingMode', 'shippingChargeCents', 'brandState', 'ebayEvidenceText', 'supplierName',
            'supplierUrl', 'supplierUnitCostCents', 'supplierMoq', 'supplierEvidenceText', 'sizeClass',
            'weightClass', 'riskTags', 'exactnessNotes', 'confidence'
          ],
          additionalProperties: false
        }
      }
    },
    required: ['candidates'],
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

function isHost(url, expectedSuffix) {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    return host === expectedSuffix || host.endsWith(`.${expectedSuffix}`);
  } catch {
    return false;
  }
}

function normalizeKey(value) {
  return clean(value, 240).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function stage1Status(candidate) {
  const hardRisk = candidate.riskTags.some((tag) => HARD_RISK_TAGS.has(normalizeKey(tag).replace(/ /g, '-')));
  if (hardRisk) return 'FAIL';
  if (candidate.brandState === 'BRANDED_MARKET') return 'HOLD';
  if (candidate.soldCount >= 100 && candidate.supplierUnitCostCents <= Math.round(candidate.itemPriceCents * 0.2) && candidate.sizeClass !== 'BULKY' && candidate.weightClass !== 'HEAVY') return 'PASS';
  if (candidate.soldCount >= 25 && candidate.supplierUnitCostCents <= Math.round(candidate.itemPriceCents * 0.3)) return 'PASS';
  return 'HOLD';
}

function sanitizeCandidates(parsed, maxResults) {
  const seen = new Set();
  const result = [];
  const observedAt = new Date().toISOString();
  for (const raw of Array.isArray(parsed?.candidates) ? parsed.candidates : []) {
    if (!isHost(raw.ebayUrl, 'ebay.com') || !isHost(raw.supplierUrl, 'alibaba.com')) continue;
    if (!Number.isSafeInteger(raw.soldCount) || raw.soldCount < 1) continue;
    if (!Number.isSafeInteger(raw.itemPriceCents) || raw.itemPriceCents < 300 || raw.itemPriceCents > 20000) continue;
    if (!Number.isSafeInteger(raw.supplierUnitCostCents) || raw.supplierUnitCostCents < 1) continue;
    if (!Number.isSafeInteger(raw.supplierMoq) || raw.supplierMoq < 1) continue;
    const key = normalizeKey(raw.productTitle);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const candidate = {
      schemaVersion: '1.0.0',
      provenance: 'WEB_OBSERVED',
      observedAt,
      productTitle: clean(raw.productTitle, 240),
      productSummary: clean(raw.productSummary, 500),
      ebay: {
        title: clean(raw.ebayTitle, 300),
        url: new URL(raw.ebayUrl).toString(),
        soldCount: raw.soldCount,
        itemPriceCents: raw.itemPriceCents,
        shippingMode: raw.shippingMode,
        shippingChargeCents: raw.shippingChargeCents,
        brandState: raw.brandState,
        evidenceText: clean(raw.ebayEvidenceText, 700),
      },
      supplier: {
        name: clean(raw.supplierName, 200),
        url: new URL(raw.supplierUrl).toString(),
        unitCostCents: raw.supplierUnitCostCents,
        moq: raw.supplierMoq,
        evidenceText: clean(raw.supplierEvidenceText, 700),
      },
      sizeClass: raw.sizeClass,
      weightClass: raw.weightClass,
      riskTags: (Array.isArray(raw.riskTags) ? raw.riskTags : []).map((tag) => clean(tag, 80)).filter(Boolean),
      exactnessNotes: clean(raw.exactnessNotes, 500),
      confidence: raw.confidence,
    };
    candidate.preliminarySourceRatioBps = Math.round((candidate.supplier.unitCostCents / candidate.ebay.itemPriceCents) * 10_000);
    candidate.stage1 = stage1Status({
      riskTags: candidate.riskTags,
      brandState: candidate.ebay.brandState,
      soldCount: candidate.ebay.soldCount,
      supplierUnitCostCents: candidate.supplier.unitCostCents,
      itemPriceCents: candidate.ebay.itemPriceCents,
      sizeClass: candidate.sizeClass,
      weightClass: candidate.weightClass,
    });
    result.push(candidate);
    if (result.length >= maxResults) break;
  }
  return result;
}

async function runDiscovery({ maxResults, focus, oidcToken }) {
  const focusText = clean(focus, 300) || 'broad household, kitchen, automotive, cleaning, workshop, pet accessory and simple tool categories';
  const prompt = `Independently discover up to ${maxResults} current eBay-to-Alibaba sourcing candidates for a resale intelligence report.\n\nFocus: ${focusText}.\n\nHard rules:\n- Use web search and return only candidates for which you can observe a real eBay listing or indexed eBay result showing an explicit sold count and item price, plus a real Alibaba product/supplier result showing a public unit price and MOQ.\n- Prefer generic or unbranded products; do not transfer demand from a famous branded product to a generic substitute.\n- Prefer >=100 eBay sold, item price about $10-$40, small/light/simple/durable products, supplier unit price <=20% of eBay item price, and multiple-source product families.\n- You may include a lower-ASP product only when the demand/source spread is unusually strong and bundles or buyer-paid shipping could plausibly solve fulfillment economics.\n- Exclude medical/dental instruments, mouth-contact health/snoring products, infant sleep/safety, electrical heating products, weapons, hazardous goods, restricted products, counterfeit/IP-dependent goods, and obvious proprietary designs.\n- Do not invent sold counts, price, MOQ, shipping, weight, dimensions, or product equivalence. If a sold count or supplier price cannot be observed, omit the candidate.\n- ebayEvidenceText must state where the sold count and price appear. supplierEvidenceText must state the displayed supplier price and MOQ.\n- exactnessNotes must describe whether the supplier product appears exact/high-confidence/partial and what still needs BOM verification.\n- This is Stage-1 discovery only. Never call a candidate BUY and never claim landed profit before shipping/fees/returns are modeled.\n\nReturn the strongest candidates only; empty output is preferred to weak or invented evidence.`;

  const response = await fetch(AI_GATEWAY_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${oidcToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      input: [{ type: 'message', role: 'user', content: prompt }],
      tools: [{ type: 'web_search' }],
      tool_choice: 'auto',
      max_output_tokens: MAX_OUTPUT_TOKENS,
      text: { format: { type: 'json_schema', name: 'datascout_product_discovery', strict: true, schema: discoverySchema() } },
      providerOptions: { gateway: { only: ['openai'] } }
    })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`AI Gateway ${response.status}: ${clean(payload?.error?.message || payload?.error || 'request failed')}`);
  if (payload?.status && payload.status !== 'completed') throw new Error(`AI Gateway response ${payload.status}`);
  const output = responseOutputText(payload);
  if (!output) return { providerRequestId: payload?.id || null, candidates: [] };
  let parsed;
  try { parsed = JSON.parse(output); } catch { throw new Error('structured discovery output was not valid JSON'); }
  return { providerRequestId: payload?.id || null, candidates: sanitizeCandidates(parsed, maxResults) };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST required' });
  try {
    const user = await verifyFirebaseIdToken(req.headers.authorization);
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const maxResults = Math.min(MAX_RESULTS, Math.max(1, Number(body.maxResults || MAX_RESULTS)));
    if (!Number.isSafeInteger(maxResults)) return send(res, 400, { error: 'maxResults must be an integer from 1 to 10' });
    const approvedMaxCostUsd = Number(body.approvedMaxCostUsd || 0);
    if (!Number.isFinite(approvedMaxCostUsd) || approvedMaxCostUsd < CONSERVATIVE_RUN_CEILING_USD || approvedMaxCostUsd > MAX_RUN_APPROVAL_USD) {
      return send(res, 402, {
        status: 'COST_APPROVAL_REQUIRED',
        requiredApprovalUsd: CONSERVATIVE_RUN_CEILING_USD,
        maxAllowedApprovalUsd: MAX_RUN_APPROVAL_USD,
      });
    }
    const oidcToken = process.env.VERCEL_OIDC_TOKEN;
    if (!oidcToken) return send(res, 503, { error: 'Vercel OIDC token unavailable; preview must run inside the Git-bound Vercel project.' });

    const discovery = await runDiscovery({ maxResults, focus: body.focus, oidcToken });
    return send(res, 200, {
      schemaVersion: '1.0.0',
      lane: 'RUN-004-PRODUCT-OPPORTUNITY-DISCOVERY',
      mode: 'BOUNDED_G5_SHADOW',
      authenticatedUid: user.sub,
      provider: 'vercel-ai-gateway/openai-web-search',
      providerRequestId: discovery.providerRequestId,
      approvedMaxCostUsd,
      conservativeRunCeilingUsd: CONSERVATIVE_RUN_CEILING_USD,
      candidates: discovery.candidates,
      stage1PassCount: discovery.candidates.filter((candidate) => candidate.stage1 === 'PASS').length,
      externalActions: 0,
      purchases: 0,
      messages: 0,
      listings: 0,
      productionMutations: 0,
      nextGate: 'Exact BOM + supplier comparison + deterministic landed-economics stress test',
    });
  } catch (error) {
    console.error('DataScout product opportunity discovery failed', error);
    return send(res, 500, { error: error instanceof Error ? error.message : 'product discovery failed' });
  }
}
