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

test('mixed rejected and blocked candidates normalize aggregate outcome to BLOCKED', () => {
  const worker=require('../runtime/amazon-leaf-worker-executor-v2.cjs');
  const raw={
    outcome:'REJECTED',
    summary:'No candidate may advance.',
    blockers:[],
    candidates:[
      {asin:'B000000001',disposition:'rejected'},
      {asin:'B000000002',disposition:'blocked'},
    ],
  };
  const out=worker.normalizeAggregateOutcome(raw);
  assert.equal(out.outcome,'BLOCKED');
  assert.match(out.summary,/normalized to BLOCKED/i);
  assert.ok(out.blockers.some((x)=>/evidence-blocked/i.test(x)));
});

test('aggregate REJECTED remains fail-closed when an active survivor exists', () => {
  const worker=require('../runtime/amazon-leaf-worker-executor-v2.cjs');
  const raw={
    outcome:'REJECTED',
    summary:'bad aggregate',
    blockers:[],
    candidates:[
      {asin:'B000000001',disposition:'rejected'},
      {asin:'B000000002',disposition:'continue'},
    ],
  };
  assert.throws(()=>worker.normalizeAggregateOutcome(raw),/AMAZON_LEAF_REJECTED_WITH_SURVIVORS/);
});

test('all rejected candidates may retain aggregate REJECTED', () => {
  const worker=require('../runtime/amazon-leaf-worker-executor-v2.cjs');
  const raw={
    outcome:'REJECTED',
    summary:'all rejected',
    blockers:[],
    candidates:[
      {asin:'B000000001',disposition:'rejected'},
      {asin:'B000000002',disposition:'rejected'},
    ],
  };
  assert.equal(worker.normalizeAggregateOutcome(raw).outcome,'REJECTED');
});

test('30-ASIN prescreen ranks high-demand, higher-value standardized candidates above low-price retail commodities', () => {
  const worker=require('../runtime/amazon-leaf-worker-executor-v2.cjs');
  assert.equal(worker.AMAZON_PRESCREEN_POOL_SIZE,30);
  assert.equal(worker.AMAZON_DEEP_RESEARCH_LIMIT,5);
  assert.equal(worker.AMAZON_PREFERRED_SOURCE_SHARE_BPS,4500);
  assert.equal(worker.AMAZON_SOURCE_CLASS_PRIORITY[0],'manufacturer_factory');
  assert.equal(worker.AMAZON_SOURCE_CLASS_PRIORITY.at(-1),'retail');

  const high=worker.scoreAmazonPrescreenSnapshot({
    asin:'B012345678',
    title:'304 Stainless Steel Clamp 2 in 20 Pack',
    displayedPrice:'$29.99',
    boughtPastMonth:'1K+ bought in past month',
    availability:'In Stock',
  });
  const low=worker.scoreAmazonPrescreenSnapshot({
    asin:'B007JSGNVQ',
    title:'Duck Brand Auto Electrical Tape 0.75 in x 60 ft 1 Roll',
    displayedPrice:'$1.48',
    boughtPastMonth:'5K+ bought in past month',
    availability:'In Stock',
  });
  assert.equal(high.eligibleForDeepResearch,true);
  assert.equal(low.eligibleForDeepResearch,true);
  assert.ok(high.score > low.score);
  assert.deepEqual(worker.calculateAmazonSourceTargets(2999),{
    salePriceCents:2999,
    minimumSupportedReferralFeeCents:360,
    absoluteSourceCostCeilingCents:2638,
    preferredSourceTargetCents:1349,
    preferredSourceShareBps:4500,
    policyVersion:'amazon-opportunity-prescreen/1.0.0',
  });
});

test('prescreen excludes missing demand and marketplace private label from deep research', () => {
  const worker=require('../runtime/amazon-leaf-worker-executor-v2.cjs');
  const noDemand=worker.scoreAmazonPrescreenSnapshot({
    asin:'B076Q7ZK19',
    title:'Stainless Steel Worm Gear Hose Clamp 60 Pieces',
    displayedPrice:'$16.99',
    boughtPastMonth:'',
    availability:'In Stock',
  });
  assert.equal(noDemand.eligibleForDeepResearch,false);
  assert.equal(noDemand.exclusionReason,'MONTHLY_DEMAND_UNVERIFIED');

  const amazonBasics=worker.scoreAmazonPrescreenSnapshot({
    asin:'B07YDRY8ZS',
    title:'Amazon Basics Electrical Tape 6 Pack',
    displayedPrice:'$15.61',
    boughtPastMonth:'1K+ bought in past month',
    availability:'In Stock',
  });
  assert.equal(amazonBasics.eligibleForDeepResearch,false);
  assert.equal(amazonBasics.exclusionReason,'MARKETPLACE_PRIVATE_LABEL');
});

test('ASIN_DISCOVERY accepts a deterministic top-five prescreen nomination only', () => {
  const worker=require('../runtime/amazon-leaf-worker-executor-v2.cjs');
  const command={
    instruction:'[AMAZON_LEAF_STAGE_V2] '+JSON.stringify({
      runId:'SM-AMZ-PRESCREEN-001',
      leafId:'256161011',
      leafName:'Electrical Tape',
      stage:'ASIN_DISCOVERY',
      specialist:'AGT-RESEARCH-VALIDATION-001',
      priorCommandIds:[],
      candidateAsins:['B007JSGNVQ','B002VKT22O'],
    }),
  };
  const payload=worker.parsePayload(command);
  assert.deepEqual(payload.candidateAsins,['B007JSGNVQ','B002VKT22O']);

  assert.throws(()=>worker.parsePayload({
    instruction:'[AMAZON_LEAF_STAGE_V2] '+JSON.stringify({
      runId:'SM-AMZ-PRESCREEN-002',
      leafId:'256161011',
      leafName:'Electrical Tape',
      stage:'SOURCING',
      specialist:'SPC-SOURCE-001',
      priorCommandIds:[],
      candidateAsins:['B007JSGNVQ'],
    }),
  }),/AMAZON_LEAF_CANDIDATE_ASINS_STAGE_INVALID/);
});

test('sourcing targets are derived deterministically from carried Amazon sale evidence', () => {
  const worker=require('../runtime/amazon-leaf-worker-executor-v2.cjs');
  const prior=[{
    stageResult:{candidates:[{
      asin:'B012345678',
      disposition:'continue',
      economicsEvidence:{
        sale:{amountCents:2999},
      },
    }]},
  }];
  const targets=worker.buildSourcingTargets(prior);
  assert.equal(targets.length,1);
  assert.equal(targets[0].preferredSourceTargetCents,1349);
  assert.equal(targets[0].absoluteSourceCostCeilingCents,2638);
});
