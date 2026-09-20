#!/usr/bin/env node
// Grove maar stabiele bundle-omvang-bewaking: telt de totale grootte van alle
// client-side JS-chunks op na `next build` en faalt als dat budget wordt
// overschreden. Dit voorkomt dat performance-opschoning (zie de
// performance-audit) over een jaar stilzwijgend weer teniet wordt gedaan
// door een nieuwe, per ongeluk statisch-geïmporteerde zware library.
//
// BEWUSTE KEUZE: geen poging tot een exacte "First Load JS per route"-
// meting (zoals Next's eigen CLI die vroeger printte) — dit Next.js-project
// (16.3.0, webpack-mode) print die tabel niet meer, en de onderliggende
// per-route manifestbestanden (`page_client-reference-manifest.js`) zijn
// ongedocumenteerde interne Next.js-implementatiedetails die per versie
// kunnen veranderen. Een budget op basis daarvan zou bij elke Next.js-
// upgrade kunnen breken — te broos voor een check die juist jarenlang mee
// moet gaan. De totale chunk-omvang is grover, maar blijft werken ongeacht
// interne formaatwijzigingen, en vangt de belangrijkste regressieklasse
// (een nieuwe zware, niet-code-gesplitste dependency) prima op.
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const CHUNKS_DIR = ".next/static/chunks";

// Baseline (na de performance-opschoning van september 2026) was ~3,36MB.
// Ruimte voor groei zonder meteen te falen bij elke kleine toevoeging, maar
// wel een harde grens tegen sluipende bundle-groei.
const TOTAL_BUDGET_BYTES = 4.5 * 1024 * 1024; // 4,5MB
const PER_CHUNK_BUDGET_BYTES = 0.85 * 1024 * 1024; // 0,85MB — ruim boven de huidige grootste (react-pdf, async-geladen, ~0,7MB)

function collectJsFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectJsFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".js") && !entry.name.endsWith(".map")) {
      files.push(fullPath);
    }
  }
  return files;
}

function formatBytes(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)}MB`;
}

let files;
try {
  files = collectJsFiles(CHUNKS_DIR);
} catch (cause) {
  console.error(
    `Kon ${CHUNKS_DIR} niet lezen — draai eerst "npm run build" vóór deze check.`,
    cause,
  );
  process.exit(1);
}

const sized = files
  .map((file) => ({ file, size: statSync(file).size }))
  .sort((a, b) => b.size - a.size);

const total = sized.reduce((sum, { size }) => sum + size, 0);

console.log(`Client-side JS-chunks: ${sized.length} bestanden, totaal ${formatBytes(total)}`);
console.log("Grootste 10:");
for (const { file, size } of sized.slice(0, 10)) {
  console.log(`  ${formatBytes(size).padStart(9)}  ${file}`);
}

let failed = false;

if (total > TOTAL_BUDGET_BYTES) {
  console.error(
    `\n✗ Totale chunk-omvang ${formatBytes(total)} overschrijdt het budget van ${formatBytes(TOTAL_BUDGET_BYTES)}.`,
  );
  failed = true;
}

const overBudgetChunks = sized.filter(({ size }) => size > PER_CHUNK_BUDGET_BYTES);
if (overBudgetChunks.length > 0) {
  console.error(
    `\n✗ ${overBudgetChunks.length} chunk(s) overschrijden het per-bestand-budget van ${formatBytes(PER_CHUNK_BUDGET_BYTES)}:`,
  );
  for (const { file, size } of overBudgetChunks) {
    console.error(`  ${formatBytes(size)}  ${file}`);
  }
  console.error(
    "  Controleer of hier een zware library statisch is geïmporteerd die eigenlijk via next/dynamic() of een dynamische import() pas bij gebruik geladen moet worden.",
  );
  failed = true;
}

if (failed) {
  process.exit(1);
}

console.log("\n✓ Bundle-omvang binnen budget.");
