'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const policy = JSON.parse(fs.readFileSync(path.join(root, 'connectors/g6-connector-policy.json'), 'utf8'));
const workflow = JSON.parse(fs.readFileSync(path.join(root, 'n8n/run-006-g6-gmail-read-stage.workflow.json'), 'utf8'));
const sql = fs.readFileSync(path.join(root, 'postgres/g6-connector-tables.sql'), 'utf8');

test('G6 connector prep remains manual-only and inactive', () => {
  assert.equal(policy.activation.manualOnly, true);
  assert.equal(policy.activation.scheduleEnabled, false);
  assert.equal(policy.activation.webhookEnabled, false);
  assert.equal(policy.activation.productionPublished, false);
  assert.equal(workflow.active, false);
  assert.equal(workflow.meta.scheduleEnabled, false);
  assert.equal(workflow.meta.webhookEnabled, false);
  assert.equal(workflow.nodes.filter((n) => n.type === 'n8n-nodes-base.manualTrigger').length, 1);
  assert.equal(workflow.nodes.some((n) => /cron|schedule|webhook/i.test(n.type)), false);
});

test('Gmail node is read-only and bounded', () => {
  const gmail = workflow.nodes.find((n) => n.type === 'n8n-nodes-base.gmail');
  assert.ok(gmail);
  assert.equal(gmail.parameters.resource, 'message');
  assert.ok(policy.gmail.allowedOperations.includes(gmail.parameters.operation));
  assert.equal(gmail.parameters.returnAll, false);
  assert.ok(gmail.parameters.limit <= policy.gmail.maxMessagesPerRun);
  assert.equal(gmail.parameters.filters.includeSpamTrash, false);
  assert.equal(policy.gmail.forbiddenOperations.includes(gmail.parameters.operation), false);
  assert.equal(workflow.nodes.some((n) => n.type === 'n8n-nodes-base.gmailTrigger'), false);
});

test('workflow contains no Gmail mutation operation', () => {
  const gmailNodes = workflow.nodes.filter((n) => n.type === 'n8n-nodes-base.gmail');
  for (const node of gmailNodes) {
    assert.equal(policy.gmail.forbiddenOperations.includes(node.parameters.operation), false);
  }
});

test('sanitized staging explicitly prohibits raw body retention', () => {
  assert.match(sql, /raw_body_retained boolean NOT NULL DEFAULT false CHECK \(raw_body_retained = false\)/i);
  assert.doesNotMatch(sql, /\bbody\b\s+(text|json|jsonb|bytea)/i);
  const sanitize = workflow.nodes.find((n) => n.name === 'Sanitize To Minimal Evidence');
  assert.ok(sanitize);
  assert.match(sanitize.parameters.jsCode, /rawBodyRetained:false/);
});

test('Notion target and authority are fixed to the internal Subscription Register', () => {
  assert.equal(policy.notion.targetDatabase, 'Subscription Register');
  assert.equal(policy.notion.targetDataSourceId, 'e9378d94-d13b-428d-b875-cdec14efddfc');
  assert.equal(policy.notion.requiresValidatedEnvelope, true);
  assert.ok(policy.notion.maxWritesPerRun <= 25);
  assert.equal(policy.authority.externalVendorActions, 0);
  assert.equal(policy.authority.spendingAuthorityCents, 0);
  assert.equal(policy.authority.subscriptionChanges, false);
  assert.equal(policy.authority.paymentChanges, false);
  assert.equal(policy.authority.credentialChanges, false);
  assert.equal(policy.authority.vendorContact, false);
  assert.equal(policy.authority.cancellation, false);
  assert.equal(policy.authority.purchase, false);
});

test('outbox accepts only runtime-validated register mutations', () => {
  assert.match(sql, /validated_by text NOT NULL DEFAULT 'SUB-OPS-RUNTIME-006'/);
  assert.match(sql, /validation_hash text NOT NULL/);
  assert.match(sql, /state text NOT NULL DEFAULT 'READY'/);
  assert.match(sql, /action text NOT NULL CHECK \(action IN \('CREATE','UPDATE'\)\)/);
});

test('source-controlled workflow contains no credential binding', () => {
  for (const node of workflow.nodes) {
    assert.equal(Object.prototype.hasOwnProperty.call(node, 'credentials'), false);
  }
});
