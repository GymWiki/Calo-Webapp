// Materiaal-families: één kaart in de bibliotheek, de maat kies je na het plaatsen in het itempaneel.
//
// Aanpak "variant" (de enige die nu is gebouwd): elke maat is een eigen model met zijn eigen slug. Die slugs zijn de bestaande
// item-id's; ze veranderen NIET. Een geplaatst item behoudt dus `slug` in de plattegrond-JSON en een bestaande plattegrond laadt
// exact hetzelfde. De alias-tabel (slug → familie + maat) is hier afgeleid uit `maten[].slug`; er is geen datamigratie.
// Maatwissel = de slug van het geplaatste item vervangen door die van de gekozen maat (net als de pose van een leerling).
//
// `slug: null` = maat die nog geen model heeft: wordt niet getoond (geen gedimde knop) tot het model er is.
// `aliassen` = extra slugs die dezelfde maat zijn (bijv. een dubbel model): de bibliotheek verbergt ze, maar bestaande plattegronden
// met die slug laden ongewijzigd en tonen de maat als gewone maat van de familie.
// Weergave "kleur": de keuze is een kleur (bolletjes), niet een afmeting; elke kleur is een eigen model.
// Bronnen: zie docs/maten-families.md (met URL en datum, en wat ONBEKEND is).

export type FamilyMaat = {
  id: string;
  /** Label in het maatmenu (NL). */
  label: string;
  /** Slug van het model voor deze maat, of null als het model nog ontbreekt. */
  slug: string | null;
  /** Dubbele slugs die als deze maat tellen (verborgen in de bibliotheek, geldig in plattegronden). */
  aliassen?: readonly string[];
  /** Kleur (hex) voor weergave "kleur". */
  kleur?: string;
  /** Extra zoektermen (de familiekaart vindt alle maten). */
  zoektermen?: readonly string[];
};

export type ItemFamily = {
  id: string;
  /** Naam op de bibliotheekkaart. */
  naam: string;
  /** Maat-id die als eerste wordt geplaatst. */
  standaard: string;
  /** "segment" (≤ 5 maten), "lijst" (meer maten), "stepper" (plus/min, voor opeenvolgende delen) of "kleur" (kleurbolletjes). */
  weergave: "segment" | "lijst" | "stepper" | "kleur";
  /** Label boven de keuze, bv. "Maat" of "Kastdelen". */
  maatTitel: string;
  maten: readonly FamilyMaat[];
};

