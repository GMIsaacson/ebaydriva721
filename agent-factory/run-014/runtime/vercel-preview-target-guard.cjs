'use strict';

function verifyVercelPreviewTarget(input) {
  const requestedTarget = input && input.requestedTarget;
  const actualTarget = input && input.actualTarget;
  const readyState = input && input.readyState;
  const failures = [];

  if (requestedTarget !== 'preview') failures.push('REQUESTED_TARGET_NOT_PREVIEW');
  if (actualTarget !== 'preview') failures.push('ACTUAL_TARGET_NOT_PREVIEW');
  if (readyState !== 'READY') failures.push('DEPLOYMENT_NOT_READY');

  return {
    schemaVersion: '1.0',
    verifier: 'run014-vercel-preview-target-guard',
    requestedTarget: requestedTarget || null,
    actualTarget: actualTarget || null,
    readyState: readyState || null,
    projectId: (input && input.projectId) || null,
    deploymentId: (input && input.deploymentId) || null,
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

module.exports = { verifyVercelPreviewTarget };
