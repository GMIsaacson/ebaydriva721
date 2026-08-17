'use strict';
const assert = require('assert');
const { normalizeOpportunity, buildAuditDraft, telemetry, AUTHORITY } = require('../runtime/g4-seller-conversion-lab.cjs');

const base = {
  opportunityId:'KIN-TEST-001', marketplace:'Amazon US', productId:'B0TEST001', brand:'Demo Brand',
  listingUrl:'https://www.amazon.com/dp/B0TEST001', observedAt:'2026-08-16T00:00:00Z',
  evidence:[{claim:'Listing has fewer than five visible gallery images',source:'https://www.amazon.com/dp/B0TEST001',observedAt:'2026-08-16T00:00:00Z'}],
  score:84, reasons:['Weak gallery depth','No verified video evidence']
};

const opp = normalizeOpportunity(base);
assert.equal(opp.status,'QUALIFIED');
assert.equal(opp.externalActionAuthorized,false);
assert.equal(opp.authority,AUTHORITY);
assert.ok(opp.dedupeKey.length === 64);

const duplicate = normalizeOpportunity({...base, opportunityId:'KIN-TEST-002'});
assert.equal(opp.dedupeKey, duplicate.dedupeKey, 'duplicate identity must be deterministic');

const audit = buildAuditDraft(opp);
assert.equal(audit.eligible,true);
assert.equal(audit.ownerApprovalRequired,true);
assert.equal(audit.deliveryAuthorized,false);
assert.equal(audit.outboundAuthorized,false);

const t = telemetry(opp,audit);
assert.deepEqual([t.externalActions,t.paymentActions,t.clientDeliveries],[0,0,0]);

assert.throws(() => normalizeOpportunity({...base, marketplace:'eBay US'}), /MARKETPLACE_NOT_ALLOWED/);
assert.throws(() => normalizeOpportunity({...base, evidence:[]}), /MISSING_EVIDENCE/);
assert.equal(normalizeOpportunity({...base, score:60}).status,'WATCH');
assert.equal(normalizeOpportunity({...base, score:20}).status,'REJECTED');
assert.equal(buildAuditDraft(normalizeOpportunity({...base, score:60})).eligible,false);

console.log(JSON.stringify({unitId:'KIN-G4-ACCEPTANCE',status:'Pass',authority:AUTHORITY,externalActions:0,paymentActions:0,clientDeliveries:0,tests:10}));
