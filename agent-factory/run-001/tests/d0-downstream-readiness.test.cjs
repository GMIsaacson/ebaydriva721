'use strict';
const assert = require('assert');
const { buildHandoff, validateReceiver, idempotencyKey, AUTHORITY } = require('../runtime/d0-downstream-readiness.cjs');

const qualified = {
  opportunityId:'KIN-G5-004', productId:'B0CWVJ23ZT', brand:"Yogi's Gift", marketplace:'Amazon US',
  listingUrl:'https://www.amazon.com/dp/B0CWVJ23ZT', observedAt:'2026-08-16', status:'QUALIFIED',
  evidence:['https://www.amazon.com/dp/B0CWVJ23ZT','https://example.com/official-brand-evidence'],
  reasons:['Assortment quantity/use-case hierarchy remains an internal audit hypothesis pending direct listing verification.']
};

const h1 = buildHandoff(qualified);
const h2 = buildHandoff(qualified);
assert.equal(h1.version,'1.0');
assert.equal(h1.authority,AUTHORITY);
assert.equal(h1.externalActionAuthorized,false);
assert.equal(h1.paymentActionAuthorized,false);
assert.equal(h1.clientDeliveryAuthorized,false);
assert.equal(h1.recipientRole,'Pipeline and Reply Coordinator');
assert.equal(validateReceiver(h1).accepted,true);
assert.equal(idempotencyKey(h1),idempotencyKey(h2));
assert.equal(h1.handoffId,h2.handoffId);

const broken = {...h1, owner:''};
const rejected = validateReceiver(broken);
assert.equal(rejected.accepted,false);
assert.equal(rejected.disposition,'REMEDIATION_REQUIRED');
assert(rejected.missing.includes('owner'));

assert.throws(() => buildHandoff({...qualified,status:'WATCH'}), /NOT_QUALIFIED/);
assert.throws(() => buildHandoff({...qualified,evidence:[]}), /MISSING_evidence/);

console.log(JSON.stringify({unitId:'KIN-D0-DOWNSTREAM',status:'Pass',tests:14,receiver:'Pipeline and Reply Coordinator',durableDestination:'Notion / Run 001 D0 Acceptance Record',authority:AUTHORITY,externalActions:0,paymentActions:0,clientDeliveries:0,idempotency:'PASS',remediationPath:'PASS'}));
