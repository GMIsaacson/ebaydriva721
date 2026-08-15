const RUN_ID = 'DS-S2M-004';

const REGISTERED_PARTICIPANTS = Object.freeze([
  'AGT-PORTFOLIO-STEWARD-001',
  'AGT-RESEARCH-VALIDATION-001',
  'AGT-OFFER-ASSET-BUILDER-001',
  'OWNER-ABERDEEN',
]);

const DEFAULT_CONFIG = Object.freeze({
  runId: RUN_ID,
  contractVersion: 'datascout-run-004/1.0.0',
  mode: 'offline',
  externalActionsEnabled: false,
  spendingAuthorityCents: 0,
  maxCandidates: 25,
  maxSourceRequests: 200,
  maxRetries: 2,
  evidenceMaxAgeDays: 7,
  maxAiCalls: 0,
  credentialMode: 'none',
  firestoreEmulatorHost: null,
  participants: REGISTERED_PARTICIPANTS,
});

function readInteger(value, fallback, name) {
  if (value === undefined || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new Error(`${name} must be a safe integer`);
  return parsed;
}

function readLockedBoolean(value, fallback, name) {
  if (value === undefined || value === '') return fallback;
  if (value === 'false' || value === false) return false;
  if (value === 'true' || value === true) return true;
  throw new Error(`${name} must be true or false`);
}

function validateConfig(config) {
  const errors = [];
  if (config.runId !== RUN_ID) errors.push(`runId must remain ${RUN_ID}`);
  if (!['offline', 'firestore-emulator'].includes(config.mode)) {
    errors.push('mode must be offline or firestore-emulator');
  }
  if (config.externalActionsEnabled !== false) errors.push('external actions must remain disabled');
  if (config.spendingAuthorityCents !== 0) errors.push('spending authority must remain $0');
  if (config.maxCandidates < 1 || config.maxCandidates > 25) errors.push('maxCandidates must be 1..25');
  if (config.maxSourceRequests < 1 || config.maxSourceRequests > 200) {
    errors.push('maxSourceRequests must be 1..200');
  }
  if (config.maxRetries < 0 || config.maxRetries > 2) errors.push('maxRetries must be 0..2');
  if (config.evidenceMaxAgeDays !== 7) errors.push('evidenceMaxAgeDays must remain 7');
  if (config.maxAiCalls !== 0) errors.push('G4 acceptance permits zero AI calls');
  if (config.credentialMode !== 'none' && config.credentialMode !== 'emulator-only') {
    errors.push('credentialMode must be none or emulator-only');
  }
  if (config.mode === 'firestore-emulator' && !config.firestoreEmulatorHost) {
    errors.push('firestore-emulator mode requires FIRESTORE_EMULATOR_HOST');
  }
  if (config.mode === 'offline' && config.credentialMode !== 'none') {
    errors.push('offline mode may not load credentials');
  }
  if (errors.length) {
    const error = new Error(`Invalid Run 004 G4 configuration: ${errors.join('; ')}`);
    error.code = 'G4_CONFIG_INVALID';
    error.details = errors;
    throw error;
  }
  return Object.freeze({ ...config });
}

function loadConfig(env = process.env) {
  const mode = env.DATASCOUT_G4_MODE || DEFAULT_CONFIG.mode;
  const config = {
    ...DEFAULT_CONFIG,
    mode,
    externalActionsEnabled: readLockedBoolean(
      env.DATASCOUT_G4_EXTERNAL_ACTIONS_ENABLED,
      false,
      'DATASCOUT_G4_EXTERNAL_ACTIONS_ENABLED',
    ),
    spendingAuthorityCents: readInteger(
      env.DATASCOUT_G4_SPENDING_AUTHORITY_CENTS,
      0,
      'DATASCOUT_G4_SPENDING_AUTHORITY_CENTS',
    ),
    maxCandidates: readInteger(env.DATASCOUT_G4_MAX_CANDIDATES, 25, 'DATASCOUT_G4_MAX_CANDIDATES'),
    maxSourceRequests: readInteger(
      env.DATASCOUT_G4_MAX_SOURCE_REQUESTS,
      200,
      'DATASCOUT_G4_MAX_SOURCE_REQUESTS',
    ),
    maxRetries: readInteger(env.DATASCOUT_G4_MAX_RETRIES, 2, 'DATASCOUT_G4_MAX_RETRIES'),
    maxAiCalls: readInteger(env.DATASCOUT_G4_MAX_AI_CALLS, 0, 'DATASCOUT_G4_MAX_AI_CALLS'),
    credentialMode: env.DATASCOUT_G4_CREDENTIAL_MODE || (mode === 'offline' ? 'none' : 'emulator-only'),
    firestoreEmulatorHost: env.FIRESTORE_EMULATOR_HOST || null,
  };
  return validateConfig(config);
}

module.exports = {
  DEFAULT_CONFIG,
  REGISTERED_PARTICIPANTS,
  RUN_ID,
  loadConfig,
  validateConfig,
};
