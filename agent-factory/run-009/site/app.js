const state={projects:[],filtered:[]};
const $=s=>document.querySelector(s);
const money=v=>v==null?'Value not published':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(v);
const pretty=s=>String(s||'').replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());
const slug=s=>String(s||'').normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')||'unknown';
const projectPath=p=>`/projects/${slug(p.id||p.name)}/`;

function telemetry(event,{path=location.pathname,objectId}={}){
  const payload={event,path};
  if(objectId) payload.objectId=objectId;
  fetch('/api/telemetry',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload),keepalive:true}).catch(()=>{});
}

async function load(){
  const res=await fetch('./data/projects.json',{cache:'no-store'});
  if(!res.ok) throw new Error('project_data_unavailable');
  const payload=await res.json();
  state.projects=payload.projects||[];
  $('#projectCount').textContent=state.projects.length;
  hydrateFilters();
  applyFilters();
  telemetry('PAGE_VIEW');
}

function hydrateFilters(){
  const cities=[...new Set(state.projects.map(p=>p.municipality))].sort();
  const stages=[...new Set(state.projects.map(p=>p.stage))].sort();
  cities.forEach(v=>$('#city').add(new Option(v,v)));
  stages.forEach(v=>$('#stage').add(new Option(pretty(v),v)));
}

function applyFilters(){
  const q=$('#q').value.trim().toLowerCase();
  const city=$('#city').value;
  const stage=$('#stage').value;
  state.filtered=state.projects.filter(p=>{
    const hay=[p.name,p.location,p.projectType,p.signal,p.municipality,p.stage].join(' ').toLowerCase();
    return(!q||hay.includes(q))&&(!city||p.municipality===city)&&(!stage||p.stage===stage);
  });
  render();
}

function render(){
  $('#resultCount').textContent=`${state.filtered.length} result${state.filtered.length===1?'':'s'}`;
  const grid=$('#projectGrid');
  grid.innerHTML='';
  if(!state.filtered.length){grid.innerHTML='<p>No project signals match these filters.</p>';return;}
  state.filtered.forEach(p=>{
    const card=document.createElement('article');
    card.className='project-card';card.tabIndex=0;
    card.innerHTML=`<div class="project-meta"><span class="chip">${p.municipality}</span><span class="chip">${pretty(p.stage)}</span><span class="chip">${pretty(p.projectType)}</span></div><h3><a href="${projectPath(p)}">${p.name}</a></h3><p>${p.location} · ${money(p.estimatedValue)}</p><button class="detail-trigger" type="button">Quick details</button>`;
    card.addEventListener('click',e=>{if(!e.target.closest('a,button'))showDetail(p)});
    card.querySelector('.detail-trigger').addEventListener('click',()=>showDetail(p));
    card.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&!e.target.closest('a,button'))showDetail(p)});
    grid.appendChild(card);
  });
}

function showDetail(p){
  telemetry('PROJECT_DETAIL_OPEN',{objectId:slug(p.id||p.name)});
  $('#detailBody').innerHTML=`<p class="eyebrow">${p.municipality} · ${pretty(p.stage)}</p><h2>${p.name}</h2><p>${p.signal}</p><div class="detail-grid"><div class="detail-box"><strong>Location</strong><br>${p.location}</div><div class="detail-box"><strong>Type</strong><br>${pretty(p.projectType)}</div><div class="detail-box"><strong>Estimated value</strong><br>${money(p.estimatedValue)}</div><div class="detail-box"><strong>Confidence</strong><br>${Math.round(p.confidence*100)}%</div></div><p><a href="${projectPath(p)}">Open permanent project page</a></p><p><strong>Freshness:</strong> ${p.freshness} · last Run 009 verification ${p.lastVerified}</p><p><strong>Authoritative source:</strong><br><a class="source-link" href="${p.sourceUrl}" target="_blank" rel="noopener noreferrer">${p.sourceLabel}</a></p><p class="fine">Verify current status at the authoritative source before acting.</p>`;
  $('#detailDialog').showModal();
}

function saveInterest(kind,extra={}){
  const record={kind,createdAt:new Date().toISOString(),...extra};
  const existing=JSON.parse(localStorage.getItem('run009_interest')||'[]');
  existing.push(record);
  localStorage.setItem('run009_interest',JSON.stringify(existing.slice(-20)));
}

$('#q').addEventListener('input',applyFilters);
$('#city').addEventListener('change',applyFilters);
$('#stage').addEventListener('change',applyFilters);
$('#closeDialog').addEventListener('click',()=>$('#detailDialog').close());
$('#alertForm').addEventListener('submit',e=>{
  e.preventDefault();
  saveInterest('ALERT_INTEREST',{email:$('#email').value.trim(),minValue:Number($('#minValue').value)});
  telemetry('ALERT_INTEREST');
  $('#alertStatus').textContent='Saved on this device. No email has been sent.';
  e.target.reset();
});
$('#upgrade').addEventListener('click',()=>{
  saveInterest('PAID_PLAN_INTEREST',{priceHypothesis:79});
  telemetry('PREMIUM_INTEREST');
  $('#upgrade').textContent='Interest saved — checkout not active';
  $('#upgrade').disabled=true;
});
load().catch(()=>{$('#projectGrid').innerHTML='<p>Project data could not be loaded. Please retry later.</p>'});