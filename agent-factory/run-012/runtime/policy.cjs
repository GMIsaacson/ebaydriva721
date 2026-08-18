const crypto = require('node:crypto');

const ALLOWED_CHANNELS = new Set(['x','linkedin','upwork','contra','reddit','youtube']);
const EXTERNAL_ACTIONS = new Set([
  'publish_post','publish_comment','send_dm','send_email','submit_proposal',
  'submit_bid','publish_video','publish_reply','change_profile','spend_money'
]);

function assertScore(name, value) {
  if (!Number.isFinite(value) || value < 0 || value > 5) {
    throw new Error(`${name} must be a number from 0 to 5`);
  }
}

function scoreLead(dimensions) {
  const weights = {
    buyerFit: 25,
    painEvidence: 20,
    buyingIntent: 20,
    dealValue: 15,
    accessibility: 10,
    urgency: 10,
  };
  let total = 0;
  for (const [name, weight] of Object.entries(weights)) {
    const value = dimensions?.[name];
    assertScore(name, value);
    total += (value / 5) * weight;
  }
  return Math.round(total);
}

function routeLead(score) {
  if (!Number.isFinite(score) || score < 0 || score > 100) {
    throw new Error('lead score must be 0..100');
  }
  if (score >= 80) return 'HOT_REVIEW';
  if (score >= 60) return 'WARM_QUEUE';
  if (score >= 40) return 'NURTURE';
  return 'IGNORE';
}

function validateOpportunity(item) {
  if (!item || typeof item !== 'object') throw new Error('opportunity required');
  if (!item.id || !item.channel || !item.sourceUrl || !item.observedAt) {
    throw new Error('id, channel, sourceUrl and observedAt are required');
  }
  if (!ALLOWED_CHANNELS.has(String(item.channel).toLowerCase())) {
    throw new Error('channel not allowed');
  }
  if (!/^https?:\/\//.test(item.sourceUrl)) throw new Error('sourceUrl must be http(s)');
  return true;
}

function idempotencyKey(item) {
  validateOpportunity(item);
  return crypto
    .createHash('sha256')
    .update(`${item.channel}|${item.id}|${item.sourceUrl}`)
    .digest('hex');
}

function authorizeAction(action) {
  if (!action || typeof action !== 'object') throw new Error('action required');
  const type = action.type;
  if (!type) throw new Error('action.type required');

  if (type === 'crm_write_internal') {
    return { authorized: true, mode: 'INTERNAL_ONLY' };
  }

  if (EXTERNAL_ACTIONS.has(type)) {
    const permit = action.approvalPermit;
    const validPermit = Boolean(
      permit &&
      permit.status === 'APPROVED' &&
      permit.actionId === action.id &&
      permit.expiresAt &&
      Date.parse(permit.expiresAt) > Date.now()
    );
    return validPermit
      ? { authorized: true, mode: 'APPROVAL_GATED' }
      : { authorized: false, mode: 'BLOCKED_PENDING_OWNER_APPROVAL' };
  }

  return { authorized: false, mode: 'UNRECOGNIZED_ACTION' };
}

function buildActionQueue(opportunities) {
  const seen = new Set();
  const queue = [];
  for (const item of opportunities) {
    validateOpportunity(item);
    const key = idempotencyKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    const score = scoreLead(item.leadDimensions);
    queue.push({
      opportunityId: item.id,
      channel: item.channel,
      score,
      route: routeLead(score),
      recommendedAction: item.recommendedAction || 'draft_response',
      externalExecution: 'BLOCKED_PENDING_OWNER_APPROVAL',
      idempotencyKey: key,
    });
  }
  return queue.sort((a, b) => b.score - a.score);
}

module.exports = {
  ALLOWED_CHANNELS,
  EXTERNAL_ACTIONS,
  scoreLead,
  routeLead,
  validateOpportunity,
  idempotencyKey,
  authorizeAction,
  buildActionQueue,
};
