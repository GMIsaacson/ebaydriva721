'use strict';

const crypto = require('crypto');

const PRIORITIES = new Set(['low', 'normal', 'high', 'urgent']);
const TERMINAL_STATES = new Set(['DELIVERED', 'BLOCKED_OWNER', 'BLOCKED_EXTERNAL', 'KILLED', 'FAILED']);
const APPROVAL_DECISIONS = new Set(['approved', 'rejected']);

function normalizeText(value, max = 4000) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((out, key) => {
      if (value[key] !== undefined) out[key] = canonicalize(value[key]);
      return out;
    }, {});
  }
  return value;
}

function sha256(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(canonicalize(value));
  return crypto.createHash('sha256').update(text).digest('hex');
}

function safeId(value) {
  const id = String(value || '').trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{2,127}$/.test(id)) throw new Error('INVALID_ID');
  return id;
}

function findRunnableTeam(registry, teamId) {
  const teams = Array.isArray(registry?.teams) ? registry.teams : [];
  const team = teams.find((item) => item.id === teamId);
  if (!team) throw new Error('TEAM_NOT_FOUND');
  if (team.runNumber === 13) throw new Error('RUN_013_RESERVED');
  if (team.runnable !== true) throw new Error('TEAM_NOT_RUNNABLE');
  return team;
}

function createCommand({ registry, teamId, instruction, priority = 'normal', now = new Date().toISOString(), idFactory = crypto.randomUUID }) {
  const team = findRunnableTeam(registry, teamId);
  const clean = normalizeText(instruction, 2000);
  if (clean.length < 3) throw new Error('INSTRUCTION_REQUIRED');
  if (!PRIORITIES.has(priority)) throw new Error('INVALID_PRIORITY');
  const commandId = `WC-${String(now).replace(/[^0-9]/g, '').slice(0, 14)}-${String(idFactory()).replace(/-/g, '').slice(0, 10)}`;
  const payload = {
    schemaVersion: '1.0',
    commandType: 'team_assignment_v1',
    commandId,
    team: { id: team.id, runNumber: team.runNumber, run: team.run, name: team.name, kind: team.kind },
    instruction: clean,
    priority,
    requestedAt: now,
    source: 'work-control-v1',
    status: 'QUEUED_GOVERNED',
    executorState: 'WAITING_WORKER',
    authorityCeiling: {
      maxExternalActions: 0,
      maxSpendCents: 0,
      deploy: false,
      publish: false,
      message: false,
      destructiveActions: false,
      productionMutation: false
    }
  };
  return { ...payload, integritySha256: sha256(payload) };
}

function verifyCommand(command) {
  if (!command || typeof command !== 'object') return false;
  const { integritySha256, ...payload } = command;
  return typeof integritySha256 === 'string' && integritySha256 === sha256(payload);
}

function createApprovalRequest({ command, title, target, environment, maxExternalActions = 0, maxSpendCents = 0, production = false, reason, now = new Date().toISOString(), idFactory = crypto.randomUUID }) {
  if (!verifyCommand(command)) throw new Error('COMMAND_INTEGRITY_FAIL');
  if (!title || !target || !environment) throw new Error('APPROVAL_FIELDS_REQUIRED');
  const approval = {
    schemaVersion: '1.0',
    approvalId: `APP-${String(now).replace(/[^0-9]/g, '').slice(0, 14)}-${String(idFactory()).replace(/-/g, '').slice(0, 8)}`,
    commandId: command.commandId,
    title: normalizeText(title, 180),
    target: normalizeText(target, 300),
    environment: normalizeText(environment, 80),
    maxExternalActions: Number(maxExternalActions),
    maxSpendCents: Number(maxSpendCents),
    production: production === true,
    reason: normalizeText(reason, 1200),
    status: 'pending',
    requestedAt: now,
    decision: null,
    transmitted: false
  };
  if (!Number.isInteger(approval.maxExternalActions) || approval.maxExternalActions < 0) throw new Error('INVALID_ACTION_LIMIT');
  if (!Number.isInteger(approval.maxSpendCents) || approval.maxSpendCents < 0) throw new Error('INVALID_SPEND_LIMIT');
  return approval;
}

