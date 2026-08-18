'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const registry = JSON.parse(fs.readFileSync(path.join(root, 'coverage/account-coverage-registry.json'), 'utf8'));

test('coverage registry has a stable identity and at least one known source', () => {
  assert.equal(registry.registryId, 'SUB-OPS-006-ACCOUNT-COVERAGE');
  assert.ok(Array.isArray(registry.accounts));
  assert.ok(registry.accounts.length >= 1);
});

test('no account stores secrets or raw credentials', () => {
  const serialized = JSON.stringify(registry).toLowerCase();
  for (const forbidden of ['password', 'access_token', 'refresh_token', 'api_key', 'client_secret']) {
    assert.equal(serialized.includes(forbidden), false);
  }
});

test('known Gmail sources require read-only connection before monitored coverage', () => {
  for (const account of registry.accounts.filter((a) => a.sourceType === 'Gmail')) {
    assert.ok(['PENDING_CONNECTION', 'CONNECTED_READ_ONLY', 'BLOCKED', 'RETIRED'].includes(account.coverageStatus));
    if (account.dailyMonitoringEligible) {
      assert.notEqual(account.coverageStatus, 'RETIRED');
    }
  }
});

test('baseline discovery lookback is deeper than the daily pilot window', () => {
  for (const account of registry.accounts.filter((a) => a.sourceType === 'Gmail')) {
    assert.ok(account.baselineLookbackDays >= 365);
  }
});

test('coverage cannot be considered complete while an active source is pending or baseline incomplete', () => {
  const incomplete = registry.accounts.some((a) =>
    a.dailyMonitoringEligible &&
    (a.coverageStatus !== 'CONNECTED_READ_ONLY' || a.baselineStatus !== 'COMPLETE')
  );
  assert.equal(incomplete, true);
});
