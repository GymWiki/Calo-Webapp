// CSV-uitwisseling voor het in bulk aanpassen van de indeling van 3D-items
// (scripts/library-taxonomy-csv.mts). Puntkomma als scheidingsteken (opent
// direct goed in Nederlandse Excel); sporten en tags gescheiden door "|".
// Puur, zodat het te testen is (csv.test.ts).

import { validateTaxonomy } from "@/lib/constants/libraryTaxonomy";

export const CSV_COLUMNS = ["slug", "naam", "categorie", "subgroep", "sporten", "tags"] as const;
export const CSV_DELIMITER = ";";

export type TaxonomyRow = {
  slug: string;
  naam: string;
  categorie: string;
  subgroep: string | null;
  sporten: string[];
  tags: string[];
};

function escapeCell(value: string): string {
  return /[";\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function serializeCsv(rows: TaxonomyRow[]): string {
  const lines = [CSV_COLUMNS.join(CSV_DELIMITER)];
  for (const row of rows) {
    lines.push(
      [row.slug, row.naam, row.categorie, row.subgroep ?? "", row.sporten.join("|"), row.tags.join("|")]
        .map(escapeCell)
        .join(CSV_DELIMITER),
    );
  }
  return `${lines.join("\n")}\n`;
}

/** Splitst CSV-tekst in cellen; ondersteunt aanhalingstekens, "" als escape en \r\n. */
export function parseCsvCells(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const input = text.replace(/^﻿/, "");

  for (let index = 0; index < input.length; index++) {
    const char = input[index];
    if (quoted) {
      if (char === '"' && input[index + 1] === '"') {
        cell += '"';
        index++;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === CSV_DELIMITER) {
      row.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && input[index + 1] === "\n") index++;
      row.push(cell);
      cell = "";
      if (row.some((value) => value.trim() !== "")) rows.push(row);
      row = [];
    } else {
      cell += char;
    }
  }
  row.push(cell);
  if (row.some((value) => value.trim() !== "")) rows.push(row);
  return rows;
}

function splitList(value: string): string[] {
  return value
    .split("|")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

export type ParsedCsv = {
  rows: TaxonomyRow[];
  /** Fouten per regel (1-gebaseerd, incl. kopregel); ongeldige regels zitten niet in `rows`. */
  errors: { line: number; slug: string; messages: string[] }[];
};

/** Leest en valideert een CSV; de kolomvolgorde mag afwijken zolang de kopnamen kloppen. */
export function parseCsv(text: string): ParsedCsv {
  const cells = parseCsvCells(text);
  if (cells.length === 0) return { rows: [], errors: [{ line: 1, slug: "", messages: ["leeg bestand"] }] };

  const header = cells[0].map((name) => name.trim().toLowerCase());
  const missing = CSV_COLUMNS.filter((column) => !header.includes(column));
  if (missing.length > 0) {
    return { rows: [], errors: [{ line: 1, slug: "", messages: [`kolommen ontbreken: ${missing.join(", ")}`] }] };
  }
  const col = (row: string[], name: (typeof CSV_COLUMNS)[number]) => (row[header.indexOf(name)] ?? "").trim();

  const rows: TaxonomyRow[] = [];
  const errors: ParsedCsv["errors"] = [];
  const seen = new Set<string>();

  cells.slice(1).forEach((row, index) => {
    const line = index + 2;
    const slug = col(row, "slug");
    const parsed: TaxonomyRow = {
      slug,
      naam: col(row, "naam"),
      categorie: col(row, "categorie").toLowerCase(),
      subgroep: col(row, "subgroep").toLowerCase() || null,
      sporten: splitList(col(row, "sporten")),
      tags: splitList(col(row, "tags")),
    };
    const messages = validateTaxonomy(parsed);
    if (!slug) messages.unshift("slug ontbreekt");
    if (slug && seen.has(slug)) messages.push("dubbele slug");
    seen.add(slug);
    if (messages.length > 0) errors.push({ line, slug, messages });
    else rows.push(parsed);
  });

  return { rows, errors };
}
