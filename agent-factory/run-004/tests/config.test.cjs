const test = require('node:test');
const assert = require('node:assert/strict');
const { DEFAULT_CONFIG, loadConfig, validateConfig } = require('../runtime/config.cjs');

test('loads a locked offline configuration without credentials', () => {
  const config = loadConfig({});
  assert.equal(config.mode, 'offline');
  assert.equal(config.externalActionsEnabled, false);
  assert.equal(config.spendingAuthorityCents, 0);
  assert.equal(config.credentialMode, 'none');
});

test('refuses to enable external actions', () => {
  assert.throws(() => loadConfig({ DATASCOUT_G4_EXTERNAL_ACTIONS_ENABLED: 'true' }), /external actions/);
});

test('refuses any spending authority', () => {
  assert.throws(() => loadConfig({ DATASCOUT_G4_SPENDING_AUTHORITY_CENTS: '1' }), /spending authority/);
});

test('refuses caps above the G2 contract', () => {
  assert.throws(() => loadConfig({ DATASCOUT_G4_MAX_CANDIDATES: '26' }), /maxCandidates/);
  assert.throws(() => loadConfig({ DATASCOUT_G4_MAX_SOURCE_REQUESTS: '201' }), /maxSourceRequests/);
  assert.throws(() => loadConfig({ DATASCOUT_G4_MAX_RETRIES: '3' }), /maxRetries/);
});

test('requires an emulator host for firestore-emulator mode', () => {
  assert.throws(
    () => loadConfig({ DATASCOUT_G4_MODE: 'firestore-emulator' }),
    /FIRESTORE_EMULATOR_HOST/,
  );
  const config = loadConfig({
    DATASCOUT_G4_MODE: 'firestore-emulator',
    FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
  });
  assert.equal(config.credentialMode, 'emulator-only');
});

test('refuses AI calls during G4 acceptance', () => {
  assert.throws(() => validateConfig({ ...DEFAULT_CONFIG, maxAiCalls: 1 }), /zero AI calls/);
});
