const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluateCompletionGuard } = require('../runtime/completion-guard.cjs');
const { ControlledRuntime } = require('../runtime/runtime.cjs');
const { DEFAULT_CONFIG } = require('../runtime/config.cjs');
const { InMemoryRunStore } = require('../runtime/store.cjs');

function fixture() {
  return {
    projectId: 'SourceMargin',
    material: true,
    workOrderId: 'M-004-WO-001',
    checkedAt: '2026-09-19T22:30:00-05:00',
    writebacks: {
      supabase: { present: true, refs: ['supabase://audit_actions/78'] },
      workControl: { present: true, refs: ['github://GMIsaacson/ebaydriva721/issues/108'] },
      github: { required: true, present: true, refs: ['github://GMIsaacson/sourcemargin1.0/docs/PROJECT_STATUS.md'] },
    },
    reconciliation: {
      status: 'CONSISTENT',
      receiptId: 'SM-STATE-1234567890abcdef',
      refs: ['github://GMIsaacson/ebaydriva721/agent-factory/run-004/runtime/state-reconciler.cjs'],
    },
    qa: {
      q1: { required: true, status: 'PASS', refs: ['qa://q1/receipt-1'] },
      q2: { required: true, status: 'PASS', refs: ['qa://q2/receipt-1'] },
    },
  };
}

test('all required receipts permit DONE deterministically', () => {
  const a = evaluateCompletionGuard(fixture());
  const b = evaluateCompletionGuard(fixture());
  assert.equal(a.completionStatus, 'DONE');
  assert.equal(a.completionEligible, true);
  assert.equal(a.receiptId, b.receiptId);
  assert.deepEqual(a, b);
});

test('missing Supabase writeback blocks completion', () => {
  const input = fixture();
  input.writebacks.supabase.present = false;
  const receipt = evaluateCompletionGuard(input);
  assert.equal(receipt.completionStatus, 'BLOCKED_WRITEBACK');
  assert.ok(receipt.violations.includes('SUPABASE_WRITEBACK_MISSING'));
});

test('missing Work Control handoff blocks completion', () => {
  const input = fixture();
  input.writebacks.workControl.refs = [];
  const receipt = evaluateCompletionGuard(input);
  assert.ok(receipt.violations.includes('WORK_CONTROL_HANDOFF_MISSING'));
});

test('GitHub may be explicitly not required, but required GitHub writeback must exist', () => {
  const optional = fixture();
  optional.writebacks.github = { required: false, present: false, refs: [] };
  assert.equal(evaluateCompletionGuard(optional).completionStatus, 'DONE');

  const required = fixture();
  required.writebacks.github.present = false;
  assert.ok(evaluateCompletionGuard(required).violations.includes('GITHUB_WRITEBACK_MISSING'));
});

test('non-consistent reconciliation blocks completion', () => {
  for (const status of ['STALE', 'CONFLICT', 'BLOCKED']) {
    const input = fixture();
    input.reconciliation.status = status;
    const receipt = evaluateCompletionGuard(input);
    assert.ok(receipt.violations.includes('RECONCILIATION_NOT_CONSISTENT'));
  }
});

test('required Q1 and Q2 must pass with evidence', () => {
  const input = fixture();
  input.qa.q1.status = 'FAIL';
  input.qa.q2.refs = [];
  const receipt = evaluateCompletionGuard(input);
  assert.ok(receipt.violations.includes('Q1_REQUIRED_NOT_PASS'));
  assert.ok(receipt.violations.includes('Q2_REQUIRED_NOT_PASS'));
});

test('Run 004 cannot enter completed state without a passing guard receipt', () => {
  const clock = () => new Date('2026-09-20T03:00:00.000Z');
  const store = new InMemoryRunStore(clock);
  const runtime = new ControlledRuntime({ config: DEFAULT_CONFIG, store, clock });

  const blockedInput = fixture();
  blockedInput.writebacks.supabase.present = false;
  const blocked = runtime.complete(blockedInput);
  assert.equal(blocked.state, 'blocked_writeback');
  assert.equal(blocked.completionReceipt.completionStatus, 'BLOCKED_WRITEBACK');

  const completed = runtime.complete(fixture());
  assert.equal(completed.state, 'completed');
  assert.equal(completed.completionReceipt.completionStatus, 'DONE');
});

test('completed Run 004 cannot be restarted through start()', () => {
  const clock = () => new Date('2026-09-20T03:00:00.000Z');
  const store = new InMemoryRunStore(clock);
  const runtime = new ControlledRuntime({ config: DEFAULT_CONFIG, store, clock });
  runtime.complete(fixture());
  assert.throws(() => runtime.start(), /completed run cannot start/);
});
