'use strict';
const { createHash } = require('node:crypto');
const { calculateEconomics } = require('./economics.cjs');

const LEAF = '14623206011';
const RUN = 'SM-AMZ-PLANT-LABELS-001';
const MARKER = '[AMAZON_LEAF_STAGE_V1]';
const STAGE_MODEL_BUDGET_CENTS = 6;
const MAX_RUN_MODEL_BUDGET_CENTS = 36;
const MAX_PUBLIC_RESEARCH_CALLS = 200;

const STAGES = Object.freeze([
  ['ASIN_DISCOVERY', 'AGT-RESEARCH-VALIDATION-001'],
  ['DEMAND_VALIDATION', 'AGT-RESEARCH-VALIDATION-001'],
  ['SOURCING', 'SPC-SOURCE-001'],
  ['LANDED_COST', 'SPC-FREIGHT-001'],
  ['ECONOMICS', 'SPC-ECON-001'],
  ['EVIDENCE_QA', 'SPC-EVID-001'],
]);

const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fail = message => { throw new Error(message); };

function initial() {
  return {
    runId: RUN,
    leafId: LEAF,
    version: 0,
    phase: 'READY',
    stage: 0,
    commandId: null,
    attempts: 0,
    modelBudgetCommittedCents: 0,
    publicResearchCalls: 0,
    results: [],
    events: [],
  };
}

function validateResult(r, stage, now) {
  if (!r || typeof r !== 'object' || r.runId !== RUN || r.leafId !== LEAF || r.stage !== stage) fail('RESULT_SCOPE_MISMATCH');
  if (!['PASS', 'BLOCKED', 'REJECTED'].includes(r.outcome)) fail('INVALID_OUTCOME');
  if (typeof r.summary !== 'string' || !r.summary.trim() || r.summary.length > 4000) fail('SUMMARY_REQUIRED');
  if (!Array.isArray(r.blockers) || !Array.isArray(r.evidence) || r.evidence.length > 200) fail('INVALID_EVIDENCE');
  if (r.outcome === 'BLOCKED' && !r.blockers.length) fail('BLOCK_REASON_REQUIRED');
  if (r.outcome === 'PASS' && r.blockers.length) fail('PASS_WITH_BLOCKERS');
  if (!Array.isArray(r.candidates) || r.candidates.length > 25) fail('CANDIDATE_CAP');
  const ids = new Set();
  for (const c of r.candidates) {
    if (!/^[A-Z0-9]{10}$/.test(c.asin) || ids.has(c.asin)) fail('INVALID_OR_DUPLICATE_ASIN');
    ids.add(c.asin);
    if (!['continue', 'rejected', 'blocked', 'research_candidate'].includes(c.disposition) || !c.reason) fail('CANDIDATE_DISPOSITION_REQUIRED');
  }
  for (const e of r.evidence) {
    let u; try { u = new URL(e.url); } catch { fail('EVIDENCE_URL_REQUIRED'); }
    const at = Date.parse(e.observedAt);
    if (u.protocol !== 'https:' || u.username || u.password || !Number.isFinite(at) || at > now || now-at > 7*86400000 || !e.claim || !e.sourceReceipt) fail('INVALID_OR_STALE_EVIDENCE');
  }
  if (r.outcome !== 'BLOCKED' && !r.evidence.length) fail('EVIDENCE_REQUIRED');
  if (stage === 'ECONOMICS' && r.outcome === 'PASS') {
    for (const c of r.candidates.filter(c => c.disposition === 'continue' || c.disposition === 'research_candidate')) {
      const computed = calculateEconomics(c.economicsInputs || {});
      if (computed.status !== 'Complete') fail('ECONOMICS_INPUTS_INCOMPLETE');
      c.deterministicEconomics = computed;
    }
  }
  if (r.outcome === 'REJECTED' && (!r.candidates.length || r.candidates.some(c => c.disposition !== 'rejected'))) fail('REJECTION_REQUIRES_ALL_CANDIDATES');
  if (stage === 'ASIN_DISCOVERY' && !['partial','top_100','exhaustive'].includes(r.coverage)) fail('COVERAGE_REQUIRED');
  if (stage === 'ASIN_DISCOVERY' && r.outcome === 'PASS' && !r.candidates.length) fail('EMPTY_DISCOVERY_NOT_PASS');
  if (r.outcome === 'PASS' && stage === 'EVIDENCE_QA' && r.candidates.some(c => c.disposition === 'continue')) fail('UNFINISHED_CANDIDATE');
  return r;
}

