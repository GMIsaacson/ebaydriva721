'use strict';

const crypto = require('crypto');

const TERMINAL_STATES = new Set(['DELIVERED', 'BLOCKED_OWNER', 'BLOCKED_EXTERNAL', 'KILLED', 'FAILED']);
const MAX_STEPS = 8;

function normalizeText(value, max = 4000) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function decodeBase64Url(value) {
  const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(normalized, 'base64');
}

function decryptApiKey(privatePem, ciphertext) {
  const cipher = decodeBase64Url(ciphertext);
  for (const oaepHash of ['sha256', 'sha1']) {
    try {
      const plaintext = crypto.privateDecrypt({
        key: privatePem,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash
      }, cipher).toString('utf8').trim();
      if (/^sk-[A-Za-z0-9_-]{20,}$/.test(plaintext)) return plaintext;
    } catch {}
  }
  throw new Error('API_KEY_DECRYPTION_FAILED');
}

function buildWorkerPrompt(command) {
  if (!command || command.commandType !== 'team_assignment_v1') throw new Error('INVALID_COMMAND');
  return [
    'You are the governed execution worker for an internal digital workforce.',
    `Team: ${command.team.name} (${command.team.run}; ${command.team.kind}).`,
    `Assignment: ${command.instruction}`,
    '',
    'Hard rules:',
    '- You have no external tools, browsing, connectors, shell, deployment, messaging, purchasing, or production access in this worker version.',
    '- Do not claim you performed an action you could not perform.',
    '- If the assignment requires unavailable external data, credentials, tools, owner authority, or real-world action, return BLOCKED_EXTERNAL or BLOCKED_OWNER rather than inventing evidence.',
    '- If the assignment is fully answerable by reasoning from the provided instruction, complete it.',
    '- Keep the result concise and operational.',
    '',
    'Return ONLY valid JSON with this exact shape:',
    '{"terminalState":"DELIVERED|BLOCKED_OWNER|BLOCKED_EXTERNAL|KILLED|FAILED","summary":"short result","detail":"useful deliverable or blocker explanation","steps":[{"name":"stage","detail":"what was actually done"}]}'
  ].join('\n');
}

function extractResponseText(response) {
  if (typeof response?.output_text === 'string' && response.output_text.trim()) return response.output_text.trim();
  const parts = [];
  for (const item of Array.isArray(response?.output) ? response.output : []) {
    for (const content of Array.isArray(item?.content) ? item.content : []) {
      if (typeof content?.text === 'string') parts.push(content.text);
    }
  }
  return parts.join('\n').trim();
}

function parseModelResult(text) {
  const raw = String(text || '').trim();
  if (!raw) throw new Error('EMPTY_MODEL_OUTPUT');
  let value;
  try {
    value = JSON.parse(raw);
  } catch {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start < 0 || end <= start) throw new Error('MODEL_OUTPUT_NOT_JSON');
    try { value = JSON.parse(raw.slice(start, end + 1)); }
    catch { throw new Error('MODEL_OUTPUT_NOT_JSON'); }
  }
  if (!TERMINAL_STATES.has(value.terminalState)) throw new Error('INVALID_MODEL_TERMINAL_STATE');
  const summary = normalizeText(value.summary, 300);
  const detail = normalizeText(value.detail, 4000);
  if (!summary || !detail) throw new Error('MODEL_RESULT_FIELDS_REQUIRED');
  const steps = (Array.isArray(value.steps) ? value.steps : []).slice(0, MAX_STEPS).map((step, index) => ({
    name: normalizeText(step?.name || `Stage ${index + 1}`, 100),
    detail: normalizeText(step?.detail || '', 600)
  })).filter((step) => step.name && step.detail);
  return { terminalState: value.terminalState, summary, detail, steps };
}

function estimateModelCostCents(usage, pricing = { inputPerMillion: 1, outputPerMillion: 6 }) {
  const inputTokens = Number(usage?.input_tokens || 0);
  const outputTokens = Number(usage?.output_tokens || 0);
  if (!Number.isFinite(inputTokens) || !Number.isFinite(outputTokens) || inputTokens < 0 || outputTokens < 0) return null;
  const dollars = (inputTokens / 1_000_000) * pricing.inputPerMillion + (outputTokens / 1_000_000) * pricing.outputPerMillion;
  return Math.ceil(dollars * 10000) / 100;
}

function buildReceipt(command, modelResult, response, model) {
  const modelCostCentsEstimated = estimateModelCostCents(response?.usage);
  if (modelCostCentsEstimated !== null && modelCostCentsEstimated > Number(command.modelBudgetCents || 0)) {
    throw new Error('MODEL_BUDGET_EXCEEDED');
  }
  return {
    schemaVersion: '1.0',
    commandId: command.commandId,
    terminalState: modelResult.terminalState,
    summary: modelResult.summary,
    detail: modelResult.detail,
    steps: modelResult.steps,
    completedAt: new Date().toISOString(),
    externalActionsPerformed: 0,
    spendCents: 0,
    productionMutation: false,
    modelExecution: {
      provider: 'openai',
      model,
      responseId: normalizeText(response?.id, 120) || null,
      inputTokens: Number(response?.usage?.input_tokens || 0),
      outputTokens: Number(response?.usage?.output_tokens || 0),
      estimatedCostCents: modelCostCentsEstimated
    }
  };
}

module.exports = {
  TERMINAL_STATES,
  MAX_STEPS,
  normalizeText,
  decodeBase64Url,
  decryptApiKey,
  buildWorkerPrompt,
  extractResponseText,
  parseModelResult,
  estimateModelCostCents,
  buildReceipt
};
