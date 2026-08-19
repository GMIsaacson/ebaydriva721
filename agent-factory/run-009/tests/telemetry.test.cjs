'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const handler = require('../api/telemetry.js');
const { validateTelemetry } = handler;

test('accepts only whitelisted telemetry shapes', () => {
  assert.deepEqual(validateTelemetry({ event: 'PAGE_VIEW', path: '/' }), {
    ok: true,
    value: { event: 'PAGE_VIEW', path: '/' }
  });

  assert.deepEqual(validateTelemetry({
    event: 'PROJECT_DETAIL_OPEN',
    path: '/',
    objectId: 'run009-2116-nicollet-minneapolis'
  }), {
    ok: true,
    value: {
      event: 'PROJECT_DETAIL_OPEN',
      path: '/',
      objectId: 'run009-2116-nicollet-minneapolis'
    }
  });
});

test('rejects sensitive and unexpected fields', () => {
  assert.equal(validateTelemetry({ event: 'ALERT_INTEREST', path: '/', email: 'test@example.com' }).code, 'unexpected_field');
  assert.equal(validateTelemetry({ event: 'ALERT_INTEREST', path: '/', formValue: 'secret' }).code, 'unexpected_field');
  assert.equal(validateTelemetry({ event: 'ALERT_INTEREST', path: '/', ip: '127.0.0.1' }).code, 'unexpected_field');
  assert.equal(validateTelemetry({ event: 'ALERT_INTEREST', path: '/', userAgent: 'x' }).code, 'unexpected_field');
});

test('rejects unknown events and unsafe paths', () => {
  assert.equal(validateTelemetry({ event: 'PURCHASE', path: '/' }).code, 'event_not_allowed');
  assert.equal(validateTelemetry({ event: 'PAGE_VIEW', path: '/admin' }).code, 'path_not_allowed');
  assert.equal(validateTelemetry({ event: 'PAGE_VIEW', path: 'https://example.com/' }).code, 'path_not_allowed');
});

test('project detail requires bounded project identity', () => {
  assert.equal(validateTelemetry({ event: 'PROJECT_DETAIL_OPEN', path: '/' }).code, 'project_identity_required');
  assert.equal(validateTelemetry({ event: 'PROJECT_DETAIL_OPEN', path: '/', objectId: '../secret' }).code, 'object_not_allowed');
  assert.equal(validateTelemetry({ event: 'PAGE_VIEW', path: '/', objectId: 'run009-project' }).code, 'object_not_allowed_for_event');
});
