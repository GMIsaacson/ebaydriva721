const setups=[
{code:'S001',name:'Failed News Breakdown',desc:'Bad-news gap + failed rebound/VWAP reclaim + confirming rates/breadth.',dte:'0–2 DTE',status:'AWAITING FULL DATA'},
{code:'S002',name:'Failed News Reversal',desc:'Bad news is absorbed; opening extreme holds and VWAP is reclaimed.',dte:'0–2 DTE',status:'AWAITING FULL DATA'},
{code:'S003',name:'Opening Range Break / Retest',desc:'Frozen v1 failed the real SPY directional bootstrap and is closed. A materially different hypothesis must become v2 before testing.',dte:'0–3 DTE',status:'KILLED · 2026-09-10'},
{code:'S004',name:'VWAP + Rates Confirmation',desc:'Directional VWAP interaction aligned with Treasury impulse and breadth.',dte:'0–5 DTE',status:'AWAITING FULL DATA'},
{code:'S005',name:'Range Mean Reversion',desc:'Non-event, contained-volatility range only; fade a validated statistical stretch.',dte:'1–5 DTE',status:'AWAITING FULL DATA'}
];
const team=[
['Macro & Event Analyst','Separates released facts from the market reaction and classifies event regime.'],
['Index Market Structure Analyst','VWAP, opening range, breadth, volume, relative strength and acceptance/rejection.'],
['Quant Research & Statistics','Pre-registers hypotheses; prevents leakage; measures OOS expectancy, uncertainty and robustness.'],
['Index Options Strategist','Compares 0–5 DTE defined-risk structures using liquidity, IV, Greeks and execution assumptions.'],
['Independent Risk Officer','Unconditional veto authority; cannot be overridden by the signal engine.'],
['Paper Execution Simulator','Timestamped simulated fills with spread, slippage, latency and no-fill assumptions.'],
['Q1 / Q2 / Q3 QA','Operational, evidence/compliance and professional-excellence gates stay independent.'],
['Research Store','Keeps accepted and rejected candidates, context, MAE/MFE, outcome and provenance.']
];
const vetoes=['Live routing requested','Unsupported underlying','DTE outside 0–5','Undefined-risk structure','Missing invalidation','Missing exit plan','Candidate max loss over paper limit','Stale market data','Late 0DTE entry after 15:30 ET','Setup not in versioned library'];
const milestones=[
['Dataset & provenance','Real SPY 5-minute bootstrap acquisition is working. Full event/rates/breadth/options history remains to be connected.','IN PROGRESS'],
['Transaction-cost engine','NBBO and aggregate-bar execution modes now model spread penalties, slippage, stale quotes and per-leg fees.','BUILT'],
['Pre-registered hypotheses','Chronological 60/20/20 split plus kill and promotion rules were frozen before the first replay result.','FROZEN'],
['Out-of-sample testing','S003 v1 completed its first holdout and failed: −0.149R average, profit factor 0.784.','STARTED'],
['Research-grade options feed','Cloud adapter for Massive is built; historical NBBO or comparable execution data must be connected for serious options P&L.','EXTERNAL DATA'],
['Regime robustness','Surviving setups must clear event, trend, range and volatility slices without one regime carrying the edge.','REQUIRED'],
['Paper shadow qualification','Timestamp decisions before outcomes and compare simulated fills with observable market quotes.','BLOCKED'],
['Independent Q1/Q2/Q3','All three gates must PASS before any request for live authority.','REQUIRED']
];
const queue=[
['S001 Failed News Breakdown','AWAITING FULL DATA','No verdict yet','LOCKED','Event + options replay'],
['S002 Failed News Reversal','AWAITING FULL DATA','No verdict yet','LOCKED','Event + options replay'],
['S003 Opening Range Break / Retest','KILLED v1','50 episodes · −0.108R overall','LOCKED','Closed; no tuning'],
['S004 VWAP + Rates Confirmation','AWAITING FULL DATA','No verdict yet','LOCKED','Rates + options replay'],
['S005 Range Mean Reversion','AWAITING FULL DATA','No verdict yet','LOCKED','Regime + options replay']
];

document.querySelectorAll('.nav').forEach(b=>b.onclick=()=>{document.querySelectorAll('.nav,.view').forEach(x=>x.classList.remove('active'));b.classList.add('active');document.getElementById(b.dataset.tab).classList.add('active')});

document.getElementById('setupCards').innerHTML=setups.map(s=>`<article><small>${s.code} · ${s.dte}</small><h3>${s.name}</h3><p>${s.desc}</p><small>${s.status}</small></article>`).join('');
document.getElementById('teamCards').innerHTML=team.map(t=>`<article><small>PROFESSIONAL DISCIPLINE</small><h3>${t[0]}</h3><p>${t[1]}</p></article>`).join('');
document.getElementById('vetoList').innerHTML=vetoes.map(v=>`<div>VETO · ${v}</div>`).join('');
document.getElementById('milestones').innerHTML=milestones.map((m,i)=>`<article><span class="num">${i+1}</span><div><b>${m[0]}</b><p>${m[1]}</p></div><span class="state">${m[2]}</span></article>`).join('');
document.getElementById('queueBody').innerHTML=queue.map(r=>`<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td><td>${r[4]}</td></tr>`).join('');

function scoreDemo(){
  const result={score:100,riskGate:'PASS',outcome:'PAPER_CANDIDATE'};
  const tag=document.getElementById('decisionTag');
  tag.textContent='SYNTHETIC PASS';
  tag.className='tag pass';
  document.getElementById('scoreBtn').textContent='Synthetic gate passed · no order routed';
  document.getElementById('scoreBtn').disabled=true;
}
document.getElementById('scoreBtn').onclick=scoreDemo;
