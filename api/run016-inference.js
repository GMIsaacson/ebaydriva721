'use strict';

const crypto = require('crypto');

const GITHUB_ISSUER = 'https://token.actions.githubusercontent.com';
const GITHUB_JWKS = `${GITHUB_ISSUER}/.well-known/jwks`;
const EXPECTED_AUDIENCE = 'run016-vercel-inference';
const EXPECTED_REPOSITORY = 'GMIsaacson/ebaydriva721';
const EXPECTED_REF = 'refs/heads/master';
const GATEWAY_BASE = 'https://ai-gateway.vercel.sh/v1';
const ROLE_MODELS = Object.freeze({
  specialist: 'inclusionai/ling-3.0-flash-fin-free',
  reviewer: 'inclusionai/ling-3.0-flash-sante-free',
});

let jwksCache = { expiresAt: 0, keys: [] };
let modelCache = { expiresAt: 0, models: new Map() };

function json(res, status, body) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  return res.status(status).json(body);
}

function fromBase64Url(value) {
  return Buffer.from(value.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

function parseJwt(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) throw new Error('OIDC_MALFORMED_TOKEN');
  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  let header;
  let payload;
  try {
    header = JSON.parse(fromBase64Url(encodedHeader).toString('utf8'));
    payload = JSON.parse(fromBase64Url(encodedPayload).toString('utf8'));
  } catch (_) {
    throw new Error('OIDC_INVALID_JSON');
  }
  return {
    header,
    payload,
    signed: Buffer.from(`${encodedHeader}.${encodedPayload}`),
    signature: fromBase64Url(encodedSignature),
  };
}

async function getGithubJwks() {
  const now = Date.now();
  if (jwksCache.expiresAt > now && jwksCache.keys.length) return jwksCache.keys;
  const response = await fetch(GITHUB_JWKS, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`OIDC_JWKS_FETCH_FAILED:${response.status}`);
  const body = await response.json();
  if (!Array.isArray(body.keys) || !body.keys.length) throw new Error('OIDC_JWKS_EMPTY');
  jwksCache = { expiresAt: now + 15 * 60 * 1000, keys: body.keys };
  return jwksCache.keys;
}

function audienceMatches(aud) {
  return Array.isArray(aud) ? aud.includes(EXPECTED_AUDIENCE) : aud === EXPECTED_AUDIENCE;
}

async function verifyGithubOidc(token) {
  const decoded = parseJwt(token);
  if (decoded.header.alg !== 'RS256' || !decoded.header.kid) throw new Error('OIDC_UNSUPPORTED_HEADER');
  const keys = await getGithubJwks();
  const jwk = keys.find((key) => key.kid === decoded.header.kid);
  if (!jwk) throw new Error('OIDC_UNKNOWN_KEY');
  const publicKey = crypto.createPublicKey({ key: jwk, format: 'jwk' });
  const valid = crypto.verify('RSA-SHA256', decoded.signed, publicKey, decoded.signature);
  if (!valid) throw new Error('OIDC_BAD_SIGNATURE');

  const now = Math.floor(Date.now() / 1000);
  const claims = decoded.payload;
  if (claims.iss !== GITHUB_ISSUER) throw new Error('OIDC_BAD_ISSUER');
  if (!audienceMatches(claims.aud)) throw new Error('OIDC_BAD_AUDIENCE');
  if (!claims.exp || Number(claims.exp) < now - 30) throw new Error('OIDC_EXPIRED');
  if (claims.nbf && Number(claims.nbf) > now + 30) throw new Error('OIDC_NOT_ACTIVE');
  if (claims.repository !== EXPECTED_REPOSITORY) throw new Error('OIDC_BAD_REPOSITORY');
  if (claims.ref !== EXPECTED_REF) throw new Error('OIDC_BAD_REF');
  if (!['push', 'schedule', 'workflow_dispatch'].includes(claims.event_name)) throw new Error('OIDC_BAD_EVENT');
  if (claims.workflow_ref && !claims.workflow_ref.includes('.github/workflows/run-016-ai-platform-live.yml@refs/heads/master')) {
    throw new Error('OIDC_BAD_WORKFLOW');
  }
  return {
    repository: claims.repository,
    ref: claims.ref,
    runId: claims.run_id || null,
    runAttempt: claims.run_attempt || null,
    actor: claims.actor || null,
    eventName: claims.event_name,
    workflowRef: claims.workflow_ref || null,
  };
}

async function getGatewayModels() {
  const now = Date.now();
  if (modelCache.expiresAt > now && modelCache.models.size) return modelCache.models;
  const response = await fetch(`${GATEWAY_BASE}/models`, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`MODEL_CATALOG_FAILED:${response.status}`);
  const body = await response.json();
  const models = new Map((body.data || []).map((model) => [model.id, model]));
  modelCache = { expiresAt: now + 5 * 60 * 1000, models };
  return models;
}

function assertZeroSpendModel(model) {
  if (!model) throw new Error('MODEL_NOT_IN_CATALOG');
  if (model.type !== 'language') throw new Error('MODEL_NOT_LANGUAGE');
  const tags = Array.isArray(model.tags) ? model.tags : [];
  if (!tags.includes('free')) throw new Error('MODEL_NOT_MARKED_FREE');
  const input = Number(model.pricing?.input);
  const output = Number(model.pricing?.output);
  if (!Number.isFinite(input) || !Number.isFinite(output) || input !== 0 || output !== 0) {
    throw new Error('MODEL_PRICE_NOT_ZERO');
  }
  return {
    modelId: model.id,
    modelName: model.name,
    inputPricePerToken: input,
    outputPricePerToken: output,
    freeTag: true,
    checkedAt: new Date().toISOString(),
  };
}

async function callGateway({ role, system, schemaInstruction, payload }) {
  const modelId = ROLE_MODELS[role];
  if (!modelId) throw new Error('UNSUPPORTED_ROLE');
  const models = await getGatewayModels();
  const pricingReceipt = assertZeroSpendModel(models.get(modelId));
  const gatewayToken = process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN;
  if (!gatewayToken) throw new Error('VERCEL_OIDC_TOKEN_UNAVAILABLE');

  const response = await fetch(`${GATEWAY_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${gatewayToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      model: modelId,
      temperature: 0.1,
      max_tokens: role === 'specialist' ? 1200 : 900,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: JSON.stringify({ expectedSchema: schemaInstruction, payload }) },
      ],
    }),
  });

  const text = await response.text();
  if (!response.ok) throw new Error(`AI_GATEWAY_FAILED:${response.status}:${text.slice(0, 700)}`);
  let data;
  try { data = JSON.parse(text); } catch (_) { throw new Error('AI_GATEWAY_INVALID_JSON'); }
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('AI_GATEWAY_EMPTY_RESPONSE');
  return {
    content,
    usage: data.usage || null,
    model: data.model || modelId,
    requestedModel: modelId,
    pricingReceipt,
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'METHOD_NOT_ALLOWED' });
  const auth = String(req.headers.authorization || '');
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return json(res, 401, { error: 'OIDC_TOKEN_REQUIRED' });

  let identity;
  try {
    identity = await verifyGithubOidc(token);
  } catch (error) {
    return json(res, 403, { error: error.message });
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const { role, system, schemaInstruction, payload } = body;
  if (!ROLE_MODELS[role]) return json(res, 400, { error: 'UNSUPPORTED_ROLE' });
  if (typeof system !== 'string' || system.length < 20 || system.length > 12000) return json(res, 400, { error: 'INVALID_SYSTEM_PROMPT' });
  const serializedPayload = JSON.stringify(payload || {});
  if (serializedPayload.length > 30000) return json(res, 413, { error: 'PAYLOAD_TOO_LARGE' });

  try {
    const result = await callGateway({ role, system, schemaInstruction, payload });
    return json(res, 200, {
      ok: true,
      role,
      content: result.content,
      usage: result.usage,
      model: result.model,
      requestedModel: result.requestedModel,
      pricingReceipt: result.pricingReceipt,
      callerReceipt: identity,
      externalActionsPerformed: 0,
    });
  } catch (error) {
    return json(res, 503, { error: error.message, role });
  }
};
