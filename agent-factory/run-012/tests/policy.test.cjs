const test = require('node:test');
const assert = require('node:assert/strict');
const {
  scoreLead, routeLead, authorizeAction, buildActionQueue, validateOpportunity,
} = require('../runtime/policy.cjs');

const base = {
  id: 'T-1', channel: 'x', sourceUrl: 'https://example.com/x/1',
  observedAt: '2026-08-18T09:00:00Z',
  leadDimensions: {buyerFit:5,painEvidence:5,buyingIntent:5,dealValue:5,accessibility:5,urgency:5}
};

test('scores a perfect lead at 100', () => {
  assert.equal(scoreLead(base.leadDimensions), 100);
  assert.equal(routeLead(100), 'HOT_REVIEW');
});

test('blocks external action without approval permit', () => {
  assert.deepEqual(authorizeAction({id:'A-1', type:'submit_proposal'}), {
    authorized:false, mode:'BLOCKED_PENDING_OWNER_APPROVAL'
  });
});

test('allows only a matching unexpired approval permit', () => {
  const permit = {status:'APPROVED', actionId:'A-1', expiresAt:'2099-01-01T00:00:00Z'};
  assert.equal(authorizeAction({id:'A-1', type:'submit_proposal', approvalPermit:permit}).authorized, true);
  assert.equal(authorizeAction({id:'A-2', type:'submit_proposal', approvalPermit:permit}).authorized, false);
});

test('allows internal CRM write without external authority', () => {
  assert.deepEqual(authorizeAction({id:'C-1', type:'crm_write_internal'}), {
    authorized:true, mode:'INTERNAL_ONLY'
  });
});

test('rejects unsupported channels', () => {
  assert.throws(() => validateOpportunity({...base, channel:'tiktok'}), /channel not allowed/);
});

test('deduplicates and sorts the queue', () => {
  const lower = {...base, id:'T-2', sourceUrl:'https://example.com/x/2', leadDimensions:{buyerFit:2,painEvidence:2,buyingIntent:2,dealValue:2,accessibility:2,urgency:2}};
  const queue = buildActionQueue([lower, base, base]);
  assert.equal(queue.length, 2);
  assert.equal(queue[0].opportunityId, 'T-1');
  assert.equal(queue[0].externalExecution, 'BLOCKED_PENDING_OWNER_APPROVAL');
});
