import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
const reportDir = join(here, "..");
const buildDir = join(reportDir, ".build");
const skillBuilder = "C:\\Users\\Gabri\\.codex\\skills\\tt-elaboration\\scripts\\build_report.py";
const metadata = JSON.parse(readFileSync(join(here, "guia_skip.meta.json"), "utf8"));
const bodyHtml = readFileSync(join(here, "guia_skip.body.html"), "utf8");
const specPath = join(buildDir, "guia_skip.spec.json");
const outputPath = join(reportDir, "comex-control-skip-guia-criacao.html");

mkdirSync(buildDir, { recursive: true });
writeFileSync(specPath, JSON.stringify({ ...metadata, body_html: bodyHtml }, null, 2), "utf8");

const result = spawnSync("python", [skillBuilder, specPath, outputPath], {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
});

if (result.status !== 0) {
  throw new Error(result.stderr || result.stdout || "Falha ao gerar o relatório.");
}

process.stdout.write(result.stdout);
