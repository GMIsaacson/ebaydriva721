const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} = require('@firebase/rules-unit-testing');
const {
  deleteDoc,
  doc,
  getDoc,
  setDoc,
} = require('firebase/firestore');

const PROJECT_ID = 'demo-datascout-run004';
const RULES = fs.readFileSync(
  path.resolve(__dirname, '../firestore/firestore.g4.emulator.rules'),
  'utf8',
);

let environment;

test.before(async () => {
  environment = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: RULES },
  });
});

test.beforeEach(async () => {
  await environment.clearFirestore();
});

test.after(async () => {
  await environment.cleanup();
});

function operatorDb() {
  return environment.authenticatedContext('run004-operator', {
    datascoutG4Operator: true,
  }).firestore();
}

function nonOperatorDb() {
  return environment.authenticatedContext('ordinary-user', {
    datascoutG4Operator: false,
  }).firestore();
}

function runControl(overrides = {}) {
  return {
    run_id: 'DS-S2M-004',
    external_actions_enabled: false,
    spending_authority_cents: 0,
    mode: 'firestore-emulator',
    ...overrides,
  };
}

function lockedRecord(overrides = {}) {
  return {
    run_id: 'DS-S2M-004',
    external_actions: 0,
    spending_cents: 0,
    status: 'Accepted',
    ...overrides,
  };
}

test('operator can create and read the locked Run 004 control record', async () => {
  const ref = doc(operatorDb(), 'g4Runs/DS-S2M-004');
  await assertSucceeds(setDoc(ref, runControl()));
  const snapshot = await assertSucceeds(getDoc(ref));
  assert.equal(snapshot.data().external_actions_enabled, false);
});

test('unauthenticated and non-operator users cannot read or write Run 004', async () => {
  const unauthenticated = environment.unauthenticatedContext().firestore();
  await assertFails(setDoc(doc(unauthenticated, 'g4Runs/DS-S2M-004'), runControl()));
  await assertFails(getDoc(doc(unauthenticated, 'g4Runs/DS-S2M-004')));
  await assertFails(setDoc(doc(nonOperatorDb(), 'g4Runs/DS-S2M-004'), runControl()));
});

test('wrong run IDs and authority expansion are denied', async () => {
  await assertFails(setDoc(doc(operatorDb(), 'g4Runs/OTHER-RUN'), runControl({ run_id: 'OTHER-RUN' })));
  await assertFails(
    setDoc(doc(operatorDb(), 'g4Runs/DS-S2M-004'), runControl({ external_actions_enabled: true })),
  );
  await assertFails(
    setDoc(doc(operatorDb(), 'g4Runs/DS-S2M-004'), runControl({ spending_authority_cents: 1 })),
  );
});

test('operator can write only locked records to approved Run 004 buckets', async () => {
  await assertSucceeds(
    setDoc(doc(operatorDb(), 'g4Runs/DS-S2M-004/results/result-1'), lockedRecord()),
  );
  await assertFails(
    setDoc(
      doc(operatorDb(), 'g4Runs/DS-S2M-004/results/result-2'),
      lockedRecord({ external_actions: 1 }),
    ),
  );
  await assertFails(
    setDoc(
      doc(operatorDb(), 'g4Runs/DS-S2M-004/results/result-3'),
      lockedRecord({ spending_cents: 1 }),
    ),
  );
  await assertFails(
    setDoc(doc(operatorDb(), 'g4Runs/DS-S2M-004/unapproved/record-1'), lockedRecord()),
  );
});

test('delete is denied even to the operator', async () => {
  const ref = doc(operatorDb(), 'g4Runs/DS-S2M-004');
  await assertSucceeds(setDoc(ref, runControl()));
  await assertFails(deleteDoc(ref));
});

test('evidence is operator-gated and authority-locked', async () => {
  const allowed = doc(operatorDb(), 'g4Evidence/evidence-1');
  await assertSucceeds(setDoc(allowed, lockedRecord()));
  await assertSucceeds(getDoc(allowed));
  await assertFails(
    setDoc(doc(nonOperatorDb(), 'g4Evidence/evidence-2'), lockedRecord()),
  );
  await assertFails(
    setDoc(
      doc(operatorDb(), 'g4Evidence/evidence-3'),
      lockedRecord({ spending_cents: 1 }),
    ),
  );
  await assertFails(deleteDoc(allowed));
});

test('legacy DataScout collections remain default-denied', async () => {
  const product = doc(operatorDb(), 'products/product-1');
  await assertFails(setDoc(product, { title: 'synthetic' }));
  await assertFails(getDoc(product));
});
