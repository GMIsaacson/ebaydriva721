'use strict';

const { preflightAction } = require('./runtime.cjs');

const ENVIRONMENTS = new Set(['STAGING', 'PRODUCTION']);
const ACTIVATION_STATES = new Set([
  'DRAFT',
  'CONNECTED_SHADOW',
  'APPROVAL_GATED',
  'BOUNDED_LIVE',
  'PAUSED',
  'RETIRED'
]);

const ALLOWED_TRANSITIONS = {
  DRAFT: new Set(['CONNECTED_SHADOW', 'RETIRED']),
  CONNECTED_SHADOW: new Set(['APPROVAL_GATED', 'PAUSED']),
  APPROVAL_GATED: new Set(['BOUNDED_LIVE', 'PAUSED']),
  BOUNDED_LIVE: new Set(['PAUSED']),
  PAUSED: new Set(['CONNECTED_SHADOW', 'RETIRED']),
  RETIRED: new Set()
};

const SECRET_KEY_PATTERN = /(^|_)(password|passwd|api.?key|access.?token|refresh.?token|client.?secret|private.?key|secret)(_|$)/i;

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function findRawSecretPaths(value, path = '$', findings = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => findRawSecretPaths(item, `${path}[${index}]`, findings));
    return findings;
  }
  if (!isObject(value)) return findings;

  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`;
    if (SECRET_KEY_PATTERN.test(key) && key !== 'credentialRef' && child !== null && child !== '') {
      findings.push(childPath);
    }
    findRawSecretPaths(child, childPath, findings);
  }
  return findings;
}

function validateCustomerDeploymentProfile(profile) {
  const errors = [];
  if (!isObject(profile)) return { valid: false, errors: ['INVALID_PROFILE'] };

  for (const field of ['deploymentId', 'customerId', 'tenantId', 'releaseRef', 'environment', 'activationState', 'namespace', 'rollbackRef', 'killSwitchRef']) {
    if (typeof profile[field] !== 'string' || !profile[field].trim()) errors.push(`MISSING_OR_INVALID_${field.toUpperCase()}`);
  }

  if (!ENVIRONMENTS.has(profile.environment)) errors.push('INVALID_ENVIRONMENT');
  if (!ACTIVATION_STATES.has(profile.activationState)) errors.push('INVALID_ACTIVATION_STATE');

  if (typeof profile.customerId === 'string' && typeof profile.tenantId === 'string') {
    if (profile.tenantId !== `tenant:${profile.customerId}`) errors.push('TENANT_ID_NOT_CUSTOMER_SCOPED');
  }
  if (typeof profile.customerId === 'string' && typeof profile.namespace === 'string') {
    const expectedPrefix = `cust:${profile.customerId}`;
    if (!(profile.namespace === expectedPrefix || profile.namespace.startsWith(`${expectedPrefix}:`))) {
      errors.push('NAMESPACE_NOT_CUSTOMER_SCOPED');
    }
  }

  if (!Array.isArray(profile.integrations)) {
    errors.push('INTEGRATIONS_MUST_BE_ARRAY');
  } else {
    const ids = new Set();
    for (const integration of profile.integrations) {
      if (!isObject(integration)) {
        errors.push('INVALID_INTEGRATION');
        continue;
      }
      for (const field of ['integrationId', 'system', 'credentialRef']) {
        if (typeof integration[field] !== 'string' || !integration[field].trim()) errors.push(`INTEGRATION_MISSING_${field.toUpperCase()}`);
      }
      if (integration.integrationId) {
        if (ids.has(integration.integrationId)) errors.push('DUPLICATE_INTEGRATION_ID');
        ids.add(integration.integrationId);
      }
      if (!Array.isArray(integration.allowedActions)) errors.push('INTEGRATION_ALLOWED_ACTIONS_MUST_BE_ARRAY');
      else if (new Set(integration.allowedActions).size !== integration.allowedActions.length) errors.push('DUPLICATE_ALLOWED_ACTION');
    }
  }

  if (!isObject(profile.authority)) {
    errors.push('MISSING_AUTHORITY');
  } else {
    if (typeof profile.authority.externalActionsApproved !== 'boolean') errors.push('INVALID_EXTERNAL_ACTIONS_APPROVED');
    if (!Number.isInteger(profile.authority.costCeilingCents) || profile.authority.costCeilingCents < 0) errors.push('INVALID_PROFILE_COST_CEILING');
    if (profile.authority.externalActionsApproved === true && !profile.authority.approvalRef) errors.push('PROFILE_APPROVAL_REF_REQUIRED');
  }

  const secretPaths = findRawSecretPaths(profile);
  if (secretPaths.length) errors.push(...secretPaths.map((p) => `RAW_SECRET_PROHIBITED:${p}`));

  return { valid: errors.length === 0, errors };
}

function evaluateActivationTransition({ from, to, profile, evidence = {} }) {
  const reasons = [];
  const validation = validateCustomerDeploymentProfile(profile);
  if (!validation.valid) reasons.push(...validation.errors.map((error) => `PROFILE:${error}`));
  if (!ACTIVATION_STATES.has(from)) reasons.push('INVALID_FROM_STATE');
  if (!ACTIVATION_STATES.has(to)) reasons.push('INVALID_TO_STATE');
  if (profile?.activationState !== from) reasons.push('PROFILE_STATE_MISMATCH');
  if (ACTIVATION_STATES.has(from) && ACTIVATION_STATES.has(to) && !ALLOWED_TRANSITIONS[from].has(to)) reasons.push('TRANSITION_NOT_ALLOWED');

  if (to === 'CONNECTED_SHADOW' && evidence.connectionChecksPassed !== true) reasons.push('CONNECTION_CHECKS_REQUIRED');
  if (to === 'APPROVAL_GATED' && evidence.shadowEvidencePassed !== true) reasons.push('SHADOW_EVIDENCE_REQUIRED');
  if (to === 'BOUNDED_LIVE') {
    if (evidence.controlledPilotApproved !== true) reasons.push('CONTROLLED_PILOT_APPROVAL_REQUIRED');
    if (!evidence.approvalRef) reasons.push('CONTROLLED_PILOT_APPROVAL_REF_REQUIRED');
    if (profile?.authority?.externalActionsApproved !== true) reasons.push('PROFILE_EXTERNAL_AUTHORITY_NOT_APPROVED');
    if (!profile?.authority?.approvalRef) reasons.push('PROFILE_APPROVAL_REF_REQUIRED');
  }

  return { allowed: reasons.length === 0, reasons };
}

function preflightCustomerAction({ profile, action }) {
  const reasons = [];
  const validation = validateCustomerDeploymentProfile(profile);
  if (!validation.valid) reasons.push(...validation.errors.map((error) => `PROFILE:${error}`));
  if (!isObject(action)) return { allowed: false, reasons: [...reasons, 'INVALID_ACTION'] };

  if (action.customerId !== profile?.customerId) reasons.push('CUSTOMER_SCOPE_MISMATCH');
  if (action.tenantId !== profile?.tenantId) reasons.push('TENANT_SCOPE_MISMATCH');
  if (profile?.activationState === 'DRAFT' || profile?.activationState === 'PAUSED' || profile?.activationState === 'RETIRED') reasons.push('DEPLOYMENT_NOT_EXECUTABLE');

  const integration = Array.isArray(profile?.integrations)
    ? profile.integrations.find((item) => item.integrationId === action.integrationId)
    : null;
  if (!integration) reasons.push('INTEGRATION_NOT_REGISTERED');
  else if (!integration.allowedActions.includes(action.actionType)) reasons.push('ACTION_NOT_ALLOWLISTED');

  if (action.external === true) {
    if (profile?.activationState !== 'BOUNDED_LIVE') reasons.push('EXTERNAL_ACTION_BLOCKED_OUTSIDE_BOUNDED_LIVE');
    if (profile?.authority?.externalActionsApproved !== true) reasons.push('PROFILE_EXTERNAL_AUTHORITY_NOT_APPROVED');
    if (!profile?.authority?.approvalRef) reasons.push('PROFILE_APPROVAL_REF_REQUIRED');
  }

  if (Number.isInteger(action.estimatedCostCents) && Number.isInteger(profile?.authority?.costCeilingCents) && action.estimatedCostCents > profile.authority.costCeilingCents) {
    reasons.push('PROFILE_COST_CEILING_EXCEEDED');
  }

  const core = preflightAction(action);
  if (!core.allowed) reasons.push(...core.reasons.map((reason) => `CORE:${reason}`));

  return { allowed: reasons.length === 0, reasons };
}

module.exports = {
  ENVIRONMENTS,
  ACTIVATION_STATES,
  ALLOWED_TRANSITIONS,
  findRawSecretPaths,
  validateCustomerDeploymentProfile,
  evaluateActivationTransition,
  preflightCustomerAction
};
