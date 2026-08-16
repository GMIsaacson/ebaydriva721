class InMemoryRunStore {
  constructor(clock = () => new Date()) {
    this.clock = clock;
    this.control = new Map();
    this.results = new Map();
    this.attempts = [];
    this.deadLetters = [];
    this.reviews = [];
  }

  initialize(runId, mode = 'offline') {
    if (!this.control.has(runId)) {
      this.control.set(runId, {
        runId,
        mode,
        state: 'ready',
        killSwitch: false,
        restartCount: 0,
        checkpoint: null,
        externalActionsEnabled: false,
        spendingAuthorityCents: 0,
        updatedAt: this.clock().toISOString(),
      });
    }
    return this.getControl(runId);
  }

  getControl(runId) {
    const value = this.control.get(runId);
    return value ? structuredClone(value) : null;
  }

  setControl(runId, patch) {
    const current = this.control.get(runId);
    if (!current) throw new Error(`Run control not initialized: ${runId}`);
    const next = { ...current, ...patch, updatedAt: this.clock().toISOString() };
    if (next.externalActionsEnabled !== false) throw new Error('external actions cannot be enabled');
    if (next.spendingAuthorityCents !== 0) throw new Error('spending authority cannot exceed $0');
    this.control.set(runId, next);
    return this.getControl(runId);
  }

  getResult(idempotencyKey) {
    const value = this.results.get(idempotencyKey);
    return value ? structuredClone(value) : null;
  }

  saveResult(idempotencyKey, result) {
    if (!this.results.has(idempotencyKey)) this.results.set(idempotencyKey, structuredClone(result));
    return this.getResult(idempotencyKey);
  }

  recordAttempt(attempt) {
    this.attempts.push(structuredClone(attempt));
  }

  addDeadLetter(item) {
    this.deadLetters.push(structuredClone(item));
  }

  addReview(item) {
    this.reviews.push(structuredClone(item));
  }
}

module.exports = { InMemoryRunStore };
