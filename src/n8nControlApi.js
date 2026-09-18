async function authHeaders(user, includeJson = false) {
  if (!user?.getIdToken) throw new Error("Sign in to Factory Control.");
  const token = await user.getIdToken();
  return {
    ...(includeJson ? { "Content-Type": "application/json" } : {}),
    Authorization: `Bearer ${token}`,
  };
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

export async function controlWorkflow(user, workflowId, action) {
  const response = await fetch("/api/n8n-control", {
    method: "POST",
    headers: await authHeaders(user, true),
    body: JSON.stringify({ action, workflowId }),
  });
  return readJson(response);
}
