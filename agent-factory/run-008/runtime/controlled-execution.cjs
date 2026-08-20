const { preflightAction } = require('./runtime.cjs');
const { evaluateRunControl, planRollback } = require('./recovery-value.cjs');

function evaluateControlledExecution({ action, runControl } = {}) {
  const actionGate = preflightAction(action);
  const controlGate = evaluateRunControl(runControl);
  const reasons = [
    ...actionGate.reasons.map((reason) => `ACTION:${reason}`),
    ...controlGate.reasons.map((reason) => `CONTROL:${reason}`)
  ];
  return {
    allowed: actionGate.allowed && controlGate.allowed,
    controlState: controlGate.state,
    reasons
  };
}

function evaluateRollbackRecovery({ rollback, recoveredRunControl } = {}) {
  const rollbackGate = planRollback(rollback);
  const recoveryGate = evaluateRunControl(recoveredRunControl);
  const reasons = [
    ...rollbackGate.reasons.map((reason) => `ROLLBACK:${reason}`),
    ...recoveryGate.reasons.map((reason) => `RECOVERY:${reason}`)
  ];
  return {
    allowed: rollbackGate.allowed && recoveryGate.allowed,
    currentVersion: rollbackGate.currentVersion || null,
    targetVersion: rollbackGate.targetVersion || null,
    recoveredControlState: recoveryGate.state,
    reasons
  };
}

module.exports = { evaluateControlledExecution, evaluateRollbackRecovery };
