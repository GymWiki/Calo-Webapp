// Regressietest voor "Activiteit uit document" (zie fixtures/imports/README.md).
// Draait de ECHTE productiefuncties (lib/ai/documentNormalization.ts,
// lib/ai/activityImportExtraction.ts) tegen elke fixture en scoort per veld
// hoe goed de extractie de verwachte inhoud vond — geen losse testimplementatie,
// zodat deze eval ook daadwerkelijk aantoont dat de productiecode werkt.
//
// "@/..."-imports in die lib-bestanden worden opgelost door
// scripts/lib/path-alias-loader.mjs (plain Node ESM kent geen tsconfig-paths).
//
// Gebruik:
//   OPENAI_API_KEY=... node --experimental-strip-types \
//     --experimental-loader=./scripts/lib/path-alias-loader.mjs \
//     --env-file=.env.local scripts/eval-import.mjs
//   (of: npm run eval:import, met OPENAI_API_KEY gezet)

import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { normalizeForImport } from "../lib/ai/documentNormalization.ts";
import { extractActivityFromDocument } from "../lib/ai/activityImportExtraction.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.join(__dirname, "..", "fixtures", "imports");

// Expliciet aanpasbaar — begin-waarde per het plan voor deze herbouw. Verlaag
// deze (met een commentaar waarom) als een eerste full run op echte,
// aangeleverde fixtures laat zien dat 0.8 voor dit soort fuzzy-matching te
// streng is; verhoog 'm als de testset groeit en de extractie structureel
// beter scoort.
const SCORE_THRESHOLD = 0.8;

const EXTENSION_MIME_TYPES = {
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".odt": "application/vnd.oasis.opendocument.text",
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
};

// Array-velden van ExtractedActivity die als lijst (join met "\n") vergeleken
// worden i.p.v. als enkele string — moet in sync blijven met
// lib/ai/activityImportExtraction.ts's extractedActivitySchema.
const LIST_FIELDS = new Set(["rules", "learningOutcomes", "baseMaterials", "ruleMaterials"]);

function fieldText(activity, fieldName) {
  const field = activity[fieldName];
  if (!field) return "";
  const value = field.value;
  if (value === null || value === undefined) return "";
  if (LIST_FIELDS.has(fieldName)) {
    return Array.isArray(value) ? value.join("\n") : String(value);
  }
  return String(value);
}

function allFieldsText(activity) {
  return Object.keys(activity)
    .filter((key) => key !== "unplacedContent" && key !== "isMovementActivity")
    .map((key) => fieldText(activity, key))
    .join("\n");
}

/**
 * Scoort één fixture tegen zijn expected.json. Per veld drie dimensies:
 * - aanwezig: verwachte substring ergens in de volledige extractie gevonden
 *   (niets is stilzwijgend verloren gegaan).
 * - juisteVeld: verwachte substring specifiek in HET VERWACHTE veld gevonden
 *   (de extractie routeerde het naar de juiste plek, niet alleen "ergens").
 * - volledigheid: per veld de fractie van zijn eigen verwachte substrings die
 *   in dat veld terechtkwam (hetzelfde als juisteVeld, maar per-veld
 *   genormaliseerd i.p.v. over de hele fixture, zodat een veld met veel
 *   verwachte substrings een veld met weinig substrings niet overstemt).
 */
function scoreFixture(activity, expectedFields) {
  const fullText = allFieldsText(activity).toLowerCase();
  const rows = [];

  for (const [fieldName, substrings] of Object.entries(expectedFields)) {
    if (!Array.isArray(substrings) || substrings.length === 0) continue;
    const fieldLower = fieldText(activity, fieldName).toLowerCase();

    let presentCount = 0;
    let correctFieldCount = 0;
    for (const substring of substrings) {
      const needle = substring.toLowerCase();
      if (fullText.includes(needle)) presentCount += 1;
      if (fieldLower.includes(needle)) correctFieldCount += 1;
    }

    rows.push({
      fieldName,
      total: substrings.length,
      presence: presentCount / substrings.length,
      correctField: correctFieldCount / substrings.length,
      completeness: correctFieldCount / substrings.length,
    });
  }

  const overall =
    rows.length === 0
      ? 1
      : rows.reduce((sum, row) => sum + (row.presence + row.correctField + row.completeness) / 3, 0) /
        rows.length;

  return { rows, overall };
}

