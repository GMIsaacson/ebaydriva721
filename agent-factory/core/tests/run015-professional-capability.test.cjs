'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { evaluateProfessionalCapabilityMatrix } = require('../professional-capability-gate.cjs');

test('Run 015 canonical specialist topology passes G2.5 design completeness', () => {
  const file = path.resolve(__dirname, '../../run-015/professional-capability-matrix.json');
  const matrix = JSON.parse(fs.readFileSync(file, 'utf8'));
  const result = evaluateProfessionalCapabilityMatrix(matrix);
  assert.equal(result.status, 'PASS');
  assert.equal(result.blockedStageCount, 0);
  assert.equal(result.acceptedLimitationCount, 0);
});
