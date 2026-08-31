import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const STAGES = new Set(["IMPORT_STARTED", "IN_TRANSIT", "PENDING", "COMPLETED"]);
const STAGE_META: Record<string, { label: string; color: string }> = {
  IMPORT_STARTED: { label: "Início da importação", color: "#38BDF8" },
  IN_TRANSIT: { label: "Em andamento", color: "#8B5CF6" },
  PENDING: { label: "Pendente", color: "#EC4899" },
  COMPLETED: { label: "Concluído", color: "#14B8A6" },
};

type WebhookPayload = {
  eventId: string;
  companyCode: string;
  source: string;
  observedAt: string;
  container: {
    number: string;
    carrierCode?: string;
    provider?: string;
    providerUrl?: string;
    stage?: string;
    statusRaw?: string;
    eta?: string | null;
    currentLocation?: string | null;
    vesselName?: string | null;
    vesselImo?: string | null;
    vesselMmsi?: string | null;
    voyageNumber?: string | null;
  };
  position?: {
    latitude: number;
    longitude: number;
    locationName?: string | null;
    confidence?: string;
    eventCode?: string | null;
    unLocationCode?: string | null;
    providerEventId?: string | null;
  } | null;
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

function normalizeContainer(value: string) {
  return value.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

function isIso6346(value: string) {
  const normalized = normalizeContainer(value);
  if (!/^[A-Z]{3}[UJZ]\d{7}$/.test(normalized)) return false;
  let sum = 0;
  for (let index = 0; index < 10; index += 1) {
    const character = normalized[index];
    const digit = Number(character);
    const base = character >= "A" && character <= "Z" ? character.charCodeAt(0) - 55 : digit;
    const numeric = Number.isNaN(digit) ? base + Math.floor((base - 1) / 10) : digit;
    sum += numeric * 2 ** index;
  }
  const remainder = sum % 11;
  return (remainder === 10 ? 0 : remainder) === Number(normalized[10]);
}

function toHex(buffer: ArrayBuffer) {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

async function validSignature(raw: string, signature: string | null, secret: string) {
  if (!signature) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw));
  return constantTimeEqual(toHex(digest), signature.replace(/^sha256=/i, "").toLowerCase());
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json(405, { error: "METHOD_NOT_ALLOWED" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const webhookSecret = Deno.env.get("N8N_WEBHOOK_SECRET");
  if (!supabaseUrl || !serviceKey || !webhookSecret) return json(503, { error: "SERVER_NOT_CONFIGURED" });

  const raw = await request.text();
  if (!(await validSignature(raw, request.headers.get("x-comex-signature"), webhookSecret))) return json(401, { error: "INVALID_SIGNATURE" });

  let payload: WebhookPayload;
  try { payload = JSON.parse(raw) as WebhookPayload; } catch { return json(400, { error: "INVALID_JSON" }); }

  const containerNumber = normalizeContainer(payload.container?.number ?? "");
  if (!payload.eventId || !payload.companyCode || !payload.source || !Date.parse(payload.observedAt)) return json(422, { error: "REQUIRED_FIELDS_MISSING" });
  if (!isIso6346(containerNumber)) return json(422, { error: "INVALID_ISO_6346", containerNumber });
  if (payload.container.stage && !STAGES.has(payload.container.stage)) return json(422, { error: "INVALID_STAGE" });
  if (payload.position && (!Number.isFinite(payload.position.latitude) || !Number.isFinite(payload.position.longitude) || Math.abs(payload.position.latitude) > 90 || Math.abs(payload.position.longitude) > 180)) return json(422, { error: "INVALID_COORDINATES" });

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: company, error: companyError } = await admin.from("companies").select("id").eq("code", payload.companyCode).eq("active", true).maybeSingle();
  if (companyError) return json(500, { error: "COMPANY_LOOKUP_FAILED" });
  if (!company) return json(404, { error: "COMPANY_NOT_FOUND" });

  const { data: receipt } = await admin.from("tracking_receipts").select("response_json").eq("company_id", company.id).eq("idempotency_key", payload.eventId).maybeSingle();
  if (receipt) return json(200, { ...receipt.response_json, duplicate: true });

  const stage = payload.container.stage ?? "IMPORT_STARTED";
  const meta = STAGE_META[stage];
  const containerRow = {
    company_id: company.id,
    container_number: containerNumber,
    carrier_code: payload.container.carrierCode ?? null,
    provider: payload.container.provider ?? payload.source,
    provider_url: payload.container.providerUrl ?? null,
    stage,
    status_label: meta.label,
    status_color: meta.color,
    status_raw: payload.container.statusRaw ?? "PROVIDER_UPDATE",
    current_location: payload.container.currentLocation ?? payload.position?.locationName ?? null,
    latitude: payload.position?.latitude ?? null,
    longitude: payload.position?.longitude ?? null,
    eta: payload.container.eta ?? null,
    vessel_name: payload.container.vesselName ?? null,
    vessel_imo: payload.container.vesselImo ?? null,
    vessel_mmsi: payload.container.vesselMmsi ?? null,
    voyage_number: payload.container.voyageNumber ?? null,
    position_source: payload.position ? payload.source : "UNKNOWN",
    position_confidence: payload.position?.confidence ?? "UNKNOWN",
    position_observed_at: payload.position ? payload.observedAt : null,
    last_provider_update_at: payload.observedAt,
    last_auto_checked_at: payload.observedAt,
    last_check_source: "automatic",
  };

  const { data: container, error: upsertError } = await admin.from("containers").upsert(containerRow, { onConflict: "company_id,container_number" }).select("id").single();
  if (upsertError || !container) return json(500, { error: "CONTAINER_UPSERT_FAILED" });

  if (payload.position) {
    const { error: positionError } = await admin.from("container_positions").upsert({
      company_id: company.id,
      container_id: container.id,
      latitude: payload.position.latitude,
      longitude: payload.position.longitude,
      location_name: payload.position.locationName ?? null,
      recorded_at: payload.observedAt,
      source: payload.source,
      position_source: payload.source,
      position_confidence: payload.position.confidence ?? "UNKNOWN",
      vessel_imo: payload.container.vesselImo ?? null,
      vessel_mmsi: payload.container.vesselMmsi ?? null,
      event_code: payload.position.eventCode ?? null,
      un_location_code: payload.position.unLocationCode ?? null,
      provider_event_id: payload.position.providerEventId ?? payload.eventId,
      raw_payload: payload,
    }, { onConflict: "company_id,container_id,provider_event_id", ignoreDuplicates: true });
    if (positionError) return json(500, { error: "POSITION_WRITE_FAILED" });
  }

  const response = { ok: true, eventId: payload.eventId, companyId: company.id, containerId: container.id, containerNumber };
  const { error: receiptError } = await admin.from("tracking_receipts").insert({ company_id: company.id, idempotency_key: payload.eventId, response_json: response });
  if (receiptError) return json(500, { error: "RECEIPT_WRITE_FAILED" });
  return json(202, response);
});
