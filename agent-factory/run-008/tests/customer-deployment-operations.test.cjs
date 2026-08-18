'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  validateCustomerDeploymentProfile,
  evaluateActivationTransition,
  preflightCustomerAction
} = require('../runtime/customer-deployment-operations.cjs');

function profile(overrides = {}) {
  const base = {
    deploymentId: 'deploy:CUST-0047:hvac:v1',
    customerId: 'CUST-0047',
    tenantId: 'tenant:CUST-0047',
    releaseRef: 'release:HVAC-LEAD-TEAM:1.0.0',
    environment: 'PRODUCTION',
    activationState: 'CONNECTED_SHADOW',
    namespace: 'cust:CUST-0047:hvac-leads',
    integrations: [
      {
        integrationId: 'jobber-primary',
        system: 'JOBBER',
        credentialRef: 'oauth:customer:CUST-0047:jobber',
        allowedActions: ['READ_SCHEDULE', 'CREATE_WORK_ORDER']
      }
    ],
    rollbackRef: 'runbook:hvac:rollback-v1',
    killSwitchRef: 'switch:deploy:CUST-0047:hvac',
    authority: {
      externalActionsApproved: false,
      approvalRef: null,
      costCeilingCents: 0
    }
  };
  return { ...base, ...overrides };
}

function action(overrides = {}) {
  const base = {
    actionId: 'act-001',
    idempotencyKey: 'idem:act-001',
    customerId: 'CUST-0047',
    tenantId: 'tenant:CUST-0047',
    integrationId: 'jobber-primary',
    actionType: 'READ_SCHEDULE',
    external: false,
    estimatedCostCents: 0,
    authorityContext: {
      mode: 'INTERNAL_WRITE',
      externalActionAuthorized: false,
      approvalRef: null,
      costCeilingCents: 0
    }
  };
  return { ...base, ...overrides };
}

test('valid customer-scoped profile stores credential references only', () => {
  const result = validateCustomerDeploymentProfile(profile());
  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
});

test('raw credential material is rejected from durable deployment profile', () => {
  const candidate = profile({ apiKey: 'should-never-be-here' });
  const result = validateCustomerDeploymentProfile(candidate);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.startsWith('RAW_SECRET_PROHIBITED:')));
});

test('customer namespace and tenant id must be scoped to the same customer', () => {
  const candidate = profile({ tenantId: 'tenant:CUST-9999', namespace: 'cust:CUST-9999:hvac' });
  const result = validateCustomerDeploymentProfile(candidate);
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes('TENANT_ID_NOT_CUSTOMER_SCOPED'));
  assert.ok(result.errors.includes('NAMESPACE_NOT_CUSTOMER_SCOPED'));
});

test('shadow activation requires connection evidence but grants no external authority', () => {
  const draft = profile({ activationState: 'DRAFT' });
  const blocked = evaluateActivationTransition({ from: 'DRAFT', to: 'CONNECTED_SHADOW', profile: draft, evidence: {} });
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.reasons.includes('CONNECTION_CHECKS_REQUIRED'));

  const passed = evaluateActivationTransition({ from: 'DRAFT', to: 'CONNECTED_SHADOW', profile: draft, evidence: { connectionChecksPassed: true } });
  assert.equal(passed.allowed, true);
});

test('external customer action is blocked during shadow mode', () => {
  const result = preflightCustomerAction({
    profile: profile(),
    action: action({
      actionType: 'CREATE_WORK_ORDER',
      external: true,
      authorityContext: {
        mode: 'EXTERNAL_WRITE_GATED',
        externalActionAuthorized: true,
        approvalRef: 'approval:test-only',
        costCeilingCents: 0
      }
    })
  });
  assert.equal(result.allowed, false);
  assert.ok(result.reasons.includes('EXTERNAL_ACTION_BLOCKED_OUTSIDE_BOUNDED_LIVE'));
});

test('cross-tenant action fails closed even when action type is allowlisted', () => {
  const result = preflightCustomerAction({
    profile: profile(),
    action: action({ tenantId: 'tenant:CUST-9999' })
  });
  assert.equal(result.allowed, false);
  assert.ok(result.reasons.includes('TENANT_SCOPE_MISMATCH'));
});

test('unlisted integration action fails closed', () => {
  const result = preflightCustomerAction({
    profile: profile(),
    action: action({ actionType: 'DELETE_CUSTOMER' })
  });
  assert.equal(result.allowed, false);
  assert.ok(result.reasons.includes('ACTION_NOT_ALLOWLISTED'));
});

test('bounded live external action requires both deployment approval and action-level gated authority', () => {
  const live = profile({
    activationState: 'BOUNDED_LIVE',
    authority: {
      externalActionsApproved: true,
      approvalRef: 'approval:G6:CUST-0047:001',
      costCeilingCents: 5000
    }
  });
  const externalAction = action({
    actionType: 'CREATE_WORK_ORDER',
    external: true,
    estimatedCostCents: 250,
    authorityContext: {
      mode: 'EXTERNAL_WRITE_GATED',
      externalActionAuthorized: true,
      approvalRef: 'permit:single-use:test-001',
      costCeilingCents: 500
    }
  });
  const result = preflightCustomerAction({ profile: live, action: externalAction });
  assert.equal(result.allowed, true);
});

test('bounded live promotion fails closed without controlled-pilot evidence', () => {
  const gated = profile({
    activationState: 'APPROVAL_GATED',
    authority: {
      externalActionsApproved: true,
      approvalRef: 'approval:G6:CUST-0047:001',
      costCeilingCents: 5000
    }
  });
  const blocked = evaluateActivationTransition({
    from: 'APPROVAL_GATED',
    to: 'BOUNDED_LIVE',
    profile: gated,
    evidence: { approvalRef: 'approval:G6:CUST-0047:001' }
  });
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.reasons.includes('CONTROLLED_PILOT_APPROVAL_REQUIRED'));
});
