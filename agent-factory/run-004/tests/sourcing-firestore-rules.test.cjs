'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { assertFails, assertSucceeds, initializeTestEnvironment } = require('@firebase/rules-unit-testing');
const { deleteDoc, doc, getDoc, setDoc, updateDoc } = require('firebase/firestore');

const PROJECT_ID = 'demo-datascout-sourcing';
const RULES = fs.readFileSync(path.resolve(__dirname, '../firestore/firestore.sourcing.emulator.rules'), 'utf8');
let environment;

test.before(async () => {
  environment = await initializeTestEnvironment({ projectId: PROJECT_ID, firestore: { rules: RULES } });
});

test.beforeEach(async () => {
  await environment.clearFirestore();
});

test.after(async () => {
  await environment.cleanup();
});

function ownerDb(uid = 'owner-1') {
  return environment.authenticatedContext(uid, { datascoutSourcingOperator: true }).firestore();
}

function ordinaryDb(uid = 'ordinary-1') {
  return environment.authenticatedContext(uid, { datascoutSourcingOperator: false }).firestore();
}

function runRecord(uid = 'owner-1', overrides = {}) {
  return {
    run_id: 'DS-S2M-004',
    owner_uid: uid,
    external_actions: 0,
    spending_cents: 0,
    status: 'PRESCREENED',
    dataset_hash: 'abc123',
    file_name: 'authorized.csv',
    input_count: 600,
    accepted_count: 600,
    verification_count: 50,
    deferred_count: 550,
    review_count: 0,
    rejected_count: 0,
    created_at: '2026-08-18T03:00:00Z',
    updated_at: '2026-08-18T03:00:00Z',
    ...overrides,
  };
}

function candidateRecord(uid = 'owner-1', overrides = {}) {
  return {
    run_id: 'DS-S2M-004',
    owner_uid: uid,
    external_actions: 0,
    spending_cents: 0,
    candidate_id: 'DSC-aaaaaaaaaaaaaaaaaaaa',
    stage: 'VERIFY',
    title: 'Demo Part',
    supplier: 'Authorized Supplier',
    source_cost_cents: 1200,
    moq: 1,
    identity_confidence: 'HIGH',
    source_access_class: 'GREEN',
    prescreen_score: 91,
    updated_at: '2026-08-18T03:05:00Z',
    ...overrides,
  };
}

function verificationRecord(uid = 'owner-1', overrides = {}) {
  return {
    run_id: 'DS-S2M-004',
    owner_uid: uid,
    external_actions: 0,
    spending_cents: 0,
    candidate_id: 'DSC-aaaaaaaaaaaaaaaaaaaa',
    marketplace: 'ebay-us',
    manual_only: true,
    marketplace_fetches: 0,
    status: 'VERIFIED',
    evidence_ref: 'manual://product-research-check',
    verified_at: '2026-08-18T03:10:00Z',
    units_sold: 30,
    avg_sold_price_cents: 5995,
    sold_per_30_days: 10,
    updated_at: '2026-08-18T03:10:00Z',
    ...overrides,
  };
}

function decisionRecord(uid = 'owner-1', overrides = {}) {
  return {
    run_id: 'DS-S2M-004',
    owner_uid: uid,
    external_actions: 0,
    spending_cents: 0,
    candidate_id: 'DSC-aaaaaaaaaaaaaaaaaaaa',
    status: 'COMPLETE',
    decision: 'BUY',
    formula_version: 'datascout-landed-economics/1.0.0',
    input_hash: 'feedbeef',
    net_profit_cents: 3974,
    roi_bps: 13628,
    margin_bps: 5768,
    sold_per_30_days: 10,
    marketplace_fetches: 0,
    updated_at: '2026-08-18T03:15:00Z',
    ...overrides,
  };
}

async function createRun(db = ownerDb(), id = 'run-1', record = runRecord()) {
  await assertSucceeds(setDoc(doc(db, `sourcingRuns/${id}`), record));
}

test('authorized sourcing operator can create/read only their locked run', async () => {
  const db = ownerDb();
  await createRun(db);
  const snapshot = await assertSucceeds(getDoc(doc(db, 'sourcingRuns/run-1')));
  assert.equal(snapshot.data().owner_uid, 'owner-1');
  assert.equal(snapshot.data().external_actions, 0);
});

