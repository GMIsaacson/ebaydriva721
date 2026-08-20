const test = require('node:test');
const assert = require('node:assert/strict');
const { runRetryDeadLetterCancellationProof } = require('../proofs/retry-deadletter-cancellation-proof.cjs');

test('bounded retry exhausts to owned dead letter and cancellation blocks replay', () => {
  const result = runRetryDeadLetterCancellationProof();
  assert.equal(result.valid, true, JSON.stringify(result, null, 2));
  assert.equal(result.authority.externalActions, 0);
  assert.equal(result.authority.spendCents, 0);
  assert.equal(result.authority.autoRequeue, false);
});
