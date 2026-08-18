const fs = require('node:fs');
const path = require('node:path');
const { collectRegistry, feedCollectedSignals } = require('../runtime/g5-collector.cjs');

(async () => {
  const registry = JSON.parse(fs.readFileSync(path.join(__dirname, '../collectors/source-registry.v0.1.json'), 'utf8'));
  const collected = await collectRegistry(registry);
  const pipeline = feedCollectedSignals(collected.results);
  const report = {
    runId: registry.runId,
    gate: 'G5_LIVE_PROOF',
    observedAt: new Date().toISOString(),
    authority: collected.authority,
    scheduleAuthorized: collected.scheduleAuthorized,
    externalActions: collected.externalActions,
    costCents: 0,
    sourcesAttempted: collected.sourcesAttempted,
    sourcesSucceeded: collected.sourcesSucceeded,
    sourcesFailed: collected.sourcesFailed,
    failures: collected.failures,
    sourceResults: collected.results.map(r => ({
      sourceId: r.sourceId,
      municipality: r.municipality,
      pagesAttempted: r.pagesAttempted,
      pagesSucceeded: r.pagesSucceeded,
      signalCount: r.signals.length,
      pageUrls: r.pageUrls,
    })),
    pipelineSummary: pipeline.summary,
  };
  console.log(JSON.stringify(report, null, 2));
  if (report.externalActions !== 0 || report.scheduleAuthorized !== false || report.costCents !== 0) process.exit(2);
  if (report.sourcesSucceeded !== report.sourcesAttempted) process.exit(3);
  if (report.sourceResults.some(r => r.signalCount < 1)) process.exit(4);
  if (report.pipelineSummary.actionableCount !== 0 || report.pipelineSummary.watchCount < 1) process.exit(5);
})().catch(err => { console.error(err); process.exit(1); });
