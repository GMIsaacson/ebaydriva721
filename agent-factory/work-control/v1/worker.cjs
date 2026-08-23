'use strict';

const fs = require('fs');
const WorkerCore = require('./worker-core.cjs');

const WORKER_ID = process.env.WORK_CONTROL_WORKER_ID || 'factory-worker-v1';
const CONTROL_URL = process.env.WORK_CONTROL_URL || 'http://work-control:8787';
const WORKER_TOKEN = process.env.WORK_CONTROL_WORKER_TOKEN || '';
const MODEL = process.env.OPENAI_MODEL || 'gpt-5.6-luna';
const MAX_OUTPUT_TOKENS = Number(process.env.OPENAI_MAX_OUTPUT_TOKENS || 1600);
const POLL_MS = Number(process.env.WORK_CONTROL_POLL_MS || 5000);
const PRIVATE_KEY_PATH = process.env.OPENAI_KEY_PRIVATE_PATH || '/run/secrets/openai-transport-private.pem';
const ENCRYPTED_KEY_PATH = process.env.OPENAI_KEY_CIPHERTEXT_PATH || '/run/secrets/openai-key-ciphertext.txt';

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

function loadApiKey() {
  const privatePem = fs.readFileSync(PRIVATE_KEY_PATH, 'utf8');
  const ciphertext = fs.readFileSync(ENCRYPTED_KEY_PATH, 'utf8').trim();
  return WorkerCore.decryptApiKey(privatePem, ciphertext);
}

async function controlRequest(path, options = {}) {
  const response = await fetch(`${CONTROL_URL}${path}`, {
    method: options.method || 'GET',
    headers: {
      'content-type': 'application/json',
      'x-work-control-worker-token': WORKER_TOKEN,
      ...(options.headers || {})
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });
  const text = await response.text();
  let payload = {};
  try { payload = text ? JSON.parse(text) : {}; } catch { payload = { raw: text }; }
  if (!response.ok) {
    const error = new Error(payload.error || `CONTROL_HTTP_${response.status}`);
    error.statusCode = response.status;
    throw error;
  }
  return payload;
}

async function heartbeat() {
  return controlRequest('/api/v1/worker/heartbeat', {
    method: 'POST',
    body: { workerId: WORKER_ID, model: MODEL, state: 'ONLINE' }
  });
}

async function claimNext() {
  return controlRequest('/api/v1/worker/next', {
    method: 'POST',
    body: { workerId: WORKER_ID }
  });
}

async function callOpenAI(apiKey, command) {
  const prompt = WorkerCore.buildWorkerPrompt(command);
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'authorization': `Bearer ${apiKey}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: MODEL,
      input: prompt,
      max_output_tokens: MAX_OUTPUT_TOKENS
    })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(`OPENAI_HTTP_${response.status}`);
    error.openaiType = payload?.error?.type || null;
    throw error;
  }
  return payload;
}

function failureReceipt(command, error) {
  const safeCode = String(error?.message || 'WORKER_FAILURE').replace(/[^A-Za-z0-9_:-]/g, '_').slice(0, 160);
  return {
    schemaVersion: '1.0',
    commandId: command.commandId,
    terminalState: 'FAILED',
    summary: 'Governed worker execution failed',
    detail: `The assignment was claimed but execution stopped fail-closed with ${safeCode}. No retry was attempted and no external action was performed.`,
    steps: [{ name: 'Worker claim', detail: 'Assignment was atomically claimed before model execution.' }, { name: 'Fail closed', detail: `Execution stopped with ${safeCode}; automatic retry disabled.` }],
    completedAt: new Date().toISOString(),
    externalActionsPerformed: 0,
    spendCents: 0,
    productionMutation: false,
    modelExecution: { provider: 'openai', model: MODEL, responseId: null, inputTokens: 0, outputTokens: 0, estimatedCostCents: 0 }
  };
}

async function submitReceipt(receipt) {
  return controlRequest('/api/v1/worker/receipts', { method: 'POST', body: receipt });
}

async function processCommand(apiKey, command) {
  try {
    const response = await callOpenAI(apiKey, command);
    const text = WorkerCore.extractResponseText(response);
    const modelResult = WorkerCore.parseModelResult(text);
    const receipt = WorkerCore.buildReceipt(command, modelResult, response, MODEL);
    await submitReceipt(receipt);
    return { commandId: command.commandId, terminalState: receipt.terminalState, estimatedCostCents: receipt.modelExecution.estimatedCostCents };
  } catch (error) {
    const receipt = failureReceipt(command, error);
    try { await submitReceipt(receipt); } catch {}
    throw error;
  }
}

async function runLoop({ once = false } = {}) {
  if (!WORKER_TOKEN) throw new Error('WORK_CONTROL_WORKER_TOKEN_REQUIRED');
  if (!Number.isInteger(MAX_OUTPUT_TOKENS) || MAX_OUTPUT_TOKENS < 100 || MAX_OUTPUT_TOKENS > 1600) throw new Error('INVALID_MAX_OUTPUT_TOKENS');
  const apiKey = loadApiKey();
  let processed = 0;
  do {
    await heartbeat();
    const next = await claimNext();
    if (next.status === 'CLAIMED' && next.command) {
      const result = await processCommand(apiKey, next.command);
      processed += 1;
      console.log(JSON.stringify({ status: 'PROCESSED', ...result }));
    } else if (once) {
      console.log(JSON.stringify({ status: 'IDLE' }));
    }
    if (!once) await sleep(POLL_MS);
  } while (!once);
  return processed;
}

if (require.main === module) {
  runLoop({ once: process.argv.includes('--once') }).catch((error) => {
    console.error(JSON.stringify({ status: 'FAILED', error: String(error?.message || error).slice(0, 180) }));
    process.exit(1);
  });
}

module.exports = { loadApiKey, controlRequest, heartbeat, claimNext, callOpenAI, failureReceipt, submitReceipt, processCommand, runLoop };
