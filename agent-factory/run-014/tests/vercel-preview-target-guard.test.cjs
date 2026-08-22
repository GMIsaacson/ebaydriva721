'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { verifyVercelPreviewTarget } = require('../runtime/vercel-preview-target-guard.cjs');

test('verified preview is promotable', () => {
  const r = verifyVercelPreviewTarget({ requestedTarget: 'preview', actualTarget: 'preview', readyState: 'READY', projectId: 'prj_test', deploymentId: 'dpl_test' });
  assert.equal(r.decision, 'PASS');
  assert.equal(r.promotionAllowed, true);
  assert.deepEqual(r.failures, []);
});

test('production response fails closed even when requested preview', () => {
  const r = verifyVercelPreviewTarget({ requestedTarget: 'preview', actualTarget: 'production', readyState: 'READY' });
  assert.equal(r.decision, 'FAIL');
  assert.equal(r.promotionAllowed, false);
  assert.ok(r.failures.includes('ACTUAL_TARGET_NOT_PREVIEW'));
});

test('production request is rejected', () => {
  const r = verifyVercelPreviewTarget({ requestedTarget: 'production', actualTarget: 'production', readyState: 'READY' });
  assert.equal(r.decision, 'FAIL');
  assert.ok(r.failures.includes('REQUESTED_TARGET_NOT_PREVIEW'));
});

test('missing actual target fails closed', () => {
  const r = verifyVercelPreviewTarget({ requestedTarget: 'preview', readyState: 'READY' });
  assert.equal(r.decision, 'FAIL');
  assert.ok(r.failures.includes('ACTUAL_TARGET_NOT_PREVIEW'));
});

test('non-ready deployment fails closed', () => {
  const r = verifyVercelPreviewTarget({ requestedTarget: 'preview', actualTarget: 'preview', readyState: 'BUILDING' });
  assert.equal(r.decision, 'FAIL');
  assert.ok(r.failures.includes('DEPLOYMENT_NOT_READY'));
});

test('regression: G5-VERCEL-PREVIEW-001 is explicitly rejected', () => {
  const r = verifyVercelPreviewTarget({ requestedTarget: 'preview', actualTarget: 'production', readyState: 'READY', projectId: 'prj_Y47Cdk5VDOzTaSJqOoYABAePzbT9', deploymentId: 'dpl_BmozPBKih1MDQgYi6HY4JRtBLGHx' });
  assert.equal(r.decision, 'FAIL');
  assert.equal(r.promotionAllowed, false);
});
