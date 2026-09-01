'use strict';

const DEFAULT_TEAM_ID = 'WTI-016';
const DEFAULT_ASSIGNMENT_BUDGET_CENTS = 2;
const DEFAULT_SHADOW_BUDGET_CENTS = 200;

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function text(value, max = 1600) { return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max); }

function buildAssignmentInstruction(request) {
  const evidence = text(JSON.stringify(request.evidencePayload || {}), 900);
  const prior = text(JSON.stringify(request.specialistOutputs || []), 700);
  return [
    `RUN016 PROFESSIONAL SHADOW. Actor=${request.actorId}. Kind=${request.kind}.`,
    `Case=${request.caseId || 'unknown'}. Domains=${(request.domains || []).join(',')}.`,
    `Evidence refs=${(request.evidenceRefs || []).join(',')}.`,
    evidence ? `Supplied evidence=${evidence}` : '',
    prior ? `Specialist outputs to independently review=${prior}` : '',
    request.instructions || '',
    'Return a bounded professional analysis only from supplied evidence. State observed facts, inference, uncertainty and material implications. Do not browse, invent evidence, or perform external actions.'
  ].filter(Boolean).join(' ');
}

function validateWorkControlReceipt(payload, request) {
  const receipt = payload?.receipt;
  if (!receipt) throw new Error(`WTI_WORK_CONTROL_RECEIPT_MISSING:${request.actorId}`);
  if (receipt.terminalState !== 'DELIVERED') throw new Error(`WTI_WORK_CONTROL_NOT_DELIVERED:${request.actorId}:${receipt.terminalState}`);
  const model = receipt.modelExecution || {};
  if (model.provider !== 'openai' || !model.model || !model.responseId) throw new Error(`WTI_WORK_CONTROL_MODEL_PROVENANCE_MISSING:${request.actorId}`);
  const cost = Number(model.estimatedCostCents || 0);
  if (!Number.isFinite(cost) || cost < 0 || cost > DEFAULT_ASSIGNMENT_BUDGET_CENTS) throw new Error(`WTI_ASSIGNMENT_BUDGET_EXCEEDED:${request.actorId}`);
  return {
    actorId: request.actorId,
    provider: model.provider,
    model: model.model,
    output: receipt.detail,
    evidenceRefs: request.evidenceRefs,
    executionId: receipt.commandId,
    confidence: null,
    estimatedCostCents: cost,
  };
}

function createWorkControlProvider(options = {}) {
  const fetchImpl = options.fetchImpl || global.fetch;
  if (typeof fetchImpl !== 'function') throw new Error('WTI_WORK_CONTROL_FETCH_REQUIRED');
  const baseUrl = String(options.baseUrl || 'http://127.0.0.1:8787').replace(/\/$/, '');
  const teamId = options.teamId || DEFAULT_TEAM_ID;
  const pollMs = Number(options.pollMs || 1000);
  const timeoutMs = Number(options.timeoutMs || 120000);
  const aggregateBudgetCents = Number(options.aggregateBudgetCents || DEFAULT_SHADOW_BUDGET_CENTS);
  let spentCents = 0;

  async function jsonRequest(path, init = {}) {
    const response = await fetchImpl(`${baseUrl}${path}`, {
      ...init,
      headers: { 'content-type': 'application/json', ...(init.headers || {}) }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`WTI_WORK_CONTROL_HTTP_${response.status}:${payload.error || 'UNKNOWN'}`);
    return payload;
  }

  const provider = async (request) => {
    if (spentCents >= aggregateBudgetCents) throw new Error('WTI_SHADOW_BUDGET_EXHAUSTED');
    const queued = await jsonRequest('/api/v1/commands', {
      method: 'POST',
      body: JSON.stringify({ teamId, instruction: buildAssignmentInstruction(request), priority: 'normal' })
    });
    const commandId = queued?.command?.commandId;
    if (!commandId) throw new Error('WTI_WORK_CONTROL_COMMAND_ID_MISSING');

    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const state = await jsonRequest(`/api/v1/commands/${encodeURIComponent(commandId)}`);
      if (state.receipt) {
        const result = validateWorkControlReceipt(state, request);
        if (spentCents + result.estimatedCostCents > aggregateBudgetCents) throw new Error('WTI_SHADOW_BUDGET_EXCEEDED');
        spentCents += result.estimatedCostCents;
        return result;
      }
      await sleep(pollMs);
    }
    throw new Error(`WTI_WORK_CONTROL_TIMEOUT:${commandId}`);
  };

  provider.budget = () => ({ spentCents, aggregateBudgetCents, remainingCents: Math.max(0, aggregateBudgetCents - spentCents) });
  return provider;
}

module.exports = {
  DEFAULT_TEAM_ID,
  DEFAULT_ASSIGNMENT_BUDGET_CENTS,
  DEFAULT_SHADOW_BUDGET_CENTS,
  buildAssignmentInstruction,
  validateWorkControlReceipt,
  createWorkControlProvider,
};