function economicsReview(state) {
  const row = state.results.find((x) => x?.result?.stage === 'ECONOMICS');
  if (!row) return [];
  return row.result.candidates.map((c) => ({
    asin: c.asin,
    disposition: c.disposition,
    deterministicEconomics: c.deterministicEconomics || null,
  }));
}

function instruction(state) {
  const [stage, specialist] = STAGES[state.stage];
  const payload = {
    runId: RUN,
    leafId: LEAF,
    stage,
    specialist,
    priorCommandIds: state.results.map((x) => x.commandId).slice(-5),
    limits: { maxCandidates: 5, maxSourceRequestsAcrossRun: MAX_PUBLIC_RESEARCH_CALLS },
  };
  if (stage === 'EVIDENCE_QA') payload.economicsReview = economicsReview(state);
  const text = `${MARKER} ${JSON.stringify(payload)}`;
  if (text.length > 1900) fail('COMMAND_INSTRUCTION_TOO_LARGE');
  return text;
}

function validateSpecialistReceipt(receipt, stageIndex) {
  const [stage, specialist] = STAGES[stageIndex];
  const sx = receipt?.specialistExecution;
  if (!sx || sx.specialistId !== specialist || sx.stage !== stage || sx.runId !== RUN || sx.leafId !== LEAF) {
    fail('SPECIALIST_ROUTING_RECEIPT_INVALID');
  }
  if (stage === 'EVIDENCE_QA' && sx.independentReview !== true) fail('INDEPENDENT_Q2_RECEIPT_REQUIRED');
  const calls = Number(receipt?.researchUsage?.webSearchCalls ?? 0);
  if (!Number.isInteger(calls) || calls < 0 || calls > 3) fail('PUBLIC_RESEARCH_USAGE_INVALID');
  return calls;
}