export const ITEM_FAMILIES: readonly ItemFamily[] = [
  {
    id: "basketbal",
    naam: "Basketbal",
    standaard: "maat_5",
    weergave: "segment",
    maatTitel: "Maat",
    maten: [
      { id: "maat_5", label: "Maat 5", slug: "basketbal_maat_5", zoektermen: ["maat 5", "kinderen", "jeugd"] },
      { id: "maat_6", label: "Maat 6", slug: null, zoektermen: ["maat 6", "dames", "meisjes"] },
      { id: "maat_7", label: "Maat 7", slug: "basketbal_maat_7", zoektermen: ["maat 7", "heren", "senior"] },
    ],
  },
  {
    id: "turnkast",
    naam: "Turnkast",
    standaard: "delen_4",
    weergave: "stepper",
    maatTitel: "Kastdelen",
    maten: [
      { id: "delen_1", label: "1 deel (kastkop)", slug: "turnkast_1_delig_kastkop", zoektermen: ["1 delig", "kastkop", "leer"] },
      { id: "delen_2", label: "2 delen", slug: "turnkast_2_delig", zoektermen: ["2 delig", "2 delen"] },
      { id: "delen_3", label: "3 delen", slug: "turnkast_3_delig", zoektermen: ["3 delig", "3 delen"] },
      { id: "delen_4", label: "4 delen", slug: "turnkast_4_delig", zoektermen: ["4 delig", "4 delen"] },
      { id: "delen_5", label: "5 delen", slug: "turnkast_5_delig", aliassen: ["turnkast_140x83x114"], zoektermen: ["5 delig", "5 delen"] },
      { id: "delen_6", label: "6 delen", slug: "turnkast_6_delig_1_recht", zoektermen: ["6 delig", "6 delen"] },
      { id: "delen_7", label: "7 delen", slug: "turnkast_7_delig_2_recht", zoektermen: ["7 delig", "7 delen"] },
    ],
  },
  {
    id: "foambal",
    naam: "Foambal",
    standaard: "middel",
    weergave: "segment",
    maatTitel: "Maat",
    maten: [
      { id: "klein", label: "Klein (7 cm)", slug: "foambal_klein_7cm", zoektermen: ["7 cm"] },
      { id: "middel", label: "Middel (16 cm)", slug: "foambal_middel_16cm", zoektermen: ["16 cm"] },
      { id: "groot", label: "Groot (20 cm)", slug: "foambal_groot_20cm", zoektermen: ["20 cm"] },
    ],
  },
  {
    id: "veldhockeydoel",
    naam: "Veldhockeydoel",
    standaard: "volwassen",
    weergave: "segment",
    maatTitel: "Maat",
    maten: [
      { id: "jeugd", label: "Jeugd (1,80 × 1,20 m)", slug: "veldhockeydoel_180x120_jeugd", zoektermen: ["jeugd", "1,80", "180"] },
      { id: "volwassen", label: "Volwassen (3,66 × 2,14 m)", slug: "veldhockeydoel_366x214_verplaatsbaar", zoektermen: ["volwassen", "3,66", "366"] },
    ],
  },
  {
    id: "veldvoetbaldoel",
    naam: "Veldvoetbaldoel",
    standaard: "klein",
    weergave: "segment",
    maatTitel: "Maat",
    maten: [
      { id: "klein", label: "5,00 × 2,00 m", slug: "veldvoetbaldoel_500x200_verplaatsbaar", zoektermen: ["5 meter", "500"] },
      { id: "groot", label: "7,32 × 2,44 m", slug: "veldvoetbaldoel_732x244_verplaatsbaar", zoektermen: ["7,32", "732", "wedstrijd"] },
    ],
  },
  {
    id: "zaalhockeybalk",
    naam: "Zaalhockeybalk",
    standaard: "2m",
    weergave: "segment",
    maatTitel: "Lengte",
    maten: [
      { id: "2m", label: "2 m", slug: "zaalhockeybalk_los_2m", zoektermen: ["2 meter"] },
      { id: "4m", label: "4 m", slug: "zaalhockeybalk_los_4m", zoektermen: ["4 meter"] },
    ],
  },
  {
    id: "lange_mat",
    naam: "Lange mat (oprolbaar)",
    standaard: "6m",
    weergave: "segment",
    maatTitel: "Lengte",
    maten: [
      { id: "6m", label: "6 m", slug: "lange_mat_oprolbaar_6m_uitgerold", zoektermen: ["6 meter"] },
      { id: "12m", label: "12 m", slug: "lange_mat_oprolbaar_12m_uitgerold", zoektermen: ["12 meter"] },
    ],
  },
  {
    id: "korfbalpaal",
    naam: "Korfbalpaal met korf",
    standaard: "350",
    weergave: "segment",
    maatTitel: "Hoogte",
    maten: [
      { id: "250", label: "2,50 m", slug: "korfbalpaal_compleet_250", zoektermen: ["2,50", "250", "jeugd"] },
      { id: "350", label: "3,50 m", slug: "korfbalpaal_compleet_350", zoektermen: ["3,50", "350", "senior"] },
    ],
  },
  {
    id: "basketbaltoren",
    naam: "Basketbaltoren (mobiel)",
    standaard: "senior",
    weergave: "segment",
    maatTitel: "Uitvoering",
    maten: [
      { id: "jeugd", label: "Jeugd", slug: "basketbaltoren_mobiel_jeugd", zoektermen: ["jeugd"] },
      { id: "senior", label: "Senior", slug: "basketbaltoren_mobiel_senior", zoektermen: ["senior"] },
    ],
  },
  {
    id: "springbok",
    naam: "Springbok",
    standaard: "standaard",
    weergave: "segment",
    maatTitel: "Hoogte",
    maten: [
      { id: "laag", label: "Laag (80 cm)", slug: "springbok_laag_jeugd_80cm", zoektermen: ["80 cm", "jeugd"] },
      { id: "standaard", label: "Standaard (105 cm)", slug: "springbok_standaard_105cm", zoektermen: ["105 cm"] },
    ],
  },
  {
    id: "dodgeball",
    naam: "Dodgeball (vinyl)",
    standaard: "blauw",
    weergave: "kleur",
    maatTitel: "Kleur",
    maten: [
      { id: "blauw", label: "Blauw", kleur: "#2563eb", slug: "dodgeball_vinyl_blauw", zoektermen: ["trefbal", "blauwe"] },
      { id: "rood", label: "Rood", kleur: "#dc2626", slug: "dodgeball_vinyl_rood", zoektermen: ["trefbal", "rode"] },
    ],
  },
  {
    id: "foambal_olifantenhuid",
    naam: "Foambal olifantenhuid",
    standaard: "geel",
    weergave: "kleur",
    maatTitel: "Kleur",
    maten: [
      { id: "geel", label: "Geel", kleur: "#facc15", slug: "foambal_olifantenhuid_geel", zoektermen: ["gele", "foambal"] },
      { id: "rood", label: "Rood", kleur: "#dc2626", slug: "foambal_olifantenhuid_rood", zoektermen: ["rode", "foambal"] },
    ],
  },
  {
    id: "airtrack",
    naam: "Airtrack",
    standaard: "6m",
    weergave: "segment",
    maatTitel: "Lengte",
    maten: [
      { id: "6m", label: "6 m", slug: "airtrack_p2_6m", zoektermen: ["6 meter"] },
      { id: "12m", label: "12 m", slug: "airtrack_p2_12m", zoektermen: ["12 meter"] },
    ],
  },
  {
    id: "klimtouwen",
    naam: "Klimtouwen (hangend)",
    standaard: "2",
    weergave: "segment",
    maatTitel: "Aantal touwen",
    maten: [
      { id: "2", label: "2 touwen", slug: "klimtouwen_set_2_hangend", zoektermen: ["2 touwen"] },
      { id: "4", label: "4 touwen", slug: "klimtouwen_set_4_hangend", zoektermen: ["4 touwen"] },
    ],
  },
];

// Alias-tabel: bestaand item-id (slug) → familie + maat. Afgeleid, dus nooit uit de pas met `ITEM_FAMILIES`.
const ALIASES: ReadonlyMap<string, { family: ItemFamily; maat: FamilyMaat }> = new Map(
  ITEM_FAMILIES.flatMap((family) =>
    family.maten.flatMap((maat) => [...(maat.slug ? [maat.slug] : []), ...(maat.aliassen ?? [])].map((slug) => [slug, { family, maat }] as const)),
  ),
);

export function familyOfSlug(slug: string): { family: ItemFamily; maat: FamilyMaat } | null {
  return ALIASES.get(slug) ?? null;
}

export function familyById(id: string): ItemFamily | null {
  return ITEM_FAMILIES.find((family) => family.id === id) ?? null;
}

export function defaultMaat(family: ItemFamily): FamilyMaat {
  return family.maten.find((maat) => maat.id === family.standaard && maat.slug) ?? family.maten.find((maat) => maat.slug) ?? family.maten[0];
}