async function loadFixtures() {
  const entries = await readdir(FIXTURES_DIR, { withFileTypes: true });
  const fixtureDirs = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);

  const fixtures = [];
  const skipped = [];

  for (const name of fixtureDirs) {
    const dir = path.join(FIXTURES_DIR, name);
    const files = await readdir(dir);
    const documentFile = files.find((file) => file.startsWith("document."));
    const expectedFile = files.includes("expected.json") ? "expected.json" : null;

    if (!documentFile || !expectedFile) {
      skipped.push(name);
      continue;
    }

    const ext = path.extname(documentFile).toLowerCase();
    const mimeType = EXTENSION_MIME_TYPES[ext];
    if (!mimeType) {
      console.warn(`eval-import: fixture "${name}" heeft een onbekende extensie (${ext}), overgeslagen.`);
      skipped.push(name);
      continue;
    }

    const buffer = await readFile(path.join(dir, documentFile));
    const expected = JSON.parse(await readFile(path.join(dir, expectedFile), "utf-8"));
    fixtures.push({ name, buffer, mimeType, filename: documentFile, expectedFields: expected.fields ?? {} });
  }

  return { fixtures, skipped };
}

async function main() {
  const dirExists = await stat(FIXTURES_DIR).catch(() => null);
  if (!dirExists) {
    console.error(`eval-import: fixtures-map niet gevonden: ${FIXTURES_DIR}`);
    process.exit(1);
  }

  const { fixtures, skipped } = await loadFixtures();

  if (skipped.length > 0) {
    console.warn(
      `eval-import: ${skipped.length} fixture(s) overgeslagen (geen document.* + expected.json): ${skipped.join(", ")}`,
    );
  }

  if (fixtures.length === 0) {
    console.warn("eval-import: geen bruikbare fixtures gevonden — niets om te evalueren.");
    return;
  }

  const results = [];

  for (const fixture of fixtures) {
    process.stdout.write(`\n=== ${fixture.name} ===\n`);
    try {
      const normalized = await normalizeForImport(fixture.buffer, fixture.mimeType, fixture.filename);
      const { activity } = await extractActivityFromDocument(normalized.input, fixture.name);
      const { rows, overall } = scoreFixture(activity, fixture.expectedFields);

      for (const row of rows) {
        console.log(
          `  ${row.fieldName.padEnd(20)} aanwezig=${row.presence.toFixed(2)}  juisteVeld=${row.correctField.toFixed(2)}  volledigheid=${row.completeness.toFixed(2)}`,
        );
      }
      console.log(`  -> totaalscore: ${overall.toFixed(2)}`);

      results.push({ name: fixture.name, overall });
    } catch (cause) {
      console.error(`  FOUT tijdens verwerken van "${fixture.name}":`, cause instanceof Error ? cause.message : cause);
      results.push({ name: fixture.name, overall: 0 });
    }
  }

  const average = results.reduce((sum, result) => sum + result.overall, 0) / results.length;
  console.log(`\n=== Totaal (${results.length} fixture(s), gemiddelde score: ${average.toFixed(2)}) ===`);
  for (const result of results) {
    console.log(`  ${result.name.padEnd(30)} ${result.overall.toFixed(2)}`);
  }

  if (average < SCORE_THRESHOLD) {
    console.error(`\neval-import: gemiddelde score ${average.toFixed(2)} ligt onder de drempel (${SCORE_THRESHOLD}).`);
    process.exit(1);
  }

  console.log(`\neval-import: geslaagd (drempel: ${SCORE_THRESHOLD}).`);
}

main().catch((cause) => {
  console.error("eval-import: onverwachte fout:", cause);
  process.exit(1);
});
