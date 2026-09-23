(function (root) {
  'use strict';

  async function request(path, options = {}) {
    if (!String(path).startsWith('/api/v1/')) throw new Error('SAME_ORIGIN_API_ONLY');
    const response = await fetch(path, {
      method: options.method || 'GET',
      headers: options.body ? { 'content-type': 'application/json' } : undefined,
      body: options.body ? JSON.stringify(options.body) : undefined,
      credentials: 'same-origin',
      cache: 'no-store'
    });
    let payload = null;
    try { payload = await response.json(); } catch { payload = { error: 'INVALID_API_RESPONSE' }; }
    if (!response.ok) {
      const error = new Error(payload?.error || `HTTP_${response.status}`);
      error.status = response.status;
      error.payload = payload;
      throw error;
    }
    return payload;
  }

  function reflectLiveExecutor(state) {
    if (state?.connection?.executor !== 'ONLINE') return;
    setTimeout(() => {
      const dot = document.getElementById('connection-dot');
      const title = document.getElementById('connection-title');
      const detail = document.getElementById('connection-detail');
      if (dot) dot.className = 'status-dot status-dot--green';
      if (title) title.textContent = 'Governed worker online';
      if (detail) detail.textContent = 'Persistent governed queue · GPT-5.6 Luna worker online · external authority remains zero.';
    }, 0);
  }

  const api = {
    health: () => request('/api/v1/health'),
    state: async () => {
      const state = await request('/api/v1/state');
      reflectLiveExecutor(state);
      return state;
    },
    submitCommand: ({ teamId, instruction, priority }) => request('/api/v1/commands', { method: 'POST', body: { teamId, instruction, priority } }),
    command: (id) => request(`/api/v1/commands/${encodeURIComponent(id)}`),
    decideApproval: (id, decision) => request(`/api/v1/approvals/${encodeURIComponent(id)}/decision`, { method: 'POST', body: { decision } })
  };

  root.WorkControlApi = api;
})(window);
