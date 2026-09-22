const test = require('node:test');
const assert = require('node:assert/strict');
const {
  AMAZON_MIN_MONTHLY_DEMAND_LOWER_BOUND,
  parseAmazonBoughtPastMonthLowerBound,
  qualifyAmazonMonthlyDemand,
  normalizeDemandValidationWithSnapshots,
  normalizeLandedCostFastKill,
} = require('../runtime/amazon-leaf-worker-executor-v2.cjs');

const evidence = (url) => ({
  state:'OBSERVED',
  sourceUrl:url,
  observedAt:'2026-09-22T08:00:00Z',
  claim:'Exact public evidence.',
  policyVersion:null,
});

test('strict Amazon demand gate uses only bought-in-past-month lower bounds', () => {
  assert.equal(AMAZON_MIN_MONTHLY_DEMAND_LOWER_BOUND,25);
  assert.equal(parseAmazonBoughtPastMonthLowerBound('3K+ bought in past month'),3000);
  assert.equal(parseAmazonBoughtPastMonthLowerBound('rating 4.8 from 2,586 ratings'),null);
  assert.equal(qualifyAmazonMonthlyDemand('10+ bought in past month').disposition,'rejected');
  assert.equal(qualifyAmazonMonthlyDemand(null).disposition,'blocked');

  const raw={
    outcome:'PASS',summary:'model',blockers:[],coverage:'not_applicable',evidence:[],
    candidates:[
      {asin:'B000000001',disposition:'continue',reason:'',demandSignal:''},
      {asin:'B000000002',disposition:'continue',reason:'',demandSignal:''},
      {asin:'B000000003',disposition:'continue',reason:'',demandSignal:''},
    ],
  };
  const snapshots=[
    {asin:'B000000001',ok:true,boughtPastMonth:'50+ bought in past month',rating:'4.5',ratingsCount:'20'},
    {asin:'B000000002',ok:true,boughtPastMonth:'10+ bought in past month',rating:'4.8',ratingsCount:'2000'},
    {asin:'B000000003',ok:true,boughtPastMonth:'',rating:'4.9',ratingsCount:'9000'},
  ];
  const out=normalizeDemandValidationWithSnapshots(raw,snapshots);
  assert.equal(out.outcome,'PASS');
  assert.deepEqual(out.candidates.map((x)=>x.disposition),['continue','rejected','blocked']);
});

test('landed-cost fast kill terminates mathematically impossible route before fee research', () => {
  const amazon='https://www.amazon.com/dp/B0CBJZNDN4';
  const source='https://www.walmart.com/ip/19324114530';
  const prior=[{
    commandId:'WC-PRIOR',
    stageResult:{
      evidence:[{url:amazon},{url:source}],
      candidates:[{asin:'B0CBJZNDN4',disposition:'continue'}],
    },
  }];
  const raw={
    outcome:'PASS',
    summary:'One candidate has landed cost.',
    blockers:[],
    evidence:[{url:amazon},{url:source}],
    candidates:[{
      asin:'B0CBJZNDN4',
      disposition:'continue',
      reason:'continue',
      economicsInputs:null,
      economicsEvidence:{
        schemaVersion:'amazon-economics-evidence/1.0.0',
        marketplace:'amazon-us',
        asin:'B0CBJZNDN4',
        sale:{amountCents:698,evidence:evidence(amazon)},
        sourceCost:{amountCents:1745,evidence:evidence(source)},
        inboundFreight:{amountCents:0,evidence:evidence(source)},
        fulfillmentMode:'UNRESOLVED',
        sellingPlan:'UNRESOLVED',
        feeCategory:null,
        referralFeeBasis:null,
        otherMarketplaceFees:null,
        packageFacts:null,
        fbaFulfillment:null,
        fbmOutboundShipping:null,
        packaging:null,
        riskReserve:null,
      },
    }],
  };
  const out=normalizeLandedCostFastKill(raw,prior);
  assert.equal(out.candidates[0].disposition,'rejected');
  assert.match(out.candidates[0].reason,/PRE_FEE_FAST_KILL/);
  assert.match(out.candidates[0].reason,/-1047 cents/);
  assert.equal(out.outcome,'REJECTED');
});

