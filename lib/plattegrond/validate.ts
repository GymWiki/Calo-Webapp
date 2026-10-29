// Valideert, migreert en normaliseert een geïmporteerd plattegrond-bestand. Gebruikt het bestaande zod-schema
// (types/floorplan3d.ts) — dezelfde regels als bij opslaan — en geeft Nederlandse meldingen met pad en reden terug.
// Zonder DOM/React, dus ook bruikbaar vanuit het CLI-script (scripts/import-plattegrond.mts).

import { upgradeStudentItems } from "@/lib/students/catalog";
import type { ZodIssue } from "zod";

import { FORMAT_NAME, FORMAT_VERSION } from "@/lib/plattegrond/format";
import { floorplan3dDataSchema, type Floorplan3dData } from "@/types/floorplan3d";

export const MAX_FILE_BYTES = 2_000_000;
const MAX_ISSUES = 20;

export type Issue = { path: string; message: string };

export type ImportWarning = {
  code: "onbekend-item" | "buiten-zaal" | "dubbel-id" | "zonder-envelope" | "gemigreerd";
  message: string;
};

export type ImportOk = {
  ok: true;
  scene: Floorplan3dData;
  title: string;
  source: "envelope" | "scene";
  warnings: ImportWarning[];
  /** Slugs die niet in de catalogus staan (die items zijn weggelaten), met aantal. */
  unknownItems: { slug: string; count: number }[];
  /** Id's van items waarvan het midden buiten de zaal ligt (de editor schuift ze terug). */
  outsideRoom: string[];
  migratedFrom?: number;
};
export type ImportFailed = { ok: false; errors: Issue[] };
export type ImportResult = ImportOk | ImportFailed;

/** Migraties van een oudere formaatversie naar de volgende. Nu is er alleen versie 1; voeg hier `1: (scene) => …` toe bij versie 2. */
export type SceneMigration = (scene: Record<string, unknown>) => Record<string, unknown>;
export const MIGRATIONS: Record<number, SceneMigration> = {};

export type ParseOptions = {
  /** Slugs uit de catalogus. `null`/weglaten = niet controleren (bijv. CLI zonder database). */
  knownSlugs?: ReadonlySet<string> | null;
  currentVersion?: number;
  migrations?: Record<number, SceneMigration>;
};

const fail = (path: string, message: string): ImportFailed => ({ ok: false, errors: [{ path, message }] });
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const TYPE_NL: Record<string, string> = {
  string: "tekst",
  number: "een getal",
  boolean: "ja/nee",
  array: "een lijst",
  object: "een object",
  undefined: "leeg",
  null: "leeg",
  nan: "geen getal",
};
const typeNl = (type: string) => TYPE_NL[type] ?? type;

function formatPath(prefix: string, path: (string | number)[]): string {
  return path.reduce<string>((acc, part) => (typeof part === "number" ? `${acc}[${part}]` : acc ? `${acc}.${part}` : String(part)), prefix) || "(bestand)";
}

export function issueToDutch(issue: ZodIssue): string {
  switch (issue.code) {
    case "invalid_type":
      return issue.received === "undefined" ? "ontbreekt (verplicht)" : `moet ${typeNl(issue.expected)} zijn, maar is ${typeNl(issue.received)}`;
    case "too_small":
      if (issue.type === "string") return issue.minimum === 1 ? "mag niet leeg zijn" : `moet minstens ${issue.minimum} tekens hebben`;
      if (issue.type === "array") return `moet minstens ${issue.minimum} onderdelen hebben`;
      return issue.inclusive ? `moet minstens ${issue.minimum} zijn` : `moet groter zijn dan ${issue.minimum}`;
    case "too_big":
      if (issue.type === "string") return `mag maximaal ${issue.maximum} tekens hebben`;
      if (issue.type === "array") return `mag maximaal ${issue.maximum} onderdelen hebben`;
      return issue.inclusive ? `mag maximaal ${issue.maximum} zijn` : `moet kleiner zijn dan ${issue.maximum}`;
    case "invalid_enum_value":
      return `moet een van ${issue.options.map((o) => `"${o}"`).join(", ")} zijn, maar is "${String(issue.received)}"`;
    case "invalid_literal":
      return `moet ${JSON.stringify(issue.expected)} zijn`;
    case "invalid_string":
      return issue.validation === "regex" ? "heeft een ongeldig formaat (kleuren zijn #rrggbb)" : "heeft een ongeldig formaat";
    case "invalid_union":
      return "heeft een ongeldige waarde";
    default:
      return issue.message;
  }
}

function toIssues(issues: ZodIssue[], prefix: string): Issue[] {
  return issues.slice(0, MAX_ISSUES).map((issue) => ({ path: formatPath(prefix, issue.path), message: issueToDutch(issue) }));
}

/**
 * Leest de inhoud van een exportbestand (of een kaal scene-object, bijv. de kolom `data` uit Supabase).
 * Weigert wat niet te redden is; onbekende items, items buiten de zaal en dubbele id's worden waarschuwingen.
 */
