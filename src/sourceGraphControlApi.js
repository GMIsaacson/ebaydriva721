async function authHeaders(user) {
  if (!user?.getIdToken) throw new Error("Owner authentication required.");
  const token = await user.getIdToken();
  return { Authorization: `Bearer ${token}` };
}

async function readJson(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload?.error || `Request failed (${response.status})`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  if (payload?.version !== "source-graph-control-v1") {
    throw new Error("Source Graph control contract mismatch.");
  }
  return payload;
}

export async function fetchSourceGraphControl(user) {
  const response = await fetch("/api/source-graph-control", {
    method: "GET",
    headers: await authHeaders(user),
    cache: "no-store",
  });
  return readJson(response);
}
