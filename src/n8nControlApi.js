async function authHeaders(user, includeJson = false, required = false) {
  const headers = includeJson ? { "Content-Type": "application/json" } : {};
  if (!user?.getIdToken) {
    if (required) throw new Error("Owner authentication required.");
    return headers;
  }
  const token = await user.getIdToken();
  return { ...headers, Authorization: `Bearer ${token}` };
}

async function readJson(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload?.error || `Request failed (${response.status})`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

export async function fetchN8nSnapshot(user) {
  const response = await fetch("/api/n8n-control", {
    method: "GET",
    headers: await authHeaders(user),
    cache: "no-store",
  });
  return readJson(response);
}

export async function fetchWorkflowResult(user, workflowId) {
  const response = await fetch(`/api/n8n-control?result=${encodeURIComponent(workflowId)}`, {
    method: "GET",
    headers: await authHeaders(user),
    cache: "no-store",
  });
  return readJson(response);
}

export async function fetchExecutionLedger(user, { workflowId = "", status = "", limit = 25, offset = 0 } = {}) {
  const params = new URLSearchParams({ executions: "1", limit: String(limit), offset: String(offset) });
  if (workflowId) params.set("workflowId", workflowId);
  if (status) params.set("status", status);
  const response = await fetch(`/api/n8n-control?${params.toString()}`, {
    method: "GET",
    headers: await authHeaders(user),
    cache: "no-store",
  });
  return readJson(response);
}

export async function fetchExecutionDetail(user, executionId) {
  const response = await fetch(`/api/n8n-control?execution=${encodeURIComponent(executionId)}`, {
    method: "GET",
    headers: await authHeaders(user),
    cache: "no-store",
  });
  return readJson(response);
}

export async function fetchWorkflowDiagnosis(user, workflowId) {
  const response = await fetch(`/api/n8n-control?diagnose=${encodeURIComponent(workflowId)}`, {
    method: "GET",
    headers: await authHeaders(user),
    cache: "no-store",
  });
  return readJson(response);
}

export async function fetchDependencyInventory(user) {
  const response = await fetch("/api/n8n-control?dependencies=1", {
    method: "GET",
    headers: await authHeaders(user),
    cache: "no-store",
  });
  return readJson(response);
}

export async function controlWorkflow(user, workflowId, action) {
  const response = await fetch("/api/n8n-control", {
    method: "POST",
    headers: await authHeaders(user, true, true),
    body: JSON.stringify({ action, workflowId }),
  });
  return readJson(response);
}

export async function enrollWorkflowOwner(user, bootstrapCode) {
  const response = await fetch("/api/n8n-control", {
    method: "POST",
    headers: await authHeaders(user, true, true),
    body: JSON.stringify({ action: "enroll", bootstrapCode }),
  });
  return readJson(response);
}
