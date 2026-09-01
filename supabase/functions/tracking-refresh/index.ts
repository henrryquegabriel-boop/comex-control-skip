import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ROLES = new Set(["OWNER", "ADMIN", "OPERATOR"]);
const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS_HEADERS,
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (request.method !== "POST") return json(405, { ok: false, error: "METHOD_NOT_ALLOWED" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const n8nUrl = Deno.env.get("N8N_MANUAL_WEBHOOK_URL");
  const n8nToken = Deno.env.get("N8N_MANUAL_WEBHOOK_TOKEN");
  const authorization = request.headers.get("authorization");

  if (!supabaseUrl || !anonKey || !serviceKey) {
    return json(503, { ok: false, error: "SUPABASE_SERVER_NOT_CONFIGURED" });
  }
  if (!authorization) return json(401, { ok: false, error: "AUTHORIZATION_REQUIRED" });
  if (!n8nUrl || !n8nToken) {
    return json(503, { ok: false, error: "N8N_MANUAL_TRACKING_NOT_CONFIGURED" });
  }

  let body: { companyId?: string; containerNumber?: string };
  try {
    body = await request.json();
  } catch {
    return json(400, { ok: false, error: "INVALID_JSON" });
  }
  if (!body.companyId) return json(422, { ok: false, error: "COMPANY_REQUIRED" });

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return json(401, { ok: false, error: "INVALID_SESSION" });

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: membership, error: membershipError } = await admin
    .from("company_memberships")
    .select("role")
    .eq("company_id", body.companyId)
    .eq("user_id", userData.user.id)
    .eq("active", true)
    .maybeSingle();

  if (membershipError) return json(500, { ok: false, error: "MEMBERSHIP_LOOKUP_FAILED" });
  if (!membership || !ALLOWED_ROLES.has(membership.role)) {
    return json(403, { ok: false, error: "TRACKING_REFRESH_FORBIDDEN" });
  }

  const normalizedContainer = body.containerNumber
    ? body.containerNumber.replace(/[^A-Za-z0-9]/g, "").toUpperCase()
    : null;
  if (normalizedContainer && !/^[A-Z]{3}[UJZ][0-9]{7}$/.test(normalizedContainer)) {
    return json(422, { ok: false, error: "INVALID_CONTAINER_FORMAT" });
  }

  const requestId = crypto.randomUUID();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);

  try {
    const upstream = await fetch(n8nUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-comex-manual-token": n8nToken,
      },
      body: JSON.stringify({
        requestId,
        companyId: body.companyId,
        containerNumber: normalizedContainer,
        requestedBy: userData.user.id,
        source: "COMEX_CONTROL_APP",
      }),
      signal: controller.signal,
    });

    const responseText = await upstream.text();
    let result: unknown = null;
    try {
      result = responseText ? JSON.parse(responseText) : null;
    } catch {
      result = responseText.slice(0, 2000);
    }

    if (!upstream.ok) {
      return json(502, {
        ok: false,
        error: "N8N_TRACKING_FAILED",
        requestId,
        upstreamStatus: upstream.status,
      });
    }

    return json(200, { ok: true, requestId, upstreamStatus: upstream.status, result });
  } catch (error) {
    const message = error instanceof Error && error.name === "AbortError"
      ? "N8N_TRACKING_TIMEOUT"
      : "N8N_TRACKING_UNAVAILABLE";
    return json(504, { ok: false, error: message, requestId });
  } finally {
    clearTimeout(timeout);
  }
});
