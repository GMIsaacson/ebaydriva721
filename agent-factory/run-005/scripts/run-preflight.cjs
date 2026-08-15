const fs = require('node:fs');
const path = require('node:path');
const { InMemoryIdempotencyStore, prepareDispatch } = require('../runtime/pilot.cjs');

const fixturePath = process.argv[2] || path.resolve(__dirname, '../fixtures/approved-self-email.json');
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
const result = prepareDispatch(fixture, new InMemoryIdempotencyStore());
if (result.status !== 'ReadyForApprovedExecutor') throw new Error(`Run 005 preflight failed: ${JSON.stringify(result)}`);
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);

