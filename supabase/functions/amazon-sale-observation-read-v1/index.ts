import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const encoder = new TextEncoder();

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

  let body: any;
  try { body = await req.json(); } catch { return json(400, { ok: false, error: "INVALID_JSON" }); }

  const leafId = String(body?.leafId ?? "").trim();
  const asins = Array.isArray(body?.asins)
    ? [...new Set(body.asins.map((x: unknown) => String(x ?? "").trim().toUpperCase()))]
    : [];

  if (!/^\d{5,20}$/.test(leafId)) return json(400, { ok: false, error: "LEAF_ID_INVALID" });
  if (asins.length < 1 || asins.length > 20 || asins.some((x: string) => !/^B[A-Z0-9]{9}$/.test(x))) {
    return json(400, { ok: false, error: "ASINS_INVALID" });
  }

  const workResponse = await fetch(
    `${cfg.url}/rest/v1/amazon_leaf_work_items?select=id&category_browse_node_id=eq.${encodeURIComponent(leafId)}&limit=1`,
    { headers: { apikey: cfg.key } },
  );
  if (!workResponse.ok) return json(502, { ok: false, error: "WORK_ITEM_LOOKUP_FAILED" });
  const workRows = await workResponse.json();
  const workItemId = Array.isArray(workRows) && workRows[0]?.id ? String(workRows[0].id) : "";
  if (!workItemId) return json(404, { ok: false, error: "WORK_ITEM_NOT_FOUND" });

  const asinFilter = asins.map((x: string) => `"${x.replaceAll('"', '')}"`).join(",");
  const query =
    `${cfg.url}/rest/v1/amazon_asin_observations` +
    `?select=id,asin,observed_price,source_url,observed_at,created_at,work_item_id` +
    `&work_item_id=eq.${encodeURIComponent(workItemId)}` +
    `&asin=in.(${encodeURIComponent(asinFilter)})` +
    `&observed_price=gt.0` +
    `&order=observed_at.desc` +
    `&limit=200`;

  const response = await fetch(query, { headers: { apikey: cfg.key } });
  if (!response.ok) {
    return json(502, { ok: false, error: "OBSERVATION_LOOKUP_FAILED", status: response.status, detail: (await response.text()).slice(0, 500) });
  }

  const rows = await response.json();
  const latest = new Map<string, any>();
  for (const row of Array.isArray(rows) ? rows : []) {
    const asin = String(row?.asin ?? "").toUpperCase();
    if (!latest.has(asin)) latest.set(asin, row);
  }

  const now = Date.now();
  const observations = asins.flatMap((asin: string) => {
    const row = latest.get(asin);
    if (!row) return [];
    const observedAtMs = Date.parse(String(row.observed_at ?? row.created_at ?? ""));
    if (!Number.isFinite(observedAtMs)) return [];
    const ageHours = (now - observedAtMs) / 3600000;
    if (ageHours < 0 || ageHours > 72) return [];
    const sourceUrl = String(row.source_url ?? `https://www.amazon.com/dp/${asin}`);
    if (!/^https:\/\/www\.amazon\.com\/dp\/[A-Z0-9]{10}(?:[/?#].*)?$/.test(sourceUrl)) return [];
    return [{
      asin,
      observationId: String(row.id),
      observedPriceUsd: Number(row.observed_price),
      sourceUrl,
      observedAt: new Date(observedAtMs).toISOString(),
      ageHours: Math.round(ageHours * 100) / 100,
    }];
  });

  return json(200, {
    ok: true,
    leafId,
    workItemId,
    requestedCount: asins.length,
    observationCount: observations.length,
    observations,
  });
});
