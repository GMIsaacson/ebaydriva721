'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createWorkControlProvider, validateWorkControlReceipt } = require('../runtime/work-control-provider.cjs');

function response(status, payload) {
  return { ok: status >= 200 && status < 300, status, json: async () => payload };
}

test('queues one governed assignment and returns receipt provenance', async () => {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url, init });
    if (url.endsWith('/api/v1/commands') && init.method === 'POST') {
      return response(201, { command: { commandId: 'WC-TEST-001' } });
    }
    return response(200, { receipt: {
      commandId: 'WC-TEST-001', terminalState: 'DELIVERED', detail: 'Professional evidence-bounded interpretation.',
      modelExecution: { provider: 'openai', model: 'gpt-test', responseId: 'resp_1', estimatedCostCents: 0.7 }
    }});
  };
  const provider = createWorkControlProvider({ fetchImpl, pollMs: 1, timeoutMs: 50, aggregateBudgetCents: 200 });
  const result = await provider({ kind: 'specialist', actorId: 'wti-ai-software-specialist', caseId: 'C1', domains: ['ai-software'], evidenceRefs: ['E1'], evidencePayload: { claim: 'x' } });
  assert.equal(result.actorId, 'wti-ai-software-specialist');
  assert.equal(result.provider, 'openai');
  assert.equal(result.executionId, 'WC-TEST-001');
  assert.equal(result.estimatedCostCents, 0.7);
  assert.equal(provider.budget().spentCents, 0.7);
  assert.equal(calls.length, 2);
});

test('fails closed when worker does not deliver', () => {
  assert.throws(() => validateWorkControlReceipt({ receipt: {
    commandId: 'WC-X', terminalState: 'BLOCKED_EXTERNAL', detail: 'blocked', modelExecution: { provider: 'openai', model: 'm', responseId: 'r', estimatedCostCents: 0 }
  }}, { actorId: 'reviewer', evidenceRefs: ['E1'] }), /WTI_WORK_CONTROL_NOT_DELIVERED/);
});

test('fails closed above 2-cent assignment ceiling', () => {
  assert.throws(() => validateWorkControlReceipt({ receipt: {
    commandId: 'WC-X', terminalState: 'DELIVERED', detail: 'x', modelExecution: { provider: 'openai', model: 'm', responseId: 'r', estimatedCostCents: 2.01 }
  }}, { actorId: 'reviewer', evidenceRefs: ['E1'] }), /WTI_ASSIGNMENT_BUDGET_EXCEEDED/);
});

test('fails closed if aggregate shadow budget would be exceeded', async () => {
  let n = 0;
  const fetchImpl = async (url, init = {}) => {
    if (url.endsWith('/api/v1/commands') && init.method === 'POST') return response(201, { command: { commandId: `WC-${++n}` } });
    return response(200, { receipt: { commandId: `WC-${n}`, terminalState: 'DELIVERED', detail: 'x', modelExecution: { provider: 'openai', model: 'm', responseId: `r${n}`, estimatedCostCents: 1.5 } } });
  };
  const provider = createWorkControlProvider({ fetchImpl, pollMs: 1, timeoutMs: 50, aggregateBudgetCents: 2 });
  await provider({ kind: 'specialist', actorId: 'a', evidenceRefs: ['E1'], domains: ['ai-software'] });
  await assert.rejects(() => provider({ kind: 'reviewer', actorId: 'b', evidenceRefs: ['E1'], domains: ['ai-software'] }), /WTI_SHADOW_BUDGET_EXCEEDED/);
});