function decideApproval(approval, decision, now = new Date().toISOString()) {
  if (!approval || typeof approval !== 'object') throw new Error('APPROVAL_REQUIRED');
  if (approval.status !== 'pending') throw new Error('APPROVAL_ALREADY_DECIDED');
  if (!APPROVAL_DECISIONS.has(decision)) throw new Error('INVALID_DECISION');
  return { ...approval, status: decision, decision, decidedAt: now, transmitted: false, transmissionState: 'NOT_CONSUMED_BY_EXECUTOR' };
}

function validateReceipt(command, receipt) {
  if (!verifyCommand(command)) throw new Error('COMMAND_INTEGRITY_FAIL');
  if (!receipt || typeof receipt !== 'object') throw new Error('RECEIPT_REQUIRED');
  if (receipt.commandId !== command.commandId) throw new Error('COMMAND_RECEIPT_MISMATCH');
  if (!TERMINAL_STATES.has(receipt.terminalState)) throw new Error('INVALID_TERMINAL_STATE');
  const externalActions = Number(receipt.externalActionsPerformed ?? 0);
  const spendCents = Number(receipt.spendCents ?? 0);
  if (!Number.isInteger(externalActions) || externalActions < 0) throw new Error('INVALID_EXTERNAL_ACTION_COUNT');
  if (!Number.isInteger(spendCents) || spendCents < 0) throw new Error('INVALID_SPEND');
  if (externalActions > command.authorityCeiling.maxExternalActions) throw new Error('EXTERNAL_AUTHORITY_EXCEEDED');
  if (spendCents > command.authorityCeiling.maxSpendCents) throw new Error('SPEND_AUTHORITY_EXCEEDED');
  if (receipt.productionMutation === true && command.authorityCeiling.productionMutation !== true) throw new Error('PRODUCTION_AUTHORITY_EXCEEDED');
  return true;
}

function commandToWork(command, receipt = null) {
  const map = {
    WAITING_WORKER: ['queued', 15, 'Waiting for governed team executor'],
    CLAIMED: ['running', 25, 'Executor claimed assignment'],
    RUNNING: ['running', 55, 'Team work in progress']
  };
  if (!receipt) {
    const [status, progress, next] = map[command.executorState] || map.WAITING_WORKER;
    return {
      id: command.commandId,
      title: command.instruction.length > 76 ? `${command.instruction.slice(0, 73)}...` : command.instruction,
      teamId: command.team.id,
      teamName: command.team.name,
      status,
      priority: command.priority,
      createdAt: command.requestedAt,
      progress,
      next,
      source: 'control-ledger',
      stages: [
        { name: 'Governed request', state: 'done', detail: `Integrity ${command.integritySha256.slice(0, 12)}…` },
        { name: 'Team executor', state: status === 'running' ? 'active' : 'queued', detail: command.executorState }
      ],
      result: { summary: 'No terminal receipt yet', detail: 'The assignment is real and persisted, but Work Control does not claim execution until a governed executor produces a receipt.' }
    };
  }
  const terminalMap = {
    DELIVERED: ['completed', 100, 'Complete'],
    BLOCKED_OWNER: ['blocked', 75, 'Owner action required'],
    BLOCKED_EXTERNAL: ['blocked', 75, 'External blocker'],
    KILLED: ['blocked', 100, 'Killed by governance'],
    FAILED: ['blocked', 100, 'Execution failed']
  };
  const [status, progress, next] = terminalMap[receipt.terminalState];
  return {
    id: command.commandId,
    title: command.instruction.length > 76 ? `${command.instruction.slice(0, 73)}...` : command.instruction,
    teamId: command.team.id,
    teamName: command.team.name,
    status,
    priority: command.priority,
    createdAt: command.requestedAt,
    progress,
    next,
    source: 'control-ledger',
    stages: [
      { name: 'Governed request', state: 'done', detail: `Integrity ${command.integritySha256.slice(0, 12)}…` },
      { name: 'Team execution', state: receipt.terminalState === 'DELIVERED' ? 'done' : 'blocked', detail: receipt.terminalState }
    ],
    result: {
      summary: normalizeText(receipt.summary || receipt.terminalState, 300),
      detail: normalizeText(receipt.detail || 'Terminal receipt recorded by governed executor.', 2000)
    }
  };
}

module.exports = {
  PRIORITIES,
  TERMINAL_STATES,
  normalizeText,
  canonicalize,
  sha256,
  safeId,
  findRunnableTeam,
  createCommand,
  verifyCommand,
  createApprovalRequest,
  decideApproval,
  validateReceipt,
  commandToWork
};
