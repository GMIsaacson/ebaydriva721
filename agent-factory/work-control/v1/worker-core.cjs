'use strict';

const crypto = require('crypto');

const TERMINAL_STATES = new Set(['DELIVERED', 'BLOCKED_OWNER', 'BLOCKED_EXTERNAL', 'KILLED', 'FAILED']);
const MAX_STEPS = 8;

function normalizeText(value, max = 4000) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((out, key) => {
      if (value[key] !== undefined) out[key] = canonicalize(value[key]);
      return out;
    }, {});
  }
  return value;
}

function sha256(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(canonicalize(value));
  return crypto.createHash('sha256').update(text).digest('hex');
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

function validateProfileSet(profileSet) {
  if (!profileSet || profileSet.schemaVersion !== '1.0' || !Array.isArray(profileSet.profiles)) throw new Error('INVALID_PROFILE_SET');
  const seen = new Set();
  for (const profile of profileSet.profiles) {
    if (!profile?.teamId || seen.has(profile.teamId)) throw new Error('INVALID_PROFILE_TEAM_ID');
    seen.add(profile.teamId);
    if (!profile.profileVersion || !profile.sourceFidelity || !profile.executionMode || !profile.mission) throw new Error('INCOMPLETE_TEAM_PROFILE');
    for (const field of ['roles', 'stages', 'evidenceRequirements', 'gates', 'forbidden', 'outputContract']) {
      if (!Array.isArray(profile[field]) || profile[field].length === 0) throw new Error(`INCOMPLETE_TEAM_PROFILE_${field.toUpperCase()}`);
    }
    if (!profile.terminalCriteria) throw new Error('INCOMPLETE_TEAM_PROFILE_TERMINAL');
  }
  return true;
}

function getTeamProfile(profileSet, teamId) {
  validateProfileSet(profileSet);
  const profile = profileSet.profiles.find((item) => item.teamId === teamId);
  if (!profile) throw new Error('TEAM_PROFILE_NOT_FOUND');
  return profile;
}

function profileIdentity(profileSet, profile) {
  return {
    profileSetVersion: profileSet.profileSetVersion,
    teamId: profile.teamId,
    profileVersion: profile.profileVersion,
    sourceFidelity: profile.sourceFidelity,
    executionMode: profile.executionMode,
    profileSha256: sha256(profile)
  };
}

function lines(label, values) {
  return [`${label}:`, ...values.map((value, index) => `${index + 1}. ${value}`)];
}

function buildWorkerPrompt(command, profileSet, profileOverride = null) {
  if (!command || command.commandType !== 'team_assignment_v1') throw new Error('INVALID_COMMAND');
  const profile = profileOverride || getTeamProfile(profileSet, command.team.id);
  if (profile.teamId !== command.team.id) throw new Error('TEAM_PROFILE_MISMATCH');
  const identity = profileIdentity(profileSet, profile);
  return [
    'You are the governed execution worker for an internal digital workforce.',
    `Selected team: ${command.team.name} (${command.team.run}; ${command.team.kind}).`,
    `Assignment: ${command.instruction}`,
    '',
    'TEAM EXECUTION PROFILE — authoritative execution context for this assignment:',
    `Profile set: ${identity.profileSetVersion}; profile version: ${identity.profileVersion}; fidelity: ${identity.sourceFidelity}; mode: ${identity.executionMode}.`,
    `Mission: ${profile.mission}`,
    ...lines('Roles / internal functions', profile.roles),
    ...lines('Required workflow stages', profile.stages),
    ...lines('Required evidence', profile.evidenceRequirements),
    ...lines('Gates', profile.gates),
    ...lines('Forbidden claims/actions', profile.forbidden),
    `Terminal criteria: ${profile.terminalCriteria}`,
    ...lines('Output contract', profile.outputContract),
    '',
    'Profile-fidelity rule:',
    '- Treat the profile as a constraint, not decoration. Follow its lifecycle, stages, evidence, gates and output contract even if the assignment is ambiguous.',
    '- For canonical-summary profiles, do not invent missing specialist names or claim unavailable historical detail. Execute only the documented functions/stages.',
    '- If the selected run is frozen, paused, validation-only, or otherwise gate-limited, honor that state and block requests beyond it.',
    '- Your returned steps must reflect team-profile stages/functions actually used, not generic Analyze/Answer labels.',
    '',
    'Global hard rules:',
    '- You have no external tools, browsing, connectors, shell, deployment, messaging, purchasing, or production access in this worker version.',
    '- Do not claim you performed an action you could not perform.',
    '- If the assignment requires unavailable external data, credentials, tools, owner authority, or real-world action, return BLOCKED_EXTERNAL or BLOCKED_OWNER rather than inventing evidence.',
    '- If the assignment is fully answerable by reasoning from the provided instruction and within the team profile, complete it.',
    '- Keep the result concise and operational.',
    '',
    'Return ONLY valid JSON with this exact shape:',
    '{"terminalState":"DELIVERED|BLOCKED_OWNER|BLOCKED_EXTERNAL|KILLED|FAILED","summary":"short result","detail":"useful deliverable or blocker explanation","steps":[{"name":"profile stage/function","detail":"what was actually done"}]}'
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

function buildReceipt(command, modelResult, response, model, profileSet, profileOverride = null) {
  const modelCostCentsEstimated = estimateModelCostCents(response?.usage);
  if (modelCostCentsEstimated !== null && modelCostCentsEstimated > Number(command.modelBudgetCents || 0)) throw new Error('MODEL_BUDGET_EXCEEDED');
  const profile = profileOverride || getTeamProfile(profileSet, command.team.id);
  if (profile.teamId !== command.team.id) throw new Error('TEAM_PROFILE_MISMATCH');
  const identity = profileIdentity(profileSet, profile);
  const profileStage = { name: 'Team execution profile', detail: `${identity.teamId} ${identity.profileVersion} / ${identity.sourceFidelity} / ${identity.executionMode}; ${identity.profileSha256.slice(0, 12)}…` };
  return {
    schemaVersion: '1.1',
    commandId: command.commandId,
    terminalState: modelResult.terminalState,
    summary: modelResult.summary,
    detail: modelResult.detail,
    steps: [profileStage, ...modelResult.steps].slice(0, MAX_STEPS),
    completedAt: new Date().toISOString(),
    externalActionsPerformed: 0,
    spendCents: 0,
    productionMutation: false,
    teamExecutionProfile: identity,
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
  canonicalize,
  sha256,
  decodeBase64Url,
  decryptApiKey,
  validateProfileSet,
  getTeamProfile,
  profileIdentity,
  buildWorkerPrompt,
  extractResponseText,
  parseModelResult,
  estimateModelCostCents,
  buildReceipt
};
