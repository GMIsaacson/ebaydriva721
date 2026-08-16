const test = require('node:test');
const assert = require('node:assert/strict');
const { makeDecisionKey, normalizeDecision, routeDecision, rankOpenDecisions } = require('../runtime/decision-notification.cjs');

test('decision key is deterministic', () => {
  const a = makeDecisionKey({producerId:'SUB-OPS-006',subjectId:'subscription:demo',decisionType:'renewal-review',naturalKey:'2026-09-01'});
  const b = makeDecisionKey({producerId:'SUB-OPS-006',subjectId:'subscription:demo',decisionType:'renewal-review',naturalKey:'2026-09-01'});
  assert.equal(a,b);
});

test('owner approval decision becomes brief notification', () => {
  const result = normalizeDecision({
    producerId:'SUB-OPS-006', subjectId:'subscription:demo', decisionType:'renewal-review',
    subject:'Renewal needs review', reason:'Renewal is within 7 days', recommendation:'Review usage before renewal',
    authorityRequired:'OWNER_APPROVAL', severity:'ATTENTION', naturalKey:'2026-09-01', createdAt:'2026-08-16T18:00:00.000Z'
  });
  assert.equal(result.valid,true);
  const route = routeDecision(result.decision,{now:'2026-08-16T19:00:00.000Z'});
  assert.equal(route.shouldNotify,true);
  assert.equal(route.channelClass,'BRIEF');
});

test('urgent decision routes immediate', () => {
  const {decision} = normalizeDecision({
    producerId:'SUB-OPS-006', subjectId:'subscription:demo', decisionType:'payment-failed',
    subject:'Payment failed', reason:'Vendor reported failed renewal charge',
    authorityRequired:'OWNER_APPROVAL', severity:'URGENT', naturalKey:'invoice-1', createdAt:'2026-08-16T18:00:00.000Z'
  });
  assert.equal(routeDecision(decision,{now:'2026-08-16T19:00:00.000Z'}).channelClass,'IMMEDIATE');
});

test('duplicate notification is suppressed during cooldown', () => {
  const {decision} = normalizeDecision({
    producerId:'SUB-OPS-006', subjectId:'subscription:demo', decisionType:'payment-failed',
    subject:'Payment failed', reason:'Vendor reported failed renewal charge',
    authorityRequired:'OWNER_APPROVAL', severity:'URGENT', naturalKey:'invoice-2', createdAt:'2026-08-16T18:00:00.000Z'
  });
  const first = routeDecision(decision,{now:'2026-08-16T19:00:00.000Z'});
  const second = routeDecision(decision,{now:'2026-08-16T20:00:00.000Z', priorNotifications:[{cooldownKey:first.cooldownKey,sentAt:'2026-08-16T19:00:00.000Z'}]});
  assert.equal(second.shouldNotify,false);
  assert.equal(second.reason,'COOLDOWN_SUPPRESSED');
});

test('info with no authority stays silent', () => {
  const {decision} = normalizeDecision({
    producerId:'OPS-CORE-008', subjectId:'watcher:demo', decisionType:'healthy-check',
    subject:'Watcher healthy', reason:'Heartbeat on time', authorityRequired:'NONE', severity:'INFO', naturalKey:'heartbeat-1'
  });
  const route = routeDecision(decision,{now:'2026-08-16T19:00:00.000Z'});
  assert.equal(route.shouldNotify,false);
  assert.equal(route.channelClass,'SILENT');
});

test('open inbox ranks urgent and overdue items first', () => {
  const items = [
    normalizeDecision({producerId:'A',subjectId:'1',decisionType:'x',subject:'Low',reason:'r',authorityRequired:'OWNER_APPROVAL',severity:'INFO',naturalKey:'1',deadlineAt:'2026-08-20T00:00:00.000Z'}).decision,
    normalizeDecision({producerId:'A',subjectId:'2',decisionType:'x',subject:'Urgent',reason:'r',authorityRequired:'OWNER_APPROVAL',severity:'URGENT',naturalKey:'2',deadlineAt:'2026-08-15T00:00:00.000Z'}).decision
  ];
  const ranked = rankOpenDecisions(items,'2026-08-16T19:00:00.000Z');
  assert.equal(ranked[0].subject,'Urgent');
  assert.equal(ranked[0].overdue,true);
});
