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

  const api = {
    health: () => request('/api/v1/health'),
    state: () => request('/api/v1/state'),
    submitCommand: ({ teamId, instruction, priority }) => request('/api/v1/commands', { method: 'POST', body: { teamId, instruction, priority } }),
    command: (id) => request(`/api/v1/commands/${encodeURIComponent(id)}`),
    decideApproval: (id, decision) => request(`/api/v1/approvals/${encodeURIComponent(id)}/decision`, { method: 'POST', body: { decision } })
  };

  root.WorkControlApi = api;
})(window);
