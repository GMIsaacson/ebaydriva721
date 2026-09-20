'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const ROOT = path.resolve(__dirname, '..');
const workflow = JSON.parse(fs.readFileSync(path.join(ROOT,'n8n/run-004-g6-acquisition-state-dispatcher.workflow.json'),'utf8'));
const registry = JSON.parse(fs.readFileSync(path.join(ROOT,'contracts/registry.json'),'utf8'));
const approval = JSON.parse(fs.readFileSync(path.join(ROOT,'g6/acquisition-state-dispatcher-authorization.json'),'utf8'));
const sql = fs.readFileSync(path.join(ROOT,'postgres/acquisition-state-dispatcher.sql'),'utf8');

test('canonical dispatcher artifact remains inactive until live acceptance', () => {
  assert.equal(workflow.active, false);
  assert.equal(workflow.id, 'SOURCEMARGINACQDISPATCHG6');
});

test('G6 owner approval is bounded to internal monitor authority', () => {
  assert.equal(approval.promotion, 'CONTROLLED_LIVE_INTERNAL_MONITOR');
  assert.equal(approval.authorityLevel, 'Recommend');
  assert.equal(approval.controls.maxChangedRoutesPerExecution, 3);
  assert.equal(approval.controls.externalActionsEnabled, false);
  assert.equal(approval.controls.spendingAuthorityCents, 0);
  assert.equal(approval.controls.workControlDispatchAllowed, false);
  assert.equal(approval.controls.routeMutationAllowed, false);
});

test('workflow has manual plus five-minute schedule and no webhook', () => {
  const schedule = workflow.nodes.find(n => n.name === 'Every 5 Minutes');
  assert.ok(schedule);
  assert.equal(schedule.parameters.rule.interval[0].expression, '*/5 * * * *');
  assert.ok(workflow.nodes.some(n => n.type === 'n8n-nodes-base.manualTrigger'));
  assert.ok(!workflow.nodes.some(n => /webhook/i.test(n.type)));
});

test('only approved SourceMargin RPC is read over HTTP', () => {
  const http = workflow.nodes.filter(n => n.type === 'n8n-nodes-base.httpRequest');
  assert.equal(http.length, 1);
  assert.equal(http[0].parameters.method, 'POST');
  assert.equal(http[0].parameters.url, 'https://aittnuqrrenkencygfje.supabase.co/rest/v1/rpc/control_console_dashboard');
  assert.equal(Boolean(http[0].credentials), false);
  const headers = http[0].parameters.headerParameters.parameters;
  const key = headers.find(h => h.name === 'apikey')?.value || '';
  assert.match(key, /^sb_publishable_/);
  assert.doesNotMatch(key, /service[_-]?role/i);
});

test('all database writes reuse existing private Postgres credential', () => {
  const pg = workflow.nodes.filter(n => n.type === 'n8n-nodes-base.postgres');
  assert.ok(pg.length >= 3);
  for (const node of pg) {
    assert.equal(node.credentials?.postgres?.id, 'RUN006POSTGRES');
  }
});

test('workflow source explicitly denies execution and external authority', () => {
  const source = JSON.stringify(workflow);
  assert.match(source, /workControlDispatchAllowed/);
  assert.match(source, /routeMutationAllowed/);
  assert.match(source, /externalActionsEnabled/);
  assert.match(source, /spendingAuthorityCents/);
  assert.match(source, /workControlCommandsCreated/);
  assert.doesNotMatch(source, /gmail|slack|ebay.*node|purchase.*node|stripe/i);
});

test('postgres dispatcher is bounded, idempotent, and recommendation-only', () => {
  assert.match(sql, /limit 3/i);
  assert.match(sql, /unique\(route_id, state_fingerprint\)/i);
  assert.match(sql, /external_actions_enabled boolean not null default false/i);
  assert.match(sql, /work_control_dispatch_allowed boolean not null default false/i);
  assert.match(sql, /route_mutation_allowed boolean not null default false/i);
  assert.match(sql, /BASELINE_SYNC/);
  assert.match(sql, /NO_CHANGE/);
  assert.match(sql, /STATE_CHANGED/);
});

test('registry declares bounded dispatcher and preserves Work Control boundary', () => {
  const unit = registry.units.find(u => u.unit_id === 'WF-SM-ACQ-DISPATCH-G6-001');
  assert.ok(unit);
  assert.equal(unit.authority_level, 'Recommend');
  assert.ok(unit.prohibited_actions.includes('create Work Control commands'));
  assert.ok(unit.prohibited_actions.includes('contact suppliers'));
  assert.ok(unit.prohibited_actions.includes('purchase or bid'));
  assert.ok(unit.prohibited_actions.includes('mutate acquisition route state'));
});
