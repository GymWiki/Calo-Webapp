// Families in de bibliotheek (puur, geen React): één kaart per familie met meer dan één beschikbaar model, en het maatmenu van het itempaneel.
// Config: lib/constants/itemFamilies.ts. Bestaande item-id's (slugs) blijven de enige sleutel in plattegronden.

import { defaultMaat, familyById, familyOfSlug, ITEM_FAMILIES, type FamilyMaat, type ItemFamily } from "@/lib/constants/itemFamilies";
import type { MaterialModel } from "@/types/materialModel";

/** Bibliotheekkaart: een gewoon model, met voor een familie de naam, het aantal maten en de zoektermen van alle maten. */
export type LibraryCardModel = MaterialModel & { familyId?: string; maten?: number; maatLabels?: string[]; kleurFamilie?: boolean };

function uniq<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

/**
 * Vervangt de losse leden van elke familie (die in `models` staan) door één kaart. De kaart gebruikt het model van de standaardmaat
 * (of anders het eerste aanwezige), de familienaam, de unie van de sporten en de namen/labels/zoektermen van alle maten, zodat zoeken
 * op "maat 5" of "4 delen" de familie vindt. Een familie met één aanwezig model blijft een gewoon item.
 * `memberToCard` verwijst elke lid-slug naar de slug van de kaart (voor recent en favorieten).
 */
export function buildFamilyCards(models: MaterialModel[]): { cards: LibraryCardModel[]; memberToCard: Map<string, string> } {
  const memberToCard = new Map<string, string>();
  const replaced = new Map<string, LibraryCardModel | null>(); // slug → kaart (eerste lid) of null (overige leden)
  const bySlug = new Map(models.map((model) => [model.slug, model]));

  for (const family of ITEM_FAMILIES) {
    const present = family.maten.flatMap((maat) => {
      const model = maat.slug ? bySlug.get(maat.slug) : undefined;
      return model && maat.slug ? [{ maat, model }] : [];
    });
    if (present.length < 2) continue;
    const base = (present.find((entry) => entry.maat.id === defaultMaat(family).id) ?? present[0]).model;
    const card: LibraryCardModel = {
      ...base,
      naam: family.naam,
      sporten: uniq(present.flatMap((entry) => entry.model.sporten)),
      tags: uniq([
        ...present.flatMap((entry) => entry.model.tags),
        ...present.flatMap((entry) => [entry.model.naam, entry.maat.label, ...(entry.maat.zoektermen ?? [])]),
      ]),
      familyId: family.id,
      maten: present.length,
      maatLabels: present.map((entry) => entry.maat.label),
      kleurFamilie: family.weergave === "kleur",
    };
    for (const entry of present) {
      memberToCard.set(entry.model.slug, base.slug);
      replaced.set(entry.model.slug, entry.model.slug === base.slug ? card : null);
      // Dubbele modellen van deze maat verdwijnen uit de bibliotheek (ze blijven geldig in plattegronden).
      for (const alias of entry.maat.aliassen ?? []) {
        memberToCard.set(alias, base.slug);
        replaced.set(alias, null);
      }
    }
  }

  const cards: LibraryCardModel[] = [];
  for (const model of models) {
    if (!replaced.has(model.slug)) cards.push(model);
    else {
      const card = replaced.get(model.slug);
      if (card) cards.push(card);
    }
  }
  return { cards, memberToCard };
}

/** Het model dat bij het plaatsen van een kaart hoort: de laatst gebruikte maat van die familie, anders de standaardmaat van de kaart. */
export function resolvePlacementModel(card: LibraryCardModel, models: MaterialModel[], lastUsed: Record<string, string>): MaterialModel {
  if (!card.familyId) return card;
  const family = familyById(card.familyId);
  const maatId = lastUsed[card.familyId];
  const maat = family?.maten.find((candidate) => candidate.id === maatId);
  const model = maat?.slug ? models.find((candidate) => candidate.slug === maat.slug) : undefined;
  return model ?? card;
}

export type MaatOption = { maat: FamilyMaat; model: MaterialModel; current: boolean };

/** Maatmenu voor een geplaatst item; null als het item niet bij een (bruikbare) familie hoort. Maten zonder model worden niet getoond. */
export function maatOptions(slug: string, models: MaterialModel[]): { family: ItemFamily; options: MaatOption[] } | null {
  const alias = familyOfSlug(slug);
  if (!alias) return null;
  const bySlug = new Map(models.map((model) => [model.slug, model]));
  const options = alias.family.maten.flatMap((maat): MaatOption[] => {
    const model = maat.slug ? bySlug.get(maat.slug) : undefined;
    return model ? [{ maat, model, current: maat === alias.maat }] : [];
  });
  if (options.length < 2) return null;
  return { family: alias.family, options };
}

/** Vervangt de slug door die van een andere maat van dezelfde familie; null als dat niet kan (andere familie of maat zonder model). */
export function slugForMaat(slug: string, maatId: string): string | null {
  const alias = familyOfSlug(slug);
  const target = alias?.family.maten.find((maat) => maat.id === maatId);
  return target?.slug ?? null;
}
