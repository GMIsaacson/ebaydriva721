const { createHash } = require('node:crypto');
const { validateHandoff } = require('./handoff.cjs');
const { evaluatePolicy } = require('./policy.cjs');

function inputHash(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function classifyError(error) {
  const category = error?.category || error?.code || 'UNKNOWN';
  const transient = error?.transient === true || ['TIMEOUT', 'RATE_LIMIT', 'UNAVAILABLE'].includes(category);
  return { category, transient, message: error?.message || String(error) };
}

class ControlledRuntime {
  constructor({ config, store, clock = () => new Date() }) {
    this.config = config;
    this.store = store;
    this.clock = clock;
    this.store.initialize(config.runId, config.mode);
  }

  start() {
    const control = this.store.getControl(this.config.runId);
    if (control.killSwitch || control.state === 'cancelled') throw new Error('cancelled run cannot start');
    return this.store.setControl(this.config.runId, { state: 'running' });
  }

  stop(reason = 'owner stop') {
    return this.store.setControl(this.config.runId, { state: 'stopped', stopReason: reason });
  }

  restart() {
    const control = this.store.getControl(this.config.runId);
    if (control.killSwitch || control.state === 'cancelled') throw new Error('kill switch prevents restart');
    if (control.state !== 'stopped' && control.state !== 'failed') {
      throw new Error('restart is allowed only from stopped or failed');
    }
    return this.store.setControl(this.config.runId, {
      state: 'running',
      restartCount: control.restartCount + 1,
    });
  }

  cancel(reason = 'owner cancellation') {
    return this.store.setControl(this.config.runId, {
      state: 'cancelled',
      killSwitch: true,
      cancelReason: reason,
    });
  }

  async execute({ handoff, request }, internalOperation = async () => ({ status: 'ok' })) {
    const startedAt = this.clock().toISOString();
    const control = this.store.getControl(this.config.runId);
    const telemetryBase = {
      runId: this.config.runId,
      handoffId: handoff?.handoff_id || null,
      agentId: handoff?.producer_agent_id || null,
      contractVersion: this.config.contractVersion,
      inputHash: inputHash({ handoff, request }),
      startedAt,
      estimatedCostCents: 0,
      externalActions: 0,
    };

    if (!control || control.killSwitch || control.state === 'cancelled') {
      return this.#finalize(handoff?.idempotency_key, telemetryBase, {
        status: 'Cancelled',
        reason: 'kill switch or cancellation is active',
        retries: 0,
      });
    }
    if (control.state !== 'running') {
      return this.#finalize(handoff?.idempotency_key, telemetryBase, {
        status: 'Review',
        reason: `runtime is ${control.state}`,
        retries: 0,
      });
    }

    const existing = this.store.getResult(handoff?.idempotency_key);
    if (existing) return { ...existing, duplicate: true };

    const handoffDecision = validateHandoff(handoff, this.config, this.clock());
    if (!handoffDecision.valid) {
      const status = handoffDecision.expired ? 'Review' : 'Rejected';
      return this.#finalize(handoff?.idempotency_key, telemetryBase, {
        status,
        reason: handoffDecision.errors.join('; ') || 'handoff expired',
        retries: 0,
      });
    }

    const policyDecision = evaluatePolicy(request, this.config);
    if (policyDecision.status !== 'Accepted') {
      return this.#finalize(handoff.idempotency_key, telemetryBase, {
        ...policyDecision,
        retries: 0,
      });
    }

    let retries = 0;
    while (true) {
      try {
        const operationResult = await internalOperation({ handoff, request, policyDecision });
        return this.#finalize(handoff.idempotency_key, telemetryBase, {
          ...policyDecision,
          operationResult,
          retries,
        });
      } catch (error) {
        const classified = classifyError(error);
        if (!classified.transient || retries >= this.config.maxRetries) {
          const result = this.#finalize(handoff.idempotency_key, telemetryBase, {
            status: 'Review',
            reason: classified.message,
            exceptionCategory: classified.category,
            retries,
            humanReviewRequired: true,
          });
          this.store.addDeadLetter({ ...result, handoff, request });
          return result;
        }
        retries += 1;
      }
    }
  }

  #finalize(idempotencyKey, telemetryBase, result) {
    const final = {
      ...result,
      runId: this.config.runId,
      idempotencyKey: idempotencyKey || null,
      externalActions: 0,
      spendingCents: 0,
      finishedAt: this.clock().toISOString(),
    };
    const telemetry = { ...telemetryBase, ...final };
    this.store.recordAttempt(telemetry);
    if (['Review', 'Incomplete', 'Rejected'].includes(final.status)) this.store.addReview(telemetry);
    if (idempotencyKey) this.store.saveResult(idempotencyKey, final);
    this.store.setControl(this.config.runId, {
      checkpoint: {
        idempotencyKey: idempotencyKey || null,
        status: final.status,
        finishedAt: final.finishedAt,
      },
    });
    return this.store.getResult(idempotencyKey) || final;
  }
}

module.exports = {
  ControlledRuntime,
  classifyError,
  inputHash,
};