// The store owns the controller checkpoint; Work Control remains the command/receipt authority.
// CAS must be atomic on the server. A dispatch intent is never automatically replayed.
async function tick({store, workControl, bindings, now = () => new Date()}) {
  let state = await store.read() || initial();
  if (state.runId !== RUN || state.leafId !== LEAF) fail('STATE_SCOPE_MISMATCH');

  const save = async (patch, event) => {
    const next = {
      ...state,
      ...patch,
      version: state.version + 1,
      events: [...state.events, {
        seq: state.version + 1,
        at: now().toISOString(),
        stage: STAGES[state.stage]?.[0] || 'CONCLUSION',
        ...event,
      }],
    };
    await store.compareAndSet(state.version, next);
    state = next;
    return next;
  };

  if (['BLOCKED','REJECTED','RESEARCH_FINISHED','PAUSED','CANCELLED'].includes(state.phase)) return state;

  if (state.phase === 'DISPATCH_INTENT') {
    return save({phase:'BLOCKED'}, {
      kind:'AMBIGUOUS_DISPATCH',
      reason:'Reconcile Work Control command by correlation key; never redispatch blindly.',
    });
  }

  if (state.phase === 'READY') {
    if (!bindings?.executionReceipt || !bindings?.publicResearchReceipt || !bindings?.writebackReceipt || !bindings?.run004TeamId) {
      return save({phase:'BLOCKED'}, {
        kind:'PREFLIGHT_BLOCKED',
        reason:'Verified Work Control, public research, checkpoint writeback and Run 004 deployment bindings are required.',
      });
    }
    if (bindings.run004TeamId !== 'RUN-004') {
      return save({phase:'BLOCKED'}, {kind:'PREFLIGHT_BLOCKED', reason:'Live Work Control Run 004 team id must be RUN-004.'});
    }
    if (state.stage >= STAGES.length || state.modelBudgetCommittedCents + STAGE_MODEL_BUDGET_CENTS > MAX_RUN_MODEL_BUDGET_CENTS) {
      fail('RUN_BUDGET_OR_STAGE_LIMIT');
    }

    const correlationKey = `${RUN}:${STAGES[state.stage][0]}:v2`;
    const command = {
      teamId: bindings.run004TeamId,
      priority: 'normal',
      modelBudgetCents: STAGE_MODEL_BUDGET_CENTS,
      instruction: `[${correlationKey}] ${instruction(state)}`,
    };

    await save({
      phase:'DISPATCH_INTENT',
      correlationKey,
      modelBudgetCommittedCents: state.modelBudgetCommittedCents + STAGE_MODEL_BUDGET_CENTS,
    }, {kind:'DISPATCH_INTENT', inputHash:hash(command)});

    let response;
    try { response = await workControl.dispatch(command); }
    catch {
      return save({phase:'BLOCKED'}, {
        kind:'AMBIGUOUS_DISPATCH',
        reason:'Dispatch response unavailable; manual reconciliation required.',
      });
    }
    const commandId = response?.command?.commandId;
    if (typeof commandId !== 'string' || !/^WC-[A-Za-z0-9-]+$/.test(commandId)) {
      return save({phase:'BLOCKED'}, {kind:'INVALID_DISPATCH_RECEIPT'});
    }
    return save({phase:'WAITING', commandId, attempts:0}, {kind:'DISPATCHED', commandId});
  }

  if (state.phase !== 'WAITING') fail('INVALID_PHASE');

  let payload;
  try { payload = await workControl.read(state.commandId); }
  catch (error) {
    const retryable = error.status === 429 || error.status >= 500 || error.name === 'TimeoutError';
    return save({
      phase: retryable && state.attempts < 2 ? 'WAITING' : 'BLOCKED',
      attempts: state.attempts + 1,
    }, {kind:'READ_FAILED', reason:retryable ? 'Transient read failure' : 'Execution access or contract failure'});
  }

  const receipt = payload?.receipt;
  if (!receipt) {
    const sent = state.events.findLast(e => e.kind === 'DISPATCHED');
    if (!sent || now().getTime() - Date.parse(sent.at) > 30*60000) {
      return save({phase:'BLOCKED'}, {
        kind:'WORKER_TIMEOUT',
        reason:'Thirty-minute stage limit; reconcile before resuming.',
      });
    }
    return state;
  }

  if (receipt.terminalState !== 'DELIVERED') {
    return save({phase:'BLOCKED'}, {
      kind:'WORKER_BLOCKED',
      commandId:state.commandId,
      reason:receipt.terminalState || 'Unknown terminal state',
    });
  }

  let result;
  let stageCalls;
  try {
    stageCalls = validateSpecialistReceipt(receipt, state.stage);
    if (state.publicResearchCalls + stageCalls > MAX_PUBLIC_RESEARCH_CALLS) fail('PUBLIC_RESEARCH_RUN_LIMIT');
    result = validateResult(structuredClone(receipt.stageResult), STAGES[state.stage][0], now().getTime());
    if (state.results.length) {
      const prior = state.results[0].result.candidates.map(c => c.asin).sort();
      if (JSON.stringify(result.candidates.map(c => c.asin).sort()) !== JSON.stringify(prior)) fail('CANDIDATE_RECONCILIATION_FAILED');
    }
  } catch(error) {
    return save({phase:'BLOCKED'}, {
      kind:'INVALID_RESULT',
      reason:error.message,
      commandId:state.commandId,
    });
  }

  const results = [...state.results, {commandId:state.commandId, result, specialistExecution:receipt.specialistExecution}];
  const phase = result.outcome === 'BLOCKED'
    ? 'BLOCKED'
    : result.outcome === 'REJECTED'
      ? 'REJECTED'
      : state.stage === STAGES.length-1
        ? 'RESEARCH_FINISHED'
        : 'READY';

  return save({
    phase,
    stage: state.stage + 1,
    commandId:null,
    results,
    attempts:0,
    publicResearchCalls: state.publicResearchCalls + stageCalls,
  }, {
    kind:'STAGE_RESULT',
    commandId:state.commandId,
    outcome:result.outcome,
    summary:result.summary,
    specialist:receipt.specialistExecution.specialistId,
    webSearchCalls:stageCalls,
  });
}

module.exports = {
  LEAF,
  RUN,
  MARKER,
  STAGES,
  STAGE_MODEL_BUDGET_CENTS,
  MAX_RUN_MODEL_BUDGET_CENTS,
  MAX_PUBLIC_RESEARCH_CALLS,
  initial,
  validateResult,
  validateSpecialistReceipt,
  instruction,
  tick,
};
