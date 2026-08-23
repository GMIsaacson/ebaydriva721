'use strict';

function normalizeActualTarget(input) {
  const actualTarget = input && input.actualTarget;
  const aliases = input && input.aliases;
  if (actualTarget === 'preview' || actualTarget === 'production') return actualTarget;
  if (actualTarget == null && Array.isArray(aliases) && aliases.length === 0) return 'preview';
  return actualTarget == null ? null : actualTarget;
}

function verifyVercelPreviewTarget(input) {
  const requestedTarget = input && input.requestedTarget;
  const actualTarget = input && input.actualTarget;
  const aliases = input && input.aliases;
  const normalizedActualTarget = normalizeActualTarget(input);
  const readyState = input && input.readyState;
  const projectId = (input && input.projectId) || null;
  const expectedProjectId = (input && input.expectedProjectId) || null;
  const failures = [];

  if (requestedTarget !== 'preview') failures.push('REQUESTED_TARGET_NOT_PREVIEW');
  if (normalizedActualTarget !== 'preview') failures.push('ACTUAL_TARGET_NOT_PREVIEW');
  if (readyState !== 'READY') failures.push('DEPLOYMENT_NOT_READY');
  if (expectedProjectId && projectId !== expectedProjectId) failures.push('PROJECT_SCOPE_MISMATCH');

  return {
    schemaVersion: '1.1',
    verifier: 'run014-vercel-preview-target-guard',
    requestedTarget: requestedTarget || null,
    actualTarget: actualTarget == null ? null : actualTarget,
    normalizedActualTarget,
    aliases: Array.isArray(aliases) ? aliases : null,
    readyState: readyState || null,
    projectId,
    expectedProjectId,
    deploymentId: (input && input.deploymentId) || null,
    targetEvidence: actualTarget == null && Array.isArray(aliases) && aliases.length === 0 ? 'VERCEL_NULL_TARGET_NO_ALIASES' : 'EXPLICIT_TARGET',
    decision: failures.length === 0 ? 'PASS' : 'FAIL',
    failures,
    promotionAllowed: failures.length === 0
  };
}

if (require.main === module) {
  const payload = process.argv[2] ? JSON.parse(process.argv[2]) : {};
  const receipt = verifyVercelPreviewTarget(payload);
  process.stdout.write(JSON.stringify(receipt, null, 2) + '\n');
  process.exitCode = receipt.decision === 'PASS' ? 0 : 1;
}

module.exports = { normalizeActualTarget, verifyVercelPreviewTarget };