test('source cost alone exceeds Amazon sale and kills even when inbound shipping is unresolved', () => {
  const amazon='https://www.amazon.com/dp/B0FK2BSZW1';
  const source='https://www.lowes.com/pd/example';
  const prior=[{
    commandId:'WC-SOURCE',
    stageResult:{
      evidence:[{url:amazon},{url:source}],
      candidates:[{asin:'B0FK2BSZW1',disposition:'continue'}],
    },
  }];
  const raw={
    outcome:'PASS',
    summary:'landed',
    blockers:[],
    evidence:[{url:source}],
    candidates:[{
      asin:'B0FK2BSZW1',
      disposition:'blocked',
      reason:'shipping unresolved',
      economicsInputs:null,
      economicsEvidence:{
        schemaVersion:'amazon-economics-evidence/1.0.0',
        marketplace:'amazon-us',
        asin:'B0FK2BSZW1',
        sale:null,
        sourceCost:{amountCents:6748,evidence:evidence(source)},
        inboundFreight:null,
        fulfillmentMode:'UNRESOLVED',
        sellingPlan:'UNRESOLVED',
        feeCategory:null,
        referralFeeBasis:null,
        otherMarketplaceFees:null,
        packageFacts:null,
        fbaFulfillment:null,
        fbmOutboundShipping:null,
        packaging:null,
        riskReserve:null,
      },
    }],
  };
  const snapshots=[{asin:'B0FK2BSZW1',ok:true,url:amazon,displayedPrice:'$6.69'}];
  const out=normalizeLandedCostFastKill(raw,prior,snapshots);
  assert.equal(out.candidates[0].disposition,'rejected');
  assert.match(out.candidates[0].reason,/-6079 cents/);
  assert.equal(out.candidates[0].economicsEvidence.sale.amountCents,669);
});


test('terminal candidate omission is reconciled without losing audit rows', () => {
  const prior=[{
    stageResult:{candidates:[
      {asin:'B000000001',disposition:'continue',reason:'active'},
      {asin:'B000000002',disposition:'blocked',reason:'terminal blocker'},
    ]},
  }];
  const raw={candidates:[
    {asin:'B000000001',disposition:'continue',reason:'active next'},
  ]};
  const out=require('../runtime/amazon-leaf-worker-executor-v2.cjs').reconcileCandidateRows(raw,prior);
  assert.deepEqual(out.candidates.map((x)=>x.asin),['B000000001','B000000002']);
  assert.equal(out.candidates[1].disposition,'blocked');
  assert.equal(out.candidates[1].reason,'terminal blocker');
});

test('active candidate omission remains fail-closed', () => {
  const prior=[{
    stageResult:{candidates:[
      {asin:'B000000001',disposition:'continue',reason:'active'},
      {asin:'B000000002',disposition:'continue',reason:'also active'},
    ]},
  }];
  const raw={candidates:[{asin:'B000000001',disposition:'continue',reason:'active next'}]};
  assert.throws(
    ()=>require('../runtime/amazon-leaf-worker-executor-v2.cjs').reconcileCandidateRows(raw,prior),
    /AMAZON_LEAF_ACTIVE_CANDIDATE_DROPPED/
  );
});

test('unexpected candidate remains fail-closed', () => {
  const prior=[{
    stageResult:{candidates:[{asin:'B000000001',disposition:'continue',reason:'active'}]},
  }];
  const raw={candidates:[{asin:'B999999999',disposition:'continue',reason:'unexpected'}]};
  assert.throws(
    ()=>require('../runtime/amazon-leaf-worker-executor-v2.cjs').reconcileCandidateRows(raw,prior),
    /AMAZON_LEAF_UNEXPECTED_CANDIDATE/
  );
});
