'use strict';

const fixture = require('../fixtures/synthetic-baseline.json');
const { runBatch } = require('../runtime/runtime.cjs');

const result = runBatch(structuredClone(fixture));
process.stdout.write(JSON.stringify(result, null, 2) + '\n');
if (result.status !== 'Pass') process.exitCode = 1;
