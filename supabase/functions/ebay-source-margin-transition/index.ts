import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const encoder = new TextEncoder();
const WORK_CONTROL = Deno.env.get("WORK_CONTROL_URL") ?? "https://workcontrol.159-65-169-244.sslip.io";

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

function adminConfig(): { url: string; key: string } | null {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const secretKeysRaw = Deno.env.get("SUPABASE_SECRET_KEYS");
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  let key = legacy;
  if (secretKeysRaw) {
    try {
      const parsed = JSON.parse(secretKeysRaw);
      key = parsed.default || Object.values(parsed)[0] || key;
    } catch {}
  }
  return url && key ? { url, key: String(key) } : null;
}

async function expectedTokenHash(cfg: { url: string; key: string }): Promise<string | null> {
  const response = await fetch(
    `${cfg.url}/rest/v1/amazon_observe_bridge_auth?select=token_sha256&singleton=eq.true&limit=1`,
    { headers: { apikey: cfg.key } },
  );
  if (!response.ok) return null;
  const rows = await response.json();
  return Array.isArray(rows) && rows[0]?.token_sha256 ? String(rows[0].token_sha256) : null;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json(405, { ok: false, error: "METHOD_NOT_ALLOWED" });

  const cfg = adminConfig();
  if (!cfg) return json(500, { ok: false, error: "SUPABASE_ADMIN_CONFIG_MISSING" });

  const token = req.headers.get("x-source-margin-observe-token") ?? "";
  const expected = await expectedTokenHash(cfg);
  if (!token || !expected || await sha256Hex(token) !== expected) {
    return json(401, { ok: false, error: "UNAUTHORIZED" });
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return json(400, { ok: false, error: "INVALID_JSON" }); }

  const factoryCommandId = String(body.factoryCommandId ?? "");
  const workItemId = String(body.workItemId ?? "");
  const toState = String(body.toState ?? "");
  const actor = String(body.actor ?? "factory-work-control");
  const details = typeof body.details === "object" && body.details ? body.details : {};

  if (!/^WC-[0-9]{14}-[A-Za-z0-9]{10}$/.test(factoryCommandId)) {
    return json(400, { ok: false, error: "FACTORY_COMMAND_INVALID" });
  }
  if (!/^[0-9a-fA-F-]{36}$/.test(workItemId) || !/^[A-Z0-9_]+$/.test(toState)) {
    return json(400, { ok: false, error: "TRANSITION_TARGET_INVALID" });
  }

  const wc = await fetch(`${WORK_CONTROL}/api/v1/commands/${encodeURIComponent(factoryCommandId)}`, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(5000),
  });
  if (!wc.ok) return json(403, { ok: false, error: "FACTORY_COMMAND_NOT_FOUND", status: wc.status });

  const control = await wc.json();
  const command = control?.command;
  const claim = control?.claim;
  const instruction = String(command?.instruction ?? "");

  if (command?.commandId !== factoryCommandId || command?.team?.id !== "RUN-004") {
    return json(403, { ok: false, error: "FACTORY_COMMAND_INVALID" });
  }
  if (!claim || claim.commandId !== factoryCommandId || claim.state !== "CLAIMED" || !claim.workerId) {
    return json(403, { ok: false, error: "FACTORY_ACTIVE_CLAIM_REQUIRED" });
  }
  if (!instruction.includes("[EBAY_SOURCE_MARGIN_TRANSITION_V1]") ||
      !instruction.includes(workItemId) ||
      !instruction.includes(toState)) {
    return json(403, { ok: false, error: "FACTORY_COMMAND_TARGET_MISMATCH" });
  }

  const rpc = await fetch(`${cfg.url}/rest/v1/rpc/factory_request_source_margin_transition`, {
    method: "POST",
    headers: { "content-type": "application/json", apikey: cfg.key },
    body: JSON.stringify({
      p_work_item_id: workItemId,
      p_to_state: toState,
      p_actor: actor,
      p_details: { ...details, factory_worker_id: claim.workerId, factory_command_id: factoryCommandId },
      p_factory_command_id: factoryCommandId,
      p_factory_token: token,
    }),
  });

  const text = await rpc.text();
  let payload: unknown = null;
  try { payload = text ? JSON.parse(text) : null; }
  catch { payload = { raw: text.slice(0, 1000) }; }

  if (!rpc.ok) {
    return json(409, { ok: false, error: "TRANSITION_DENIED", status: rpc.status, detail: payload });
  }
  return json(200, { ok: true, transition: payload });
});
