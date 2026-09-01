import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { CUSTOMS_CHANNELS, IMPORT_STAGES } from "../src/lib/domain";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("contrato anexável e domínio executável permanecem sincronizados", () => {
  const contract = JSON.parse(read("../skip-package/01_DOMAIN_CONTRACT.json"));
  assert.deepEqual(contract.operationalStages.map((item: { code: string }) => item.code), Object.keys(IMPORT_STAGES));
  assert.deepEqual(contract.operationalStages.map((item: { color: string }) => item.color), Object.values(IMPORT_STAGES).map((item) => item.color));
  assert.deepEqual(contract.customsChannels.map((item: { color: string }) => item.color), Object.values(CUSTOMS_CHANNELS).map((item) => item.color));
});

test("migration contém modelo oficial, segregação e RLS", () => {
  const sql = read("../supabase/migrations/202608310001_core.sql");
  const requiredTables = [
    "companies", "company_memberships", "imports", "import_details", "containers",
    "container_positions", "container_status_history", "import_customs_channel_history",
    "tracking_receipts", "tracking_dispatches", "integration_errors", "access_audit_logs",
    "import_source_rows", "import_reference_options", "official_data_batches", "sheet_sync_outbox",
  ];
  for (const table of requiredTables) assert.match(sql, new RegExp(`create table if not exists public\\.${table}\\b`));
  assert.match(sql, /enable row level security/);
  assert.match(sql, /LAST_OWNER_REQUIRED/);
  assert.match(sql, /foreign key\(company_id,container_id\)/);
  assert.match(sql, /enqueue_import_sheet_sync/);
  assert.doesNotMatch(sql, /using\s*\(true\).*imports/i);
});

test("webhook exige assinatura, idempotência e dados geográficos válidos", () => {
  const source = read("../supabase/functions/webhook-ingest/index.ts");
  assert.match(source, /x-comex-signature/);
  assert.match(source, /HMAC/);
  assert.match(source, /tracking_receipts/);
  assert.match(source, /INVALID_ISO_6346/);
  assert.match(source, /INVALID_COORDINATES/);
  assert.doesNotMatch(source, /access-control-allow-origin/i);
});

test("cadastro e atualização manual usam contratos reais do backend", () => {
  const sql = read("../supabase/migrations/202608310001_core.sql");
  const app = read("../src/App.tsx");
  const relay = read("../supabase/functions/tracking-refresh/index.ts");

  assert.match(sql, /create_import_with_container/);
  assert.match(sql, /is_valid_iso6346/);
  assert.match(app, /rpc\('create_import_with_container'/);
  assert.match(app, /functions\.invoke\('tracking-refresh'/);
  assert.doesNotMatch(app, /from\('profiles'\)|from\('tracking_events'\)|container_code:/);
  assert.match(relay, /N8N_MANUAL_WEBHOOK_URL/);
  assert.match(relay, /TRACKING_REFRESH_FORBIDDEN/);
  assert.match(relay, /userClient\.auth\.getUser/);
});

test("starter expõe as quatro rotas obrigatórias e não inclui dados de demonstração", () => {
  const app = `${read("../src/App.tsx")}\n${read("../src/components/MapSurface.tsx")}`;
  for (const route of ["/dashboard", "/importacoes", "/relatorios", "/configuracoes"]) assert.match(app, new RegExp(route));
  assert.match(app, /Nenhuma empresa vinculada/);
  assert.match(app, /Nenhuma posição comprovada/);
  assert.doesNotMatch(app, /HLCU8042211|SAFRA|QUALLY/);
});

test("material financeiro não mantém o preço histórico obsoleto como recomendação", () => {
  const guide = read("../docs/GUIA_CRIACAO_SKIP.md");
  assert.match(guide, /R\$ 249\/mês/);
  assert.match(guide, /FAQ antiga/);
  assert.doesNotMatch(guide, /Premium custa R\$ 99/);
});
