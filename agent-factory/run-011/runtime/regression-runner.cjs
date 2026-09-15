'use strict';

const fs = require('fs');
const path = require('path');
const { scoreOpportunity } = require('./opportunity-score.cjs');
const { scopeGate } = require('./scope-gate.cjs');

function containsAny(text, alternatives) {
  const haystack = text.toLowerCase();
  return alternatives.some((x) => haystack.includes(String(x).toLowerCase()));
}

function runRegressionCase(testCase) {
  const output = testCase.calibrationOutput;
  const combined = JSON.stringify(output);
  const missingConcepts = [];

  for (const group of testCase.expectedConceptGroups || []) {
    if (!containsAny(combined, group)) missingConcepts.push(group);
  }

  const scoring = scoreOpportunity(output.candidate);
  const safety = scopeGate(output);
  const pass = missingConcepts.length === 0 && safety.pass && scoring.score >= testCase.minimumScore;

  return {
    id: testCase.id,
    pass,
    missingConcepts,
    safety,
    scoring,
  };
}

function runRegistry(registryPath) {
  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  return {
    suite: registry.suite,
    results: registry.cases.map(runRegressionCase),
  };
}

if (require.main === module) {
  const registryPath = process.argv[2] || path.join(__dirname, '..', 'registry', 'missed-opportunity-regressions.json');
  const result = runRegistry(registryPath);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (result.results.some((x) => !x.pass)) process.exitCode = 1;
}

module.exports = { runRegressionCase, runRegistry };
