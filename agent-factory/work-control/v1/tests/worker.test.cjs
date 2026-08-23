const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const Core = require('../worker-core.cjs');

function sampleCommand() {
  return {
    commandType: 'team_assignment_v1',
    commandId: 'WC-TEST-001',
    team: { id: 'SW-PROD-014', run: 'Run 014', name: 'Software Product Engineering', kind: 'reusable-team' },
    instruction: 'Explain the worker authority boundary',
    modelBudgetCents: 2,
    authorityCeiling: { maxExternalActions: 0, maxSpendCents: 0, productionMutation: false }
  };
}

test('encrypted OpenAI key decrypts only in memory', () => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048, publicExponent: 0x10001 });
  const mockKey = 'sk-proj-' + 'A'.repeat(40);
  const ciphertext = crypto.publicEncrypt({ key: publicKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, Buffer.from(mockKey)).toString('base64url');
  const decrypted = Core.decryptApiKey(privateKey.export({ type: 'pkcs8', format: 'pem' }), ciphertext);
  assert.equal(decrypted, mockKey);
});

test('worker prompt is explicit about unavailable tools and fail-closed blocking', () => {
  const prompt = Core.buildWorkerPrompt(sampleCommand());
  assert.match(prompt, /no external tools/i);
  assert.match(prompt, /do not claim/i);
  assert.match(prompt, /BLOCKED_EXTERNAL/);
  assert.match(prompt, /Software Product Engineering/);
});

test('raw Responses API output text is extracted from message content', () => {
  const text = Core.extractResponseText({ output: [{ type: 'message', content: [{ type: 'output_text', text: '{"terminalState":"DELIVERED","summary":"ok","detail":"done","steps":[]}' }] }] });
  assert.match(text, /DELIVERED/);
});

test('model result parser accepts bounded valid JSON', () => {
  const result = Core.parseModelResult(JSON.stringify({ terminalState: 'DELIVERED', summary: 'Completed', detail: 'Reasoning complete.', steps: [{ name: 'Analyze', detail: 'Used supplied instruction only.' }] }));
  assert.equal(result.terminalState, 'DELIVERED');
  assert.equal(result.steps.length, 1);
});

test('model result parser rejects invented terminal states', () => {
  assert.throws(() => Core.parseModelResult('{"terminalState":"DEPLOYED","summary":"x","detail":"y"}'), /INVALID_MODEL_TERMINAL_STATE/);
});

test('model cost estimate matches current Luna standard token pricing constants', () => {
  assert.equal(Core.estimateModelCostCents({ input_tokens: 1000, output_tokens: 1000 }), 0.7);
});

test('receipt builder rejects usage above per-command model budget', () => {
  const command = sampleCommand();
  const result = { terminalState: 'DELIVERED', summary: 'x', detail: 'y', steps: [] };
  assert.throws(() => Core.buildReceipt(command, result, { id: 'resp_x', usage: { input_tokens: 0, output_tokens: 4000 } }, 'gpt-5.6-luna'), /MODEL_BUDGET_EXCEEDED/);
});

test('bounded receipt always reports zero external action and external spend', () => {
  const receipt = Core.buildReceipt(sampleCommand(), { terminalState: 'DELIVERED', summary: 'Completed', detail: 'No external action.', steps: [] }, { id: 'resp_x', usage: { input_tokens: 1000, output_tokens: 1000 } }, 'gpt-5.6-luna');
  assert.equal(receipt.externalActionsPerformed, 0);
  assert.equal(receipt.spendCents, 0);
  assert.equal(receipt.productionMutation, false);
  assert.equal(receipt.modelExecution.estimatedCostCents, 0.7);
});

test('worker source makes one Responses API call path and contains no API-key logging', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../worker.cjs'), 'utf8');
  assert.match(source, /https:\/\/api\.openai\.com\/v1\/responses/);
  assert.equal((source.match(/api\.openai\.com\/v1\/responses/g) || []).length, 1);
  assert.doesNotMatch(source, /console\.log\([^\n]*apiKey/i);
  assert.doesNotMatch(source, /console\.error\([^\n]*apiKey/i);
  assert.doesNotMatch(source, /retry/i);
});
