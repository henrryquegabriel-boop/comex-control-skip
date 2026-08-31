import assert from "node:assert/strict";
import test from "node:test";
import { CUSTOMS_CHANNELS, IMPORT_STAGES, ROLE_PERMISSIONS, trackingCadence } from "../src/lib/domain";
import { isIso6346, normalizeContainerNumber } from "../src/lib/iso6346";

test("preserva as quatro etapas e as cores oficiais do produto", () => {
  assert.deepEqual(Object.keys(IMPORT_STAGES), ["IMPORT_STARTED", "IN_TRANSIT", "PENDING", "COMPLETED"]);
  assert.equal(IMPORT_STAGES.IMPORT_STARTED.color, "#38BDF8");
  assert.equal(IMPORT_STAGES.IN_TRANSIT.color, "#8B5CF6");
  assert.equal(IMPORT_STAGES.PENDING.color, "#EC4899");
  assert.equal(IMPORT_STAGES.COMPLETED.color, "#14B8A6");
});

test("mantém canais aduaneiros independentes e com cores padrão", () => {
  assert.equal(CUSTOMS_CHANNELS.GREEN.color, "#008000");
  assert.equal(CUSTOMS_CHANNELS.YELLOW.color, "#FFFF00");
  assert.equal(CUSTOMS_CHANNELS.RED.color, "#FF0000");
  assert.equal(CUSTOMS_CHANNELS.GRAY.color, "#808080");
});

test("auditor lê relatórios e auditoria, mas não altera importações", () => {
  assert.ok(ROLE_PERMISSIONS.AUDITOR.includes("REPORTS_GENERATE"));
  assert.ok(ROLE_PERMISSIONS.AUDITOR.includes("AUDIT_READ"));
  assert.ok(!ROLE_PERMISSIONS.AUDITOR.includes("IMPORTS_WRITE" as never));
});

test("valida ISO 6346 sem aceitar apenas a aparência", () => {
  assert.equal(normalizeContainerNumber(" csqu 305438 3 "), "CSQU3054383");
  assert.equal(isIso6346("CSQU3054383"), true);
  // ISO válido não significa que o contêiner exista no armador; são validações diferentes.
  assert.equal(isIso6346("HLCU8042211"), true);
  assert.equal(isIso6346("HLCU8042212"), false);
  assert.equal(isIso6346("ABCU1234567"), false);
});

test("política híbrida prioriza pendência, canal crítico e ETA próximo", () => {
  const now = Date.parse("2026-08-31T12:00:00Z");
  assert.equal(trackingCadence({ stage: "COMPLETED" }, now).tier, "STOPPED");
  assert.equal(trackingCadence({ stage: "PENDING" }, now).tier, "CRITICAL");
  assert.equal(trackingCadence({ customsChannel: "RED" }, now).tier, "CRITICAL");
  assert.equal(trackingCadence({ eta: "2026-09-01T12:00:00Z" }, now).tier, "CRITICAL");
  assert.equal(trackingCadence({ eta: "2026-10-01T12:00:00Z" }, now).tier, "STANDARD");
});
