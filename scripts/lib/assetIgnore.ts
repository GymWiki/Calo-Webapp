// Bestanden die de asset-scripts (import-materials, sync) bewust NIET meenemen.
// Eén plek, met een reden per regel, zodat een volgende run ze niet per ongeluk oppakt.
// Verwijder een regel pas als de eigenaar zegt dat het materiaal erbij mag.

export type IgnoreRule = {
  id: string;
  reason: string;
  /** Drive-/bronmappen (hoofdletterongevoelig) waarvan alle bestanden worden overgeslagen. */
  folders?: readonly string[];
  /** Voorvoegsels/trefwoorden in de bestandsnaam (slug), hoofdletterongevoelig. */
  nameIncludes?: readonly string[];
};

export const ASSET_IGNORE_RULES: readonly IgnoreRule[] = [
  {
    id: "zwembad",
    reason: "Zwembadmateriaal is nog niet goed (op verzoek van de eigenaar, 5 nov 2026): niet verwerken, registreren, uploaden of tonen.",
    folders: ["zwembad"],
    nameIncludes: [
      "zwembad",
      "zwem",
      "pool_noodle",
      "pullbuoy",
      "drijf",
      "duik",
      "waterpolo",
      "waterbasketbal",
      "reddingsboei",
      "reddingspop",
      "reddingsstang",
      "rescue_tube",
      "kickboard",
      "gatzeil",
      "kurkjes",
      "onderwaterhoepel",
    ],
  },
];

export type IgnoreMatch = { rule: IgnoreRule; why: string };

/** Geeft de regel terug die dit bestand uitsluit, of null. `folder` is de naam van de bronmap (als bekend). */
export function matchAssetIgnore(slugOrFileName: string, folder?: string | null): IgnoreMatch | null {
  const name = slugOrFileName.toLowerCase().replace(/\.[a-z0-9]+$/, "");
  for (const rule of ASSET_IGNORE_RULES) {
    if (folder && rule.folders?.some((candidate) => candidate.toLowerCase() === folder.toLowerCase())) return { rule, why: `map "${folder}"` };
    const hit = rule.nameIncludes?.find((part) => name.includes(part.toLowerCase()));
    if (hit) return { rule, why: `naam bevat "${hit}"` };
  }
  return null;
}
