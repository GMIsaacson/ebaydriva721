const setups=[
['S001','Failed News Breakdown','Bad-news gap + failed rebound/VWAP reclaim + confirming rates/breadth.','0–2 DTE'],
['S002','Failed News Reversal','Bad news is absorbed; opening extreme holds and VWAP is reclaimed.','0–2 DTE'],
['S003','Opening Range Break / Retest','Opening-range break, controlled retest, then continuation confirmation.','0–3 DTE'],
['S004','VWAP + Rates Confirmation','Directional VWAP interaction aligned with Treasury impulse and breadth.','0–5 DTE'],
['S005','Range Mean Reversion','Non-event, contained-volatility range only; fade a validated statistical stretch.','1–5 DTE']
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
['Dataset & provenance','Build timestamped, replayable market/event/options observations.'],
['Cost model','Model bid/ask, slippage, latency, fees and no-fill behavior.'],
['Pre-registered hypotheses','Freeze rules and minimum sample sizes before inspecting results.'],
['Out-of-sample testing','Time-split / walk-forward with no look-ahead leakage.'],
['Regime robustness','Verify expectancy across event, trend, range and volatility regimes.'],
['Paper shadow qualification','Timestamp decisions before outcomes; compare simulated fills to observable market.'],
['Independent Q1/Q2/Q3','All three gates must PASS before any request for live authority.']
];

document.querySelectorAll('.nav').forEach(b=>b.onclick=()=>{document.querySelectorAll('.nav,.view').forEach(x=>x.classList.remove('active'));b.classList.add('active');document.getElementById(b.dataset.tab).classList.add('active')});

document.getElementById('setupCards').innerHTML=setups.map(s=>`<article><small>${s[0]} · ${s[3]}</small><h3>${s[1]}</h3><p>${s[2]}</p></article>`).join('');
document.getElementById('teamCards').innerHTML=team.map(t=>`<article><small>PROFESSIONAL DISCIPLINE</small><h3>${t[0]}</h3><p>${t[1]}</p></article>`).join('');
document.getElementById('vetoList').innerHTML=vetoes.map(v=>`<div>VETO · ${v}</div>`).join('');
document.getElementById('milestones').innerHTML=milestones.map((m,i)=>`<article><span class="num">${i+1}</span><div><b>${m[0]}</b><p>${m[1]}</p></div><span class="state">REQUIRED</span></article>`).join('');

function scoreDemo(){
  const result={score:100,riskGate:'PASS',outcome:'PAPER_CANDIDATE'};
  document.getElementById('scoreText').textContent=result.score;
  document.getElementById('riskText').textContent=result.riskGate;
  const tag=document.getElementById('decisionTag');tag.textContent='PAPER CANDIDATE';tag.className='tag pass';
  document.getElementById('queueBody').innerHTML=`<tr><td>S001 Failed News Breakdown</td><td>Deterministic gate complete</td><td>${result.score}/100</td><td>${result.riskGate}</td><td>${result.outcome}</td></tr>`;
  document.getElementById('scoreBtn').textContent='Paper gate passed · no order routed';
}
document.getElementById('scoreBtn').onclick=scoreDemo;
