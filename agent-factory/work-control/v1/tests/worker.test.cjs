const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const Core = require('../worker-core.cjs');

const ROOT = path.resolve(__dirname, '..');
const profileSet = JSON.parse(fs.readFileSync(path.join(ROOT, 'team-profiles.json'), 'utf8'));
const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'registry.json'), 'utf8'));

function sampleCommand(teamId = 'SW-PROD-014', name = 'Software Product Engineering', run = 'Run 014', kind = 'reusable-team', instruction = 'Review this idea and tell me what should happen next.') {
  return {
    commandType: 'team_assignment_v1',
    commandId: `WC-TEST-${teamId}`,
    team: { id: teamId, run, name, kind },
    instruction,
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

test('profile set is structurally valid', () => {
  assert.equal(Core.validateProfileSet(profileSet), true);
  assert.equal(profileSet.profileSetVersion, '2026-08-23.2');
});

test('every runnable registry team has exactly one execution profile', () => {
  const runnable = registry.teams.filter((team) => team.runnable === true).map((team) => team.id).sort();
  const profiled = profileSet.profiles.map((profile) => profile.teamId).sort();
  assert.deepEqual(profiled, runnable);
  assert.equal(new Set(profiled).size, profiled.length);
});

test('worker prompt includes canonical profile, authority and workflow stages', () => {
  const prompt = Core.buildWorkerPrompt(sampleCommand(), profileSet);
  assert.match(prompt, /TEAM EXECUTION PROFILE/);
  assert.match(prompt, /Product Spec Agent/);
  assert.match(prompt, /product_brief_v1/);
  assert.match(prompt, /Implementation cannot self-verify|implementation cannot self-verify/i);
  assert.match(prompt, /no external tools/i);
  assert.match(prompt, /BLOCKED_EXTERNAL/);
});

test('same ambiguous assignment yields materially different Opportunity vs Software profile prompts', () => {
  const instruction = 'Review this idea and tell me what should happen next.';
  const opp = Core.buildWorkerPrompt(sampleCommand('OPP-011', 'Opportunity Intelligence', 'Run 011', 'reusable-team', instruction), profileSet);
  const sw = Core.buildWorkerPrompt(sampleCommand('SW-PROD-014', 'Software Product Engineering', 'Run 014', 'reusable-team', instruction), profileSet);
  assert.match(opp, /Opportunity Underwriter/);
  assert.match(opp, /Escalate\/Watch\/Archive/);
  assert.match(opp, /Speed to revenue 20/);
  assert.match(opp, /Strategic fit 15/);
  assert.match(opp, /Automation potential 15/);
  assert.match(opp, /Evidence strength 15/);
  assert.match(opp, /Revenue potential 15/);
  assert.match(opp, /Low execution effort 10/);
  assert.match(opp, /Async\/low-call operability 5/);
  assert.match(opp, /Compounding\/defensibility 5/);
  assert.doesNotMatch(opp, /implementation_change_set_v1/);
  assert.match(sw, /implementation_change_set_v1/);
  assert.match(sw, /Security & Dependency Reviewer/);
  assert.match(sw, /ops_handoff_v1/);
  assert.doesNotMatch(sw, /Speed to revenue 20/);
  assert.notEqual(Core.sha256(opp), Core.sha256(sw));
});

test('Run 003 profile forces G0 validation-only and forbids pretending a mature team exists', () => {
  const prompt = Core.buildWorkerPrompt(sampleCommand('RUN-003', 'Bulk & Catch-Up Invoicing SaaS', 'Run 003', 'project-run', 'Build and deploy the complete invoicing platform.'), profileSet);
  assert.match(prompt, /g0-opportunity-validation-only/i);
  assert.match(prompt, /individual agents are not yet authorized/i);
  assert.match(prompt, /pretending a mature Run 003 team exists/i);
  assert.match(prompt, /two \$299 paid pilots required/i);
});

test('Run 002 profile preserves frozen state', () => {
  const prompt = Core.buildWorkerPrompt(sampleCommand('RUN-002', 'Central Kenya Pig Farm', 'Run 002', 'project-run', 'Implement changes at the farm today.'), profileSet);
  assert.match(prompt, /run is frozen/i);
  assert.match(prompt, /no live farm action/i);
  assert.match(prompt, /clinical diagnosis/i);
});

test('missing team profile fails closed before model execution', () => {
  assert.throws(() => Core.buildWorkerPrompt(sampleCommand('UNKNOWN-999', 'Unknown', 'Run 999', 'reusable-team'), profileSet), /TEAM_PROFILE_NOT_FOUND/);
});

test('raw Responses API output text is extracted from message content', () => {
  const text = Core.extractResponseText({ output: [{ type: 'message', content: [{ type: 'output_text', text: '{"terminalState":"DELIVERED","summary":"ok","detail":"done","steps":[]}' }] }] });
  assert.match(text, /DELIVERED/);
});

test('model result parser accepts bounded valid JSON', () => {
  const result = Core.parseModelResult(JSON.stringify({ terminalState: 'DELIVERED', summary: 'Completed', detail: 'Reasoning complete.', steps: [{ name: 'Product spec', detail: 'Used the profile stage.' }] }));
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
  assert.throws(() => Core.buildReceipt(command, result, { id: 'resp_x', usage: { input_tokens: 0, output_tokens: 4000 } }, 'gpt-5.6-luna', profileSet), /MODEL_BUDGET_EXCEEDED/);
});

test('bounded receipt reports zero authority and immutable profile identity', () => {
  const receipt = Core.buildReceipt(sampleCommand(), { terminalState: 'DELIVERED', summary: 'Completed', detail: 'No external action.', steps: [{ name: 'software_spec_v1', detail: 'Profile stage used.' }] }, { id: 'resp_x', usage: { input_tokens: 1000, output_tokens: 1000 } }, 'gpt-5.6-luna', profileSet);
  assert.equal(receipt.externalActionsPerformed, 0);
  assert.equal(receipt.spendCents, 0);
  assert.equal(receipt.productionMutation, false);
  assert.equal(receipt.modelExecution.estimatedCostCents, 0.7);
  assert.equal(receipt.teamExecutionProfile.teamId, 'SW-PROD-014');
  assert.equal(receipt.teamExecutionProfile.profileSetVersion, '2026-08-23.2');
  assert.match(receipt.teamExecutionProfile.profileSha256, /^[a-f0-9]{64}$/);
  assert.equal(receipt.steps[0].name, 'Team execution profile');
});

test('profile hash changes when contract content changes', () => {
  const profile = Core.getTeamProfile(profileSet, 'OPP-011');
  const changed = { ...profile, mission: `${profile.mission} changed` };
  assert.notEqual(Core.sha256(profile), Core.sha256(changed));
});

test('worker source makes one model invocation path, strict JSON schema output, and contains no API-key logging', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../worker.cjs'), 'utf8');
  assert.match(source, /team-profiles\.json/);
  assert.match(source, /loadProfileSet/);
  assert.match(source, /buildWorkerPrompt\(command, profileSet\)/);
  assert.match(source, /https:\/\/api\.openai\.com\/v1\/responses/);
  assert.equal((source.match(/api\.openai\.com\/v1\/responses/g) || []).length, 1);
  assert.equal((source.match(/await callOpenAI\(/g) || []).length, 1);
  assert.match(source, /type: 'json_schema'/);
  assert.match(source, /name: 'work_control_result'/);
  assert.match(source, /strict: true/);
  assert.match(source, /additionalProperties: false/);
  assert.match(source, /store: false/);
  assert.doesNotMatch(source, /console\.log\([^\n]*apiKey/i);
  assert.doesNotMatch(source, /console\.error\([^\n]*apiKey/i);
});
