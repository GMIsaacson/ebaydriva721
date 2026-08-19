'use strict';

const ALLOWED_EVENTS = new Set([
  'PAGE_VIEW',
  'PROJECT_DETAIL_OPEN',
  'ALERT_INTEREST',
  'PREMIUM_INTEREST'
]);

const ALLOWED_KEYS = new Set(['event', 'path', 'objectId']);
const ALLOWED_PATH = /^\/(?:$|projects\/[a-z0-9-]+\/?$|municipalities\/[a-z0-9-]+\/?$|types\/[a-z0-9-]+\/?$|stages\/[a-z0-9-]+\/?$)/;
const ALLOWED_OBJECT = /^[a-z0-9][a-z0-9-]{0,99}$/;

function validateTelemetry(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, code: 'invalid_body' };
  }

  const keys = Object.keys(body);
  if (keys.some((key) => !ALLOWED_KEYS.has(key))) {
    return { ok: false, code: 'unexpected_field' };
  }

  if (!ALLOWED_EVENTS.has(body.event)) {
    return { ok: false, code: 'event_not_allowed' };
  }

  if (typeof body.path !== 'string' || body.path.length > 180 || !ALLOWED_PATH.test(body.path)) {
    return { ok: false, code: 'path_not_allowed' };
  }

  if (body.objectId != null && (typeof body.objectId !== 'string' || !ALLOWED_OBJECT.test(body.objectId))) {
    return { ok: false, code: 'object_not_allowed' };
  }

  if (body.event === 'PROJECT_DETAIL_OPEN' && !body.objectId && !body.path.startsWith('/projects/')) {
    return { ok: false, code: 'project_identity_required' };
  }

  if (body.event !== 'PROJECT_DETAIL_OPEN' && body.objectId != null) {
    return { ok: false, code: 'object_not_allowed_for_event' };
  }

  return {
    ok: true,
    value: {
      event: body.event,
      path: body.path,
      ...(body.objectId ? { objectId: body.objectId } : {})
    }
  };
}

function telemetryHandler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, code: 'method_not_allowed' });
  }

  const contentLength = Number(req.headers['content-length'] || 0);
  if (contentLength > 1024) {
    return res.status(413).json({ ok: false, code: 'payload_too_large' });
  }

  const parsed = validateTelemetry(req.body);
  if (!parsed.ok) {
    return res.status(400).json({ ok: false, code: parsed.code });
  }

  const record = {
    type: 'RUN009_TELEMETRY',
    at: new Date().toISOString(),
    ...parsed.value
  };

  console.log(JSON.stringify(record));
  return res.status(202).json({ ok: true });
}

module.exports = telemetryHandler;
module.exports.validateTelemetry = validateTelemetry;
