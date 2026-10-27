// Zoek-, filter- en groeperingslogica van de 3D-itembibliotheek. Puur (geen
// React), zodat het te testen is (search.test.ts) en hetzelfde werkt in
// de editor-sidebar, het mobiele drawer en eventuele beheerweergaven.

import {
  LIBRARY_CATEGORIES,
  LIBRARY_SPORTS,
  PERSONS_ID,
  sportLabel,
  subgroupLabel,
} from "@/lib/constants/libraryTaxonomy";

export type LibraryItemMeta = {
  slug: string;
  naam: string;
  categorie: string;
  subgroep: string | null;
  sporten: string[];
  tags: string[];
};

/** Lowercase, zonder accenten, alleen letters/cijfers en spaties. */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Grove Nederlandse enkelvoud-vorm: "ballen" → "bal", "pionnen" → "pion",
 * "dopjes" → "dopje", "matten" → "mat". Bewust simpel: dit hoeft alleen
 * query en trefwoord naar dezelfde stam te brengen, niet linguïstisch
 * correct te zijn.
 */
export function stemWord(word: string): string {
  let result = word;
  if (result.length > 4 && result.endsWith("en")) {
    result = result.slice(0, -2);
    if (result.length > 2 && result[result.length - 1] === result[result.length - 2]) result = result.slice(0, -1);
  } else if (result.length > 3 && result.endsWith("s") && !result.endsWith("ss")) {
    result = result.slice(0, -1);
  }
  return result;
}

/** Levenshtein-afstand met vroege stop zodra de afstand `max` overschrijdt. */
export function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const value = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
      current[j] = value;
      if (value < rowMin) rowMin = value;
    }
    if (rowMin > max) return max + 1;
    previous = current;
  }
  return previous[b.length];
}

function typoBudget(length: number): number {
  if (length < 4) return 0;
  return length >= 8 ? 2 : 1;
}

/** Past één zoekwoord op één trefwoord (stam, voorvoegsel of typfout)? */
function wordMatches(queryWord: string, queryStem: string, word: string): boolean {
  if (word.startsWith(queryWord) || word.startsWith(queryStem)) return true;
  // Samenstellingen: "paal" vindt "korfbalpaal", "toren" vindt "basketbaltoren".
  if (queryWord.length >= 4 && (word.includes(queryWord) || word.includes(queryStem))) return true;
  const stem = stemWord(word);
  if (stem === queryStem || stem.startsWith(queryStem)) return true;
  const budget = typoBudget(queryStem.length);
  if (budget === 0) return false;
  if (editDistance(queryStem, stem, budget) <= budget) return true;
  // Typfout terwijl je nog typt: vergelijk met het begin van het woord.
  if (word.length > queryWord.length && editDistance(queryWord, word.slice(0, queryWord.length), budget) <= budget) {
    return true;
  }
  return false;
}

function searchWords(item: LibraryItemMeta): string[] {
  const text = [
    item.naam,
    item.slug.replace(/_/g, " "),
    ...item.tags,
    ...item.sporten.map(sportLabel),
    item.subgroep ? subgroupLabel(item.categorie, item.subgroep) : "",
  ].join(" ");
  return [...new Set(normalizeText(text).split(" ").filter(Boolean))];
}

/** Elk zoekwoord moet iets in naam, tags, sport of subgroep raken (bewust niet de categorienaam: "mat" zou anders alles onder "materiaal" vinden). */
export function matchesQuery(item: LibraryItemMeta, query: string): boolean {
  const words = normalizeText(query).split(" ").filter(Boolean);
  if (words.length === 0) return true;
  const haystack = searchWords(item);
  return words.every((queryWord) => {
    const queryStem = stemWord(queryWord);
    return haystack.some((word) => wordMatches(queryWord, queryStem, word));
  });
}

export type LibraryFilter = { query: string; sports: string[] };

export function matchesSports(item: LibraryItemMeta, sports: string[]): boolean {
  return sports.length === 0 || sports.some((sport) => item.sporten.includes(sport));
}

export function filterItems<T extends LibraryItemMeta>(items: T[], filter: LibraryFilter): T[] {
  return items.filter((item) => matchesQuery(item, filter.query) && matchesSports(item, filter.sports));
}

export type SportCount = { id: string; label: string; count: number };

/**
 * Aantal resultaten per sport-chip, met de zoekopdracht toegepast maar het
 * sportfilter zelf niet — zo zie je altijd hoeveel je erbij krijgt als je een
 * chip aanzet. Sporten zonder items worden weggelaten.
 */
export function sportCounts(items: LibraryItemMeta[], query: string): { total: number; sports: SportCount[] } {
  const matching = items.filter((item) => matchesQuery(item, query));
  const sports = LIBRARY_SPORTS.map((sport) => ({
    id: sport.id,
    label: sport.label,
    count: matching.filter((item) => item.sporten.includes(sport.id)).length,
  })).filter((sport) => sport.count > 0);
  return { total: matching.length, sports };
}

export type CategoryGroup<T> = {
  id: string;
  label: string;
  items: T[];
  /** Alleen gevuld voor categorieën met subgroepen; items zonder subgroep staan onder "overig". */
  subgroups: { id: string; label: string; items: T[] }[];
};

/** Groepeert per hoofdcategorie in taxonomie-volgorde; personen blijven buiten. */
export function groupByCategory<T extends LibraryItemMeta>(items: T[]): CategoryGroup<T>[] {
  const sorted = [...items].sort((a, b) => a.naam.localeCompare(b.naam, "nl"));
  return LIBRARY_CATEGORIES.map((category) => {
    const inCategory = sorted.filter((item) => item.categorie === category.id);
    const subgroups = (category.subgroups ?? [])
      .map((subgroup) => ({
        id: subgroup.id,
        label: subgroup.label,
        items: inCategory.filter((item) => item.subgroep === subgroup.id),
      }))
      .filter((subgroup) => subgroup.items.length > 0);
    return { id: category.id, label: category.label, items: inCategory, subgroups };
  }).filter((group) => group.items.length > 0);
}

export function isPerson(item: LibraryItemMeta): boolean {
  return item.categorie === PERSONS_ID;
}