export function parsePlattegrondJson(text: string, options: ParseOptions = {}): ImportResult {
  const currentVersion = options.currentVersion ?? FORMAT_VERSION;
  const migrations = options.migrations ?? MIGRATIONS;

  if (text.length > MAX_FILE_BYTES) return fail("(bestand)", `Het bestand is te groot (maximaal ${Math.round(MAX_FILE_BYTES / 1_000_000)} MB).`);
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    return fail("(bestand)", `Dit is geen geldige JSON: ${error instanceof Error ? error.message : "onleesbaar"}.`);
  }
  if (!isRecord(raw)) return fail("(bestand)", "Het bestand moet een JSON-object zijn met een plattegrond erin.");

  const warnings: ImportWarning[] = [];
  let sceneRaw: unknown;
  let title = "Geïmporteerde plattegrond";
  let source: "envelope" | "scene" = "envelope";
  let prefix = "scene";
  let migratedFrom: number | undefined;

  if ("format" in raw) {
    if (raw.format !== FORMAT_NAME) return fail("format", `moet "${FORMAT_NAME}" zijn, maar is ${JSON.stringify(raw.format)}. Dit is geen GymWiki-plattegrond.`);
    const version = raw.version;
    if (typeof version !== "number" || !Number.isInteger(version) || version < 1) return fail("version", "moet een geheel getal vanaf 1 zijn (de formaatversie).");
    if (version > currentVersion) {
      return fail("version", `Dit bestand heeft formaatversie ${version}, maar deze versie van GymWiki begrijpt tot en met versie ${currentVersion}. Werk GymWiki bij of exporteer het bestand opnieuw.`);
    }
    if (typeof raw.title === "string" && raw.title.trim()) title = raw.title.trim().slice(0, 100);
    if (!isRecord(raw.scene)) return fail("scene", raw.scene === undefined ? "ontbreekt (verplicht)" : "moet een object zijn met de plattegrond (room, items, coneFields)");
    let scene: Record<string, unknown> = raw.scene;
    for (let v = version; v < currentVersion; v += 1) {
      const migrate = migrations[v];
      if (!migrate) return fail("version", `Er is geen migratie van formaatversie ${v} naar ${v + 1}; het bestand kan niet worden geladen.`);
      scene = migrate(scene);
    }
    if (version < currentVersion) {
      migratedFrom = version;
      warnings.push({ code: "gemigreerd", message: `Oudere formaatversie (${version}) automatisch omgezet naar versie ${currentVersion}.` });
    }
    sceneRaw = scene;
  } else if ("room" in raw && "items" in raw) {
    // Kaal scene-object (bijvoorbeeld de kolom `data` rechtstreeks uit Supabase geplakt).
    source = "scene";
    prefix = "";
    sceneRaw = { version: currentVersion, ...raw };
    warnings.push({ code: "zonder-envelope", message: "Dit bestand heeft geen GymWiki-envelope; het is gelezen als kale plattegrond-data." });
  } else {
    return fail("(bestand)", `Dit lijkt geen GymWiki-plattegrond: het veld "format" ("${FORMAT_NAME}") ontbreekt en er is geen "room"/"items" gevonden.`);
  }

  const parsed = floorplan3dDataSchema.safeParse(sceneRaw);
  if (!parsed.success) return { ok: false, errors: toIssues(parsed.error.issues, prefix) };
  const scene = parsed.data;

  // Dubbele id's (items en afgezette velden delen één selectie-id): hernoemen i.p.v. weigeren.
  const seen = new Set<string>();
  const dedupe = <T extends { id: string }>(list: T[]): T[] =>
    list.map((entry) => {
      let id = entry.id;
      let n = 2;
      while (seen.has(id)) id = `${entry.id}-${n++}`;
      seen.add(id);
      if (id !== entry.id) warnings.push({ code: "dubbel-id", message: `Dubbel id "${entry.id}" hernoemd naar "${id}".` });
      return id === entry.id ? entry : { ...entry, id };
    });
  // Oude leerling-slugs (laagpoly, kleurvarianten) worden de standaard leerling.
  let items = dedupe(upgradeStudentItems(scene.items));
  const coneFields = dedupe(scene.coneFields);

  // Onbekende items: laat de rest staan, meld de slugs.
  const unknownItems: { slug: string; count: number }[] = [];
  if (options.knownSlugs) {
    const counts = new Map<string, number>();
    items = items.filter((item) => {
      if (options.knownSlugs!.has(item.slug)) return true;
      counts.set(item.slug, (counts.get(item.slug) ?? 0) + 1);
      return false;
    });
    for (const [slug, count] of counts) unknownItems.push({ slug, count });
    if (unknownItems.length > 0) {
      const total = unknownItems.reduce((sum, u) => sum + u.count, 0);
      warnings.push({ code: "onbekend-item", message: `${total} ${total === 1 ? "item is" : "items zijn"} weggelaten omdat ${unknownItems.length === 1 ? "het materiaal" : "de materialen"} niet in de bibliotheek ${unknownItems.length === 1 ? "staat" : "staan"}: ${unknownItems.map((u) => u.slug).join(", ")}.` });
    }
  }

  // Buiten de zaal: alleen melden; de editor schuift ze terug met zijn eigen botsingslogica.
  const halfW = scene.room.width_m / 2;
  const halfL = scene.room.length_m / 2;
  const outsideRoom = items.filter((item) => Math.abs(item.x) > halfW || Math.abs(item.z) > halfL).map((item) => item.id);
  if (outsideRoom.length > 0) {
    warnings.push({ code: "buiten-zaal", message: `${outsideRoom.length} ${outsideRoom.length === 1 ? "item staat" : "items staan"} buiten de zaal (${scene.room.width_m} × ${scene.room.length_m} m) en ${outsideRoom.length === 1 ? "wordt" : "worden"} teruggeschoven.` });
  }

  return { ok: true, scene: { ...scene, items, coneFields }, title, source, warnings, unknownItems, outsideRoom, migratedFrom };
}