test('unauthenticated, ordinary, and cross-owner access are denied', async () => {
  const owner = ownerDb();
  await createRun(owner);
  const unauthenticated = environment.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(unauthenticated, 'sourcingRuns/run-1')));
  await assertFails(setDoc(doc(ordinaryDb(), 'sourcingRuns/run-2'), runRecord('ordinary-1')));
  await assertFails(getDoc(doc(ownerDb('owner-2'), 'sourcingRuns/run-1')));
});

test('wrong run id, owner spoofing, authority expansion, extra action fields, and deletes are denied', async () => {
  const db = ownerDb();
  await assertFails(setDoc(doc(db, 'sourcingRuns/wrong'), runRecord('owner-1', { run_id: 'OTHER' })));
  await assertFails(setDoc(doc(db, 'sourcingRuns/spoof'), runRecord('owner-2')));
  await assertFails(setDoc(doc(db, 'sourcingRuns/action'), runRecord('owner-1', { external_actions: 1 })));
  await assertFails(setDoc(doc(db, 'sourcingRuns/spend'), runRecord('owner-1', { spending_cents: 1 })));
  await assertFails(setDoc(doc(db, 'sourcingRuns/extra'), { ...runRecord(), purchase_authorized: true }));
  await createRun(db);
  await assertFails(deleteDoc(doc(db, 'sourcingRuns/run-1')));
});

test('run identity and dataset hash are immutable on update', async () => {
  const db = ownerDb();
  await createRun(db);
  await assertSucceeds(updateDoc(doc(db, 'sourcingRuns/run-1'), { status: 'VERIFYING', updated_at: '2026-08-18T03:10:00Z' }));
  await assertFails(updateDoc(doc(db, 'sourcingRuns/run-1'), { dataset_hash: 'changed' }));
  await assertFails(updateDoc(doc(db, 'sourcingRuns/run-1'), { owner_uid: 'owner-2' }));
});

test('candidate writes require GREEN source access, matching document id, and locked authority', async () => {
  const db = ownerDb();
  await createRun(db);
  const ref = doc(db, 'sourcingRuns/run-1/candidates/DSC-aaaaaaaaaaaaaaaaaaaa');
  await assertSucceeds(setDoc(ref, candidateRecord()));
  await assertSucceeds(getDoc(ref));
  await assertFails(setDoc(doc(db, 'sourcingRuns/run-1/candidates/other'), candidateRecord()));
  await assertFails(setDoc(ref, candidateRecord('owner-1', { source_access_class: 'YELLOW' })));
  await assertFails(setDoc(ref, candidateRecord('owner-1', { external_actions: 1 })));
  await assertFails(deleteDoc(ref));
});

test('verification records are manual-only and cannot claim automated marketplace retrieval', async () => {
  const db = ownerDb();
  await createRun(db);
  const ref = doc(db, 'sourcingRuns/run-1/verifications/DSC-aaaaaaaaaaaaaaaaaaaa');
  await assertSucceeds(setDoc(ref, verificationRecord()));
  await assertFails(setDoc(ref, verificationRecord('owner-1', { manual_only: false })));
  await assertFails(setDoc(ref, verificationRecord('owner-1', { marketplace_fetches: 1 })));
  await assertFails(setDoc(ref, { ...verificationRecord(), ebay_session_cookie: 'forbidden' }));
  await assertFails(deleteDoc(ref));
});

test('decision records accept only complete BUY/WATCH/REJECT output from the locked economics version', async () => {
  const db = ownerDb();
  await createRun(db);
  const ref = doc(db, 'sourcingRuns/run-1/decisions/DSC-aaaaaaaaaaaaaaaaaaaa');
  await assertSucceeds(setDoc(ref, decisionRecord()));
  await assertSucceeds(setDoc(ref, decisionRecord('owner-1', { decision: 'WATCH' })));
  await assertFails(setDoc(ref, decisionRecord('owner-1', { decision: 'PURCHASE' })));
  await assertFails(setDoc(ref, decisionRecord('owner-1', { formula_version: 'other' })));
  await assertFails(setDoc(ref, decisionRecord('owner-1', { marketplace_fetches: 1 })));
  await assertFails(setDoc(ref, { ...decisionRecord(), purchase_authorized: true }));
  await assertFails(deleteDoc(ref));
});

test('legacy DataScout collections remain denied by the isolated sourcing rules', async () => {
  const db = ownerDb();
  await assertFails(setDoc(doc(db, 'products/legacy-product'), { title: 'legacy' }));
  await assertFails(getDoc(doc(db, 'products/legacy-product')));
});
