import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const guide = readFileSync(resolve("docs/GUIA_CRIACAO_SKIP.md"), "utf8");
const report = readFileSync(resolve("reports/comex-control-skip-guia-criacao.html"), "utf8");

for (const prompt of Array.from({ length: 14 }, (_, index) => `Prompt ${index + 1}`)) {
  assert.ok(guide.includes(prompt), `Ausente: ${prompt}`);
}

for (const required of [
  "henrryquegabriel-boop/comex-control-skip",
  "Supabase",
  "Row Level Security",
  "OWNER",
  "AUDITOR",
  "MapLibre",
  "OpenFreeMap",
  "N8N_INGEST_TOKEN",
  "_SYNC_ID",
  "_VERSAO",
  "74 processos",
  "83 linhas-fonte",
  "19.840",
  "73,33%",
]) {
  assert.ok(guide.includes(required), `Requisito ausente no guia: ${required}`);
}

for (const required of [
  "CCS-GUIA-2026-001",
  "Exportar PDF",
  "window.print()",
  "@media print",
  "74.400",
  "19.840",
  "73,33%",
]) {
  assert.ok(report.includes(required), `Requisito ausente no HTML: ${required}`);
}

assert.ok(!report.match(/\{\{[^}]+\}\}/), "Placeholder não resolvido no HTML");
assert.ok(!report.match(/\bundefined\b|\bNaN\b/), "Valor inválido no HTML");

const hourly = 100 * 24 * 31;
const hybrid = 20 * 24 * 31 + 80 * 2 * 31;
assert.equal(hourly, 74_400);
assert.equal(hybrid, 19_840);
assert.equal(Number(((1 - hybrid / hourly) * 100).toFixed(2)), 73.33);

console.log("Guia Skip validado: 14 prompts, controles técnicos e HTML portátil.");
