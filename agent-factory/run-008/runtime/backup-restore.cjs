'use strict';

const crypto = require('node:crypto');

const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const SHA256 = /^[a-f0-9]{64}$/i;
const DATA_CLASSES = new Set(['PUBLIC', 'INTERNAL', 'SENSITIVE', 'SECRET']);
const REQUIRED_INTEGRITY_CHECKS = new Set([
  'SCHEMA_PRESENT',
  'ROW_OR_OBJECT_COUNTS_RECONCILED',
  'CRITICAL_READ_MODEL_QUERY_PASSED',
  'APPLICATION_STATE_PRESENT'
]);

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function validateBackupArtifact(artifact) {
  const errors = [];
  if (!isObject(artifact)) return { valid: false, errors: ['INVALID_BACKUP_ARTIFACT'] };

  for (const field of ['backupId', 'createdAt', 'sourceSystem', 'sourceVersion', 'sha256', 'dataClass', 'retentionUntil', 'operator']) {
    if (typeof artifact[field] !== 'string' || !artifact[field].trim()) errors.push(`MISSING_OR_INVALID_${field.toUpperCase()}`);
  }
  if (!ISO_DATE_TIME.test(artifact.createdAt || '')) errors.push('INVALID_CREATED_AT');
  if (!ISO_DATE_TIME.test(artifact.retentionUntil || '')) errors.push('INVALID_RETENTION_UNTIL');
  if (ISO_DATE_TIME.test(artifact.createdAt || '') && ISO_DATE_TIME.test(artifact.retentionUntil || '') && Date.parse(artifact.retentionUntil) <= Date.parse(artifact.createdAt)) errors.push('RETENTION_MUST_END_AFTER_CREATION');
  if (!SHA256.test(artifact.sha256 || '')) errors.push('INVALID_SHA256');
  if (!Number.isInteger(artifact.sizeBytes) || artifact.sizeBytes <= 0) errors.push('INVALID_SIZE_BYTES');
  if (!DATA_CLASSES.has(artifact.dataClass)) errors.push('INVALID_DATA_CLASS');
  if (typeof artifact.encryptionAtRest !== 'boolean') errors.push('INVALID_ENCRYPTION_AT_REST');
  if (artifact.dataClass === 'SECRET') errors.push('RAW_SECRET_BACKUP_PROHIBITED');
  if (['INTERNAL', 'SENSITIVE'].includes(artifact.dataClass) && artifact.encryptionAtRest !== true) errors.push('ENCRYPTION_REQUIRED');
  if (artifact.containsRawSecrets === true) errors.push('RAW_SECRET_CONTENT_PROHIBITED');

  return { valid: errors.length === 0, errors };
}

function validateRestoreDrillEvidence(evidence) {
  const errors = [];
  if (!isObject(evidence)) return { valid: false, errors: ['INVALID_RESTORE_EVIDENCE'] };

  for (const field of ['drillId', 'backupId', 'backupSha256', 'sourceId', 'restoreTargetId', 'startedAt', 'completedAt', 'operator', 'evidenceRef']) {
    if (typeof evidence[field] !== 'string' || !evidence[field].trim()) errors.push(`MISSING_OR_INVALID_${field.toUpperCase()}`);
  }
  if (!SHA256.test(evidence.backupSha256 || '')) errors.push('INVALID_BACKUP_SHA256');
  if (!ISO_DATE_TIME.test(evidence.startedAt || '')) errors.push('INVALID_STARTED_AT');
  if (!ISO_DATE_TIME.test(evidence.completedAt || '')) errors.push('INVALID_COMPLETED_AT');
  if (ISO_DATE_TIME.test(evidence.startedAt || '') && ISO_DATE_TIME.test(evidence.completedAt || '') && Date.parse(evidence.completedAt) < Date.parse(evidence.startedAt)) errors.push('COMPLETED_BEFORE_STARTED');

  if (evidence.restoreTargetDisposable !== true) errors.push('RESTORE_TARGET_MUST_BE_DISPOSABLE');
  if (evidence.sourceId && evidence.restoreTargetId && evidence.sourceId === evidence.restoreTargetId) errors.push('RESTORE_TARGET_MUST_DIFFER_FROM_SOURCE');
  if (evidence.restoreSucceeded !== true) errors.push('RESTORE_DID_NOT_SUCCEED');
  if (evidence.secretExposureDetected !== false) errors.push('SECRET_EXPOSURE_NOT_PROVEN_FALSE');
  if (evidence.externalActionsPerformed !== 0) errors.push('EXTERNAL_ACTIONS_MUST_EQUAL_ZERO');

  if (!Array.isArray(evidence.integrityChecks)) {
    errors.push('INTEGRITY_CHECKS_REQUIRED');
  } else {
    const passed = new Set(evidence.integrityChecks.filter((item) => isObject(item) && item.passed === true).map((item) => item.name));
    for (const check of REQUIRED_INTEGRITY_CHECKS) {
      if (!passed.has(check)) errors.push(`MISSING_OR_FAILED_INTEGRITY_CHECK:${check}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

function validateBackupMatchesRestore(artifact, evidence) {
  const errors = [];
  const backup = validateBackupArtifact(artifact);
  const restore = validateRestoreDrillEvidence(evidence);
  if (!backup.valid) errors.push(...backup.errors.map((error) => `BACKUP:${error}`));
  if (!restore.valid) errors.push(...restore.errors.map((error) => `RESTORE:${error}`));
  if (artifact?.backupId && evidence?.backupId && artifact.backupId !== evidence.backupId) errors.push('BACKUP_ID_MISMATCH');
  if (artifact?.sha256 && evidence?.backupSha256 && artifact.sha256.toLowerCase() !== evidence.backupSha256.toLowerCase()) errors.push('BACKUP_SHA256_MISMATCH');
  return { valid: errors.length === 0, errors };
}

module.exports = {
  DATA_CLASSES,
  REQUIRED_INTEGRITY_CHECKS,
  sha256,
  validateBackupArtifact,
  validateRestoreDrillEvidence,
  validateBackupMatchesRestore
};
