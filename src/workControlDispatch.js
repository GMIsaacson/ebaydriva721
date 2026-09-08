const GATEWAY_BASE = "https://workcontrol.159-65-169-244.sslip.io/gateway";

function priorityFor(item) {
  const map = { P0: "high", P1: "normal", P2: "normal", P3: "low" };
  return map[item?.priority] || "normal";
}

function instructionFor(item) {
  return [
    `[WORK_CONTROL_V2:${item.id}]`,
    `Complete this approved nonproduction Factory work order: ${item.title}.`,
    item.businessOutcome ? `Business outcome: ${item.businessOutcome}.` : "",
    item.nextAction ? `Next action: ${item.nextAction}.` : "",
    item.definitionOfDone ? `Definition of done: ${item.definitionOfDone}.` : "",
    item.evidenceRequired ? `Evidence required: ${item.evidenceRequired}.` : "",
    `Stay inside the existing command authority ceiling: no external actions, spending, deployment, publication, messaging, destructive action, or production mutation.`,
    `Return an evidence-backed result or BLOCKED_OWNER/BLOCKED_EXTERNAL rather than claiming unavailable execution.`,
  ].filter(Boolean).join(" ");
}

async function request(user, path, options = {}) {
  if (!user?.getIdToken) throw new Error("AUTH_REQUIRED");
  const token = await user.getIdToken();
  const response = await fetch(`${GATEWAY_BASE}${path}`, {
    ...options,
    headers: {
      accept: "application/json",
      authorization: `Bearer ${token}`,
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  let payload = {};
  try { payload = text ? JSON.parse(text) : {}; }
  catch { payload = { error: "INVALID_GATEWAY_RESPONSE" }; }
  if (!response.ok) {
    const error = new Error(payload.error || `GATEWAY_${response.status}`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

export async function dispatchWorkOrder(user, item) {
  if (!item?.id) throw new Error("WORK_ORDER_REQUIRED");
  return request(user, "/v1/commands", {
    method: "POST",
    body: JSON.stringify({
      teamId: "SW-PROD-014",
      instruction: instructionFor(item),
      priority: priorityFor(item),
      modelBudgetCents: 2,
    }),
  });
}

export async function fetchExecution(user, commandId) {
  if (!commandId) throw new Error("COMMAND_ID_REQUIRED");
  return request(user, `/v1/commands/${encodeURIComponent(commandId)}`);
}

export async function fetchFactoryState(user) {
  return request(user, "/v1/state");
}

export { GATEWAY_BASE };
