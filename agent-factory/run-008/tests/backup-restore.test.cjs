'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  sha256,
  validateBackupArtifact,
  validateRestoreDrillEvidence,
  validateBackupMatchesRestore
} = require('../runtime/backup-restore.cjs');

const digest = sha256('synthetic-backup-bytes');

function backup(overrides = {}) {
  return {
    backupId: 'backup:run008:001',
    createdAt: '2026-08-18T16:00:00Z',
    sourceSystem: 'postgres:n8n-nonproduction',
    sourceVersion: '16',
    sha256: digest,
    sizeBytes: 1024,
    dataClass: 'INTERNAL',
    encryptionAtRest: true,
    retentionUntil: '2026-09-17T16:00:00Z',
    operator: 'n8nadmin',
    containsRawSecrets: false,
    ...overrides
  };
}

function restore(overrides = {}) {
  return {
    drillId: 'restore-drill:001',
    backupId: 'backup:run008:001',
    backupSha256: digest,
    sourceId: 'postgres:n8n-nonproduction',
    restoreTargetId: 'postgres:restore-drill-disposable-001',
    restoreTargetDisposable: true,
    startedAt: '2026-08-18T16:05:00Z',
    completedAt: '2026-08-18T16:10:00Z',
    restoreSucceeded: true,
    integrityChecks: [
      { name: 'SCHEMA_PRESENT', passed: true },
      { name: 'ROW_OR_OBJECT_COUNTS_RECONCILED', passed: true },
      { name: 'CRITICAL_READ_MODEL_QUERY_PASSED', passed: true },
      { name: 'APPLICATION_STATE_PRESENT', passed: true }
    ],
    secretExposureDetected: false,
    externalActionsPerformed: 0,
    operator: 'n8nadmin',
    evidenceRef: 'evidence:restore-drill:001',
    ...overrides
  };
}

test('valid encrypted internal backup artifact passes', () => {
  assert.deepEqual(validateBackupArtifact(backup()), { valid: true, errors: [] });
});

test('raw secret backup is prohibited', () => {
  const result = validateBackupArtifact(backup({ dataClass: 'SECRET' }));
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes('RAW_SECRET_BACKUP_PROHIBITED'));
});

test('internal backup must be encrypted at rest', () => {
  const result = validateBackupArtifact(backup({ encryptionAtRest: false }));
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes('ENCRYPTION_REQUIRED'));
});

test('restore drill cannot target source database', () => {
  const result = validateRestoreDrillEvidence(restore({ restoreTargetId: 'postgres:n8n-nonproduction' }));
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes('RESTORE_TARGET_MUST_DIFFER_FROM_SOURCE'));
});

test('restore drill must use disposable target', () => {
  const result = validateRestoreDrillEvidence(restore({ restoreTargetDisposable: false }));
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes('RESTORE_TARGET_MUST_BE_DISPOSABLE'));
});

test('restore drill fails if any external action occurred', () => {
  const result = validateRestoreDrillEvidence(restore({ externalActionsPerformed: 1 }));
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes('EXTERNAL_ACTIONS_MUST_EQUAL_ZERO'));
});

test('restore evidence requires all critical integrity checks', () => {
  const result = validateRestoreDrillEvidence(restore({ integrityChecks: [{ name: 'SCHEMA_PRESENT', passed: true }] }));
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.startsWith('MISSING_OR_FAILED_INTEGRITY_CHECK:')));
});

test('backup checksum and id must match restore evidence', () => {
  const result = validateBackupMatchesRestore(backup(), restore({ backupSha256: 'f'.repeat(64) }));
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes('BACKUP_SHA256_MISMATCH'));
});

test('complete synthetic backup and restore evidence passes', () => {
  assert.deepEqual(validateBackupMatchesRestore(backup(), restore()), { valid: true, errors: [] });
});
