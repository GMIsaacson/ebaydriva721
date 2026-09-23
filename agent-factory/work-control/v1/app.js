(() => {
  'use strict';

  const Core = window.WorkControlCore;
  const Api = window.WorkControlApi;
  const STORAGE_KEY = 'work-control-v1-offline-state';
  const FALLBACK = {
    connection: { connected: false, mode: 'OFFLINE_DRAFT', executor: 'DISCONNECTED', persistent: false },
    meta: { registryAsOf: null, recoveryBaseline: '37392d74728a44c3e502959c09e6400de40b846e' },
    teams: [
      { id: 'SUB-OPS-006', run: 'Run 006', name: 'Subscription Operations', icon: 'S', kind: 'reusable-team', runnable: true, readiness: 'Needs setup', live: 'Controlled / runtime inactive', authority: 'Approval-gated', capability: 'Discovers, verifies and monitors subscriptions, renewals, cost and usage.' },
      { id: 'OPP-011', run: 'Run 011', name: 'Opportunity Intelligence', icon: 'O', kind: 'reusable-team', runnable: true, readiness: 'Testing', live: 'Supervised calibration', authority: 'Internal analysis only', capability: 'Maps, compares and challenges revenue opportunities before resources are committed.' },
      { id: 'GROWTH-012', run: 'Run 012', name: 'Growth & Client Acquisition', icon: 'G', kind: 'reusable-team', runnable: true, readiness: 'Review', live: 'Record-backed', authority: 'Approval-gated', capability: 'Coordinates prospecting, acquisition workflows, evidence, delivery control and growth.' },
      { id: 'SW-PROD-014', run: 'Run 014', name: 'Software Product Engineering', icon: 'W', kind: 'reusable-team', runnable: true, readiness: 'Ready', live: 'Controlled Live', authority: 'Approval-gated', capability: 'Turns approved software briefs into tested, security-reviewed release candidates.' }
    ],
    work: [], approvals: [], history: []
  };

  let state = loadOfflineState();
  let workFilter = 'all';
  let currentView = 'overview';
  let refreshTimer = null;

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function loadOfflineState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      return saved ? { ...clone(FALLBACK), ...saved, connection: clone(FALLBACK.connection) } : clone(FALLBACK);
    } catch { return clone(FALLBACK); }
  }
  function saveOfflineState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ work: state.work, approvals: state.approvals, history: state.history }));
  }
  function esc(value) {
    return String(value ?? '').replace(/[&<>'"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[ch]));
  }
  function formatTime(iso) {
    try { return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(iso)); }
    catch { return iso; }
  }
  function teamById(id) { return state.teams.find((team) => team.id === id); }
  function statusLabel(status) { return String(status || 'unknown').replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase()); }
  function statusClass(status) { return ['running', 'completed', 'blocked', 'queued'].includes(status) ? `status-pill--${status}` : ''; }
  function badge(value) {
    const tone = value === 'Ready' ? 'badge--green' : /Needs setup|Testing|Completed pilot/.test(value || '') ? 'badge--amber' : '';
    return `<span class="badge ${tone}">${esc(value || 'Review')}</span>`;
  }
  function isApiConnected() { return state.connection?.connected === true; }

  function setConnectionUi() {
    const dot = document.getElementById('connection-dot');
    const title = document.getElementById('connection-title');
    const detail = document.getElementById('connection-detail');
    const persistence = document.getElementById('persistence-value');
    const registry = document.getElementById('registry-value');
    if (isApiConnected()) {
      dot.className = 'status-dot status-dot--green';
      title.textContent = 'Control API connected';
      detail.textContent = 'Persistent governed queue · executor waiting for a worker adapter.';
      persistence.textContent = 'Persistent server ledger';
      registry.textContent = state.meta?.registryAsOf ? `Factory snapshot · ${state.meta.registryAsOf.slice(0, 10)}` : 'Factory-backed snapshot';
    } else {
      dot.className = 'status-dot status-dot--amber';
      title.textContent = 'Offline safe mode';
      detail.textContent = 'Actions remain browser-local drafts; Factory dispatch is not claimed.';
      persistence.textContent = 'Browser-local drafts';
      registry.textContent = 'Fallback subset';
    }
  }

  async function refreshFromApi({ silent = false } = {}) {
    try {
      const apiState = await Api.state();
      state = apiState;
      setConnectionUi();
      render();
      if (!refreshTimer) refreshTimer = setInterval(() => refreshFromApi({ silent: true }), 10000);
      return true;
    } catch (error) {
      if (!silent) console.warn('Work Control API unavailable:', error.message);
      if (isApiConnected()) state = loadOfflineState();
      setConnectionUi();
      render();
      return false;
    }
  }

  function navigate(view) {
    currentView = view;
    document.querySelectorAll('.nav-item').forEach((button) => button.classList.toggle('is-active', button.dataset.view === view));
    document.querySelectorAll('[data-view-panel]').forEach((panel) => panel.classList.toggle('is-active', panel.dataset.viewPanel === view));
    const labels = { overview: ['Owner workspace', 'Overview'], teams: ['Digital workforce', 'Teams'], work: ['Assignments', 'Work'], approvals: ['Owner attention', 'Approvals'], history: ['Audit trail', 'History'] };
    document.getElementById('view-eyebrow').textContent = labels[view][0];
    document.getElementById('view-title').textContent = labels[view][1];
    render();
  }

  function render() {
    setConnectionUi();
    renderMetrics();
    renderOwnerAttention();
    renderOverviewWork();
    renderTeams();
    renderWork();
    renderApprovals();
    renderHistory();
  }

  function renderMetrics() {
    const summary = Core.summarize(state);
    const metrics = [
      ['Ready teams', summary.readyTeams, `${state.teams.length} registered runs`],
      ['Running', summary.running, 'assignments in execution'],
      ['Need you', summary.pendingApprovals + summary.blocked, 'approvals + blockers'],
      ['Completed', summary.completed, 'visible results']
    ];
    document.getElementById('metric-grid').innerHTML = metrics.map(([label, value, note]) => `<article class="metric-card"><span>${esc(label)}</span><strong>${value}</strong><small>${esc(note)}</small></article>`).join('');
  }

  function renderOwnerAttention() {
    const pending = state.approvals.filter((item) => item.status === 'pending').map((item) => ({ title: item.title, detail: `${item.environment} · ${formatSpend(item)} ceiling`, badge: 'Approval', view: 'approvals' }));
    const blocked = state.work.filter((item) => item.status === 'blocked').map((item) => ({ title: item.title, detail: item.next, badge: 'Blocked', view: 'work' }));
    const items = [...pending, ...blocked];
    document.getElementById('owner-attention').innerHTML = items.length ? items.map((item) => `<button class="attention-item" data-navigate="${item.view}"><span><strong>${esc(item.title)}</strong><span>${esc(item.detail)}</span></span><span class="badge ${item.badge === 'Approval' ? 'badge--amber' : 'badge--red'}">${esc(item.badge)}</span></button>`).join('') : '<div class="empty-state"><strong>Nothing needs you</strong>No owner intervention is currently recorded.</div>';
  }

  function workMarkup(work) {
    const team = teamById(work.teamId);
    const progress = Number.isFinite(work.progress) ? work.progress : Core.percentFromStages(work.stages);
    return `<article class="work-item" data-work-id="${esc(work.id)}" tabindex="0" role="button"><div class="work-title"><strong>${esc(work.title)}</strong><span>${esc(work.id)} · ${esc(work.priority || 'normal')} priority</span></div><div class="work-team">${esc(team?.name || work.teamName || 'Unknown team')}</div><div><span class="status-pill ${statusClass(work.status)}">${esc(statusLabel(work.status))}</span></div><div class="work-progress-wrap"><div class="work-next">${esc(work.next || '—')}</div><div class="work-progress"><i style="width:${Math.max(0, Math.min(100, progress))}%"></i></div></div><button class="quiet-button" type="button" data-work-open="${esc(work.id)}">Open</button></article>`;
  }

  function renderOverviewWork() {
    const visible = state.work.filter((item) => item.status !== 'completed').slice(0, 3);
    document.getElementById('overview-work').innerHTML = (visible.length ? visible : state.work.slice(0, 2)).map(workMarkup).join('') || '<div class="empty-state"><strong>No work yet</strong>Run a team to create a governed assignment.</div>';
  }

  function teamMarkup(team) {
    const disabled = team.runnable !== true;
    return `<article class="team-card"><div class="team-head"><div class="team-icon">${esc(team.icon || '?')}</div>${badge(team.readiness)}</div><h3>${esc(team.name)}</h3><div class="run-id">${esc(team.run)} · ${esc(team.kind || 'team')}</div><p>${esc(team.capability)}</p><div class="team-meta"><span>${esc(team.live || 'Unknown')}</span><span>${esc(team.authority || 'None')}</span></div><div class="team-actions"><button class="secondary-button" data-team-detail="${esc(team.id)}">Details</button><button class="primary-button" data-run-team="${esc(team.id)}" ${disabled ? 'disabled title="This run is not directly runnable"' : ''}>${disabled ? 'View only' : 'Run team'}</button></div></article>`;
  }

  function renderTeams() {
    const runnable = state.teams.filter((team) => team.runnable === true && team.readiness === 'Ready').slice(0, 4);
    document.getElementById('overview-teams').innerHTML = (runnable.length ? runnable : state.teams.filter((team) => team.runnable === true).slice(0, 4)).map(teamMarkup).join('');
    const query = (document.getElementById('team-search')?.value || '').toLowerCase().trim();
    const filtered = state.teams.filter((team) => !query || `${team.name} ${team.capability} ${team.run} ${team.kind}`.toLowerCase().includes(query));
    document.getElementById('teams-grid').innerHTML = filtered.map(teamMarkup).join('') || '<div class="empty-state"><strong>No teams found</strong>Try another search.</div>';
  }

  function renderWork() {
    const filtered = state.work.filter((item) => workFilter === 'all' || item.status === workFilter);
    document.getElementById('work-list').innerHTML = filtered.map(workMarkup).join('') || '<div class="empty-state"><strong>No work in this state</strong>Choose another filter or submit a team assignment.</div>';
  }

  function formatSpend(approval) {
    if (approval.spend) return approval.spend;
    return `$${(Number(approval.maxSpendCents || 0) / 100).toFixed(2)}`;
  }

  function formatActions(approval) { return approval.actions ?? approval.maxExternalActions ?? 0; }

  function renderApprovals() {
    const items = [...state.approvals].sort((a, b) => (a.status === 'pending' ? -1 : 1) - (b.status === 'pending' ? -1 : 1));
    document.getElementById('approvals-list').innerHTML = items.map((approval) => {
      const id = approval.approvalId || approval.id;
      return `<article class="approval-card"><div class="team-head"><span class="badge ${approval.status === 'pending' ? 'badge--amber' : approval.status === 'approved' ? 'badge--green' : 'badge--red'}">${esc(approval.status)}</span><span class="run-id">${esc(id)}</span></div><h3>${esc(approval.title)}</h3><p>${esc(approval.reason || '')}</p><div class="approval-facts"><div class="approval-fact"><span>Target</span><strong>${esc(approval.target)}</strong></div><div class="approval-fact"><span>Environment</span><strong>${esc(approval.environment)}</strong></div><div class="approval-fact"><span>External actions</span><strong>${esc(formatActions(approval))}</strong></div><div class="approval-fact"><span>Spend ceiling</span><strong>${esc(formatSpend(approval))}</strong></div><div class="approval-fact"><span>Production</span><strong>${approval.production === true || approval.production === 'Yes' ? 'Yes' : 'No'}</strong></div><div class="approval-fact"><span>Executor consumption</span><strong>${approval.transmitted === true ? 'Transmitted' : 'Disabled'}</strong></div></div>${approval.status === 'pending' ? `<div class="approval-actions"><button class="danger-button" data-approval="${esc(id)}" data-decision="rejected">Reject</button><button class="primary-button" data-approval="${esc(id)}" data-decision="approved">Approve</button></div>` : `<div class="approval-decision">Decision recorded: <strong>${esc(approval.status)}</strong>. Automatic executor consumption remains disabled.</div>`}</article>`;
    }).join('') || '<div class="empty-state"><strong>No pending approvals</strong>Teams will place bounded authority requests here when a worker adapter is connected.</div>';
  }

  function renderHistory() {
    const query = (document.getElementById('history-search')?.value || '').toLowerCase().trim();
    const items = [...state.history].sort((a, b) => new Date(b.at) - new Date(a.at)).filter((item) => !query || `${item.title} ${item.detail} ${item.type}`.toLowerCase().includes(query));
    document.getElementById('history-list').innerHTML = items.map((item) => `<article class="history-item"><time class="history-time">${esc(formatTime(item.at))}</time><div class="history-marker"></div><div class="history-copy"><strong>${esc(item.title)}</strong><p>${esc(item.detail)}</p></div></article>`).join('') || '<div class="empty-state"><strong>No history found</strong>Try another search.</div>';
  }

  function openDrawer(html) {
    document.getElementById('drawer-content').innerHTML = html;
    document.getElementById('drawer-backdrop').hidden = false;
    const drawer = document.getElementById('drawer');
    drawer.classList.add('is-open');
    drawer.setAttribute('aria-hidden', 'false');
    setTimeout(() => drawer.querySelector('textarea,button,select')?.focus(), 0);
  }
  function closeDrawer() {
    const drawer = document.getElementById('drawer');
    drawer.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
    document.getElementById('drawer-backdrop').hidden = true;
  }

  function openRunDrawer(teamId) {
    const team = teamById(teamId) || state.teams.find((item) => item.runnable === true);
    if (!team || team.runnable !== true) return;
    const modeText = isApiConnected() ? 'Submitting creates a persistent governed assignment in the Factory control queue.' : 'The control API is offline. Submitting creates an offline draft only.';
    openDrawer(`<p class="eyebrow">Run team</p><h2>${esc(team.name)}</h2><p class="drawer-subtitle">${esc(modeText)}</p><div class="notice notice--amber"><strong>Authority ceiling:</strong> zero external actions, $0 spend, no deploy/publish/production mutation. A worker must request fresh bounded owner approval if the assignment later requires more.</div><form id="run-team-form" class="form-grid" data-team-id="${esc(team.id)}"><label>Assignment<textarea name="instruction" required minlength="3" placeholder="Describe the outcome you want this team to accomplish."></textarea></label><label>Priority<select name="priority"><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option><option value="low">Low</option></select></label><div class="drawer-section"><h3>Control path</h3><div class="posture-list"><div><span>Persistent API</span><strong>${isApiConnected() ? 'Connected' : 'Offline'}</strong></div><div><span>Team executor</span><strong>${isApiConnected() ? 'Waiting worker' : 'Not connected'}</strong></div><div><span>External authority</span><strong>Zero by default</strong></div></div></div><div class="drawer-actions"><button type="button" class="quiet-button" data-close-drawer>Cancel</button><button type="submit" class="primary-button">${isApiConnected() ? 'Queue assignment' : 'Save offline draft'}</button></div></form>`);
  }

  function openTeamDetail(id) {
    const team = teamById(id);
    if (!team) return;
    const source = team.notionUrl ? `<a class="quiet-button" href="${esc(team.notionUrl)}" target="_blank" rel="noopener noreferrer">Open canonical record</a>` : '';
    openDrawer(`<p class="eyebrow">${esc(team.run)}</p><h2>${esc(team.name)}</h2><p class="drawer-subtitle">${esc(team.capability)}</p><div class="drawer-section"><h3>Current posture</h3><div class="posture-list"><div><span>Type</span><strong>${esc(team.kind || 'team')}</strong></div><div><span>Readiness</span><strong>${esc(team.readiness)}</strong></div><div><span>Live state</span><strong>${esc(team.live)}</strong></div><div><span>External authority</span><strong>${esc(team.authority)}</strong></div><div><span>Runnable</span><strong>${team.runnable === true ? 'Yes' : 'No'}</strong></div></div></div><div class="drawer-actions">${source}${team.runnable === true ? `<button class="primary-button" data-run-team="${esc(team.id)}">Run team</button>` : ''}</div>`);
  }

  function openWorkDetail(id) {
    const work = state.work.find((item) => item.id === id);
    if (!work) return;
    openDrawer(`<p class="eyebrow">${esc(work.id)}</p><h2>${esc(work.title)}</h2><p class="drawer-subtitle">${esc(work.teamName || teamById(work.teamId)?.name || '')} · ${esc(statusLabel(work.status))}</p><div class="drawer-section"><h3>Workflow</h3><div class="stage-list">${(work.stages || []).map((stage) => `<div class="stage stage--${esc(stage.state)}"><i>${stage.state === 'done' ? '✓' : stage.state === 'blocked' ? '!' : '○'}</i><strong>${esc(stage.name)}</strong><span>${esc(stage.detail)}</span></div>`).join('')}</div></div><div class="drawer-section"><h3>Result</h3><div class="result-box"><strong>${esc(work.result?.summary || 'No result yet')}</strong>${esc(work.result?.detail || '')}</div></div>${work.source === 'control-ledger' ? '<div class="drawer-section"><h3>Evidence class</h3><div class="code-line">Persistent Work Control command ledger. Execution is not complete until a governed terminal receipt exists.</div></div>' : ''}`);
  }

  async function submitRun(form) {
    const team = teamById(form.dataset.teamId);
    const formData = new FormData(form);
    const instruction = formData.get('instruction');
    const priority = formData.get('priority');
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      if (isApiConnected()) {
        await Api.submitCommand({ teamId: team.id, instruction, priority });
        closeDrawer();
        await refreshFromApi({ silent: true });
        navigate('work');
        return;
      }
      const draft = Core.createRunRequest({ teamId: team.id, teamName: team.name, instruction, priority, now: new Date().toISOString() });
      state.work.unshift(draft);
      state.history.unshift({ id: `H-${draft.id}`, at: draft.createdAt, title: 'Offline team request staged', detail: `${team.name}: ${draft.title}. Factory dispatch not claimed.`, type: 'offline' });
      saveOfflineState();
      closeDrawer();
      navigate('work');
    } catch (error) {
      button.disabled = false;
      const notice = document.createElement('div');
      notice.className = 'notice notice--amber';
      notice.textContent = `Could not submit assignment: ${error.message}`;
      form.prepend(notice);
    }
  }

  async function decideApproval(id, decision) {
    if (isApiConnected()) {
      try {
        await Api.decideApproval(id, decision);
        await refreshFromApi({ silent: true });
        return;
      } catch (error) { console.warn('Approval decision failed:', error.message); }
    }
    const index = state.approvals.findIndex((item) => (item.approvalId || item.id) === id);
    if (index < 0) return;
    const result = Core.applyApproval({ ...state.approvals[index], id }, decision, new Date().toISOString());
    state.approvals[index] = { ...result.approval, approvalId: id };
    state.history.unshift(result.event);
    saveOfflineState();
    render();
  }

  document.addEventListener('click', (event) => {
    const nav = event.target.closest('[data-view]'); if (nav) return navigate(nav.dataset.view);
    const jump = event.target.closest('[data-navigate]'); if (jump) return navigate(jump.dataset.navigate);
    const run = event.target.closest('[data-run-team]'); if (run && !run.disabled) return openRunDrawer(run.dataset.runTeam);
    const detail = event.target.closest('[data-team-detail]'); if (detail) return openTeamDetail(detail.dataset.teamDetail);
    const work = event.target.closest('[data-work-open],[data-work-id]'); if (work) return openWorkDetail(work.dataset.workOpen || work.dataset.workId);
    const approval = event.target.closest('[data-approval]'); if (approval) return decideApproval(approval.dataset.approval, approval.dataset.decision);
    if (event.target.closest('[data-close-drawer]')) return closeDrawer();
    const filter = event.target.closest('[data-filter]');
    if (filter) {
      workFilter = filter.dataset.filter;
      document.querySelectorAll('#work-filter button').forEach((button) => button.classList.toggle('is-active', button === filter));
      return renderWork();
    }
  });
  document.addEventListener('submit', (event) => {
    if (event.target.id === 'run-team-form') { event.preventDefault(); submitRun(event.target); }
  });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeDrawer(); });
  document.getElementById('global-run-team').addEventListener('click', () => openRunDrawer(state.teams.find((team) => team.id === 'SW-PROD-014')?.id || state.teams.find((team) => team.runnable === true)?.id));
  document.getElementById('drawer-close').addEventListener('click', closeDrawer);
  document.getElementById('drawer-backdrop').addEventListener('click', closeDrawer);
  document.getElementById('team-search').addEventListener('input', renderTeams);
  document.getElementById('history-search').addEventListener('input', renderHistory);
  document.getElementById('reset-demo').addEventListener('click', () => {
    localStorage.removeItem(STORAGE_KEY);
    if (!isApiConnected()) state = clone(FALLBACK);
    render();
  });

  setConnectionUi();
  render();
  refreshFromApi();
})();
