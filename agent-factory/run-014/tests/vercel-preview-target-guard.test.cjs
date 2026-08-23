'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { verifyVercelPreviewTarget } = require('../runtime/vercel-preview-target-guard.cjs');

test('explicit preview is promotable', () => {
  const r = verifyVercelPreviewTarget({ requestedTarget: 'preview', actualTarget: 'preview', aliases: [], readyState: 'READY', projectId: 'prj_test', expectedProjectId: 'prj_test', deploymentId: 'dpl_test' });
  assert.equal(r.decision, 'PASS');
  assert.equal(r.normalizedActualTarget, 'preview');
  assert.equal(r.promotionAllowed, true);
  assert.deepEqual(r.failures, []);
});

test('Vercel null target with explicit empty aliases normalizes to preview', () => {
  const r = verifyVercelPreviewTarget({ requestedTarget: 'preview', actualTarget: null, aliases: [], readyState: 'READY', projectId: 'prj_test', expectedProjectId: 'prj_test' });
  assert.equal(r.decision, 'PASS');
  assert.equal(r.normalizedActualTarget, 'preview');
  assert.equal(r.targetEvidence, 'VERCEL_NULL_TARGET_NO_ALIASES');
});

test('ambiguous null target without alias evidence fails closed', () => {
  const r = verifyVercelPreviewTarget({ requestedTarget: 'preview', actualTarget: null, readyState: 'READY' });
  assert.equal(r.decision, 'FAIL');
  assert.ok(r.failures.includes('ACTUAL_TARGET_NOT_PREVIEW'));
});

test('production response fails closed even when requested preview', () => {
  const r = verifyVercelPreviewTarget({ requestedTarget: 'preview', actualTarget: 'production', aliases: ['stable.vercel.app'], readyState: 'READY' });
  assert.equal(r.decision, 'FAIL');
  assert.equal(r.promotionAllowed, false);
  assert.ok(r.failures.includes('ACTUAL_TARGET_NOT_PREVIEW'));
});

test('production request is rejected', () => {
  const r = verifyVercelPreviewTarget({ requestedTarget: 'production', actualTarget: 'production', readyState: 'READY' });
  assert.equal(r.decision, 'FAIL');
  assert.ok(r.failures.includes('REQUESTED_TARGET_NOT_PREVIEW'));
});

test('non-ready deployment fails closed', () => {
  const r = verifyVercelPreviewTarget({ requestedTarget: 'preview', actualTarget: null, aliases: [], readyState: 'BUILDING' });
  assert.equal(r.decision, 'FAIL');
  assert.ok(r.failures.includes('DEPLOYMENT_NOT_READY'));
});

test('project scope mismatch fails closed', () => {
  const r = verifyVercelPreviewTarget({ requestedTarget: 'preview', actualTarget: null, aliases: [], readyState: 'READY', projectId: 'prj_wrong', expectedProjectId: 'prj_expected' });
  assert.equal(r.decision, 'FAIL');
  assert.ok(r.failures.includes('PROJECT_SCOPE_MISMATCH'));
});

test('regression: G5-VERCEL-PREVIEW-001 is explicitly rejected', () => {
  const r = verifyVercelPreviewTarget({ requestedTarget: 'preview', actualTarget: 'production', aliases: ['run014-evidence-readiness-console.vercel.app'], readyState: 'READY', projectId: 'prj_Y47Cdk5VDOzTaSJqOoYABAePzbT9', expectedProjectId: 'prj_Y47Cdk5VDOzTaSJqOoYABAePzbT9', deploymentId: 'dpl_BmozPBKih1MDQgYi6HY4JRtBLGHx' });
  assert.equal(r.decision, 'FAIL');
  assert.equal(r.promotionAllowed, false);
});

test('current G5 preview retry is accepted only with exact evidence shape', () => {
  const r = verifyVercelPreviewTarget({ requestedTarget: 'preview', actualTarget: null, aliases: [], readyState: 'READY', projectId: 'prj_Y47Cdk5VDOzTaSJqOoYABAePzbT9', expectedProjectId: 'prj_Y47Cdk5VDOzTaSJqOoYABAePzbT9', deploymentId: 'dpl_6MqXnH1fpuT6EV1qDHd6J9ix9Top' });
  assert.equal(r.decision, 'PASS');
  assert.equal(r.normalizedActualTarget, 'preview');
});
