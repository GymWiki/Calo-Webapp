// Automatische indeling van een 3D-item in de nieuwe bibliotheekstructuur
// (lib/constants/libraryTaxonomy.ts), op basis van de OUDE categorie, de
// slug/naam en trefwoorden. Pure functie: gebruikt door
//   - scripts/migrate-categories.mts (eenmalige migratie + review-rapport),
//   - lib/services/materialModels.ts (terugval zolang de nieuwe kolommen
//     nog niet in Supabase staan of een item nog niet is ingedeeld).
//
// Onzekere gevallen krijgen `zeker: false` met een `reden`; het
// migratiescript zet die in docs/category-migration-review.md in plaats van
// stilletjes te gokken.

import { PERSONS_ID } from "@/lib/constants/libraryTaxonomy";

export type ClassifyInput = {
  slug: string;
  naam: string;
  /** De oorspronkelijke (vrije-tekst) categorie uit material_models. */
  categorie_oud: string;
};

export type Classification = {
  categorie: string;
  subgroep: string | null;
  sporten: string[];
  tags: string[];
  zeker: boolean;
  /** Alleen gezet als `zeker` false is (of als toelichting bij een keuze). */
  reden: string | null;
};

type Placement = {
  categorie: string;
  subgroep?: string;
  reden?: string;
  /** Overschrijft de uit de naam afgeleide sporten. */
  sporten?: string[];
};

type Rule = {
  /** Match op de oude categorie (één van), optioneel. */
  oud?: string[];
  /** Match op de slug, optioneel. */
  slug?: RegExp;
  place: Placement;
};

// Volgorde is belangrijk: de eerste regel die matcht wint.
const RULES: Rule[] = [
  { slug: /^(leerling|leerkracht)/, place: { categorie: PERSONS_ID, sporten: ["algemeen"] } },

  // Accessoires zonder duidelijke plek.
  {
    oud: ["accessoires_doelobjecten"],
    slug: /^tafeltennisbal/,
    place: { categorie: "ballen", subgroep: "overig", reden: "Accessoire én bal: bij Ballen gezet" },
  },
  {
    oud: ["accessoires_doelobjecten"],
    place: { categorie: "klein_materiaal", subgroep: "overig", reden: "Accessoire zonder eigen categorie: bij Klein materiaal gezet" },
  },

  // Airtrack/airblock: mat of toestel.
  {
    slug: /^(airtrack|airblock)/,
    place: { categorie: "matten", reden: "Airtrack/airblock is zowel mat als toestel: bij Matten gezet" },
  },

  // Doelen & netten.
  { oud: ["badminton", "basketbal", "korfbal", "volleybal"], place: { categorie: "doelen_netten" } },
  {
    oud: ["doelen"],
    slug: /^zaalhockeybalken_transportwagen/,
    place: { categorie: "opslag_karren", reden: "Transportwagen voor hockeybalken: bij Opslag & karren gezet" },
  },
  {
    oud: ["doelen"],
    slug: /^zaalhockeybalk/,
    place: {
      categorie: "klein_materiaal",
      subgroep: "afzetten",
      reden: "Zaalhockeybalken zijn banden/afzetting, geen doel: bij Klein materiaal > Afzetten gezet",
    },
  },
  { oud: ["doelen"], place: { categorie: "doelen_netten" } },

  // Toestellen.
  { oud: ["banken"], place: { categorie: "toestellen", subgroep: "banken" } },
  { oud: ["turnkast"], place: { categorie: "toestellen", subgroep: "kasten" } },
  { oud: ["brug", "rekstok", "ringenstel"], place: { categorie: "toestellen", subgroep: "hangen_zwaaien" } },
  { oud: ["evenwichtsbalk"], place: { categorie: "toestellen", subgroep: "balanceren" } },
  { oud: ["klimmen"], place: { categorie: "toestellen", subgroep: "klimmen" } },
  {
    oud: ["springbok", "springpaard_voltigepaard", "springen", "plankoline", "trampoline"],
    place: { categorie: "toestellen", subgroep: "springen" },
  },

  // Matten en opslag.
  { oud: ["matten"], place: { categorie: "matten" } },
  { oud: ["opslag"], place: { categorie: "opslag_karren" } },

  // Organisatiemateriaal: klein (fluit) of opslag/organisatie.
  { oud: ["organisatiemateriaal"], slug: /fluit/, place: { categorie: "klein_materiaal", subgroep: "overig" } },
  {
    oud: ["organisatiemateriaal"],
    slug: /^(scorebord|tactiekbord|whiteboard|zaaltimer|zandlopers|megafoon|klembord)/,
    place: {
      categorie: "opslag_karren",
      reden: "Organisatiemateriaal dat geen opslag is: bij Opslag & karren gezet (\"ander organisatiemateriaal\")",
    },
  },
  { oud: ["organisatiemateriaal"], place: { categorie: "opslag_karren" } },

  // Signaleringsmateriaal wordt Klein materiaal.
  {
    oud: ["signaleringsmateriaal"],
    slug: /^scorebord/,
    place: {
      categorie: "opslag_karren",
      reden: "Scorebord is organisatiemateriaal: bij Opslag & karren gezet (zoals het verrijdbare scorebord)",
    },
  },
  {
    oud: ["signaleringsmateriaal"],
    slug: /^(pion|dopje|slalompalen|vloermarkering|hoekvlag|grensrechter|start_finish)/,
    place: { categorie: "klein_materiaal", subgroep: "afzetten" },
  },
  { oud: ["signaleringsmateriaal"], place: { categorie: "klein_materiaal", subgroep: "overig" } },

  // Sticks en rackets staan niet in de opgegeven lijst.
  {
    oud: ["sticks_rackets"],
    place: {
      categorie: "klein_materiaal",
      subgroep: "sticks_rackets",
      reden: "Sticks en rackets staan niet in de lijst met categorieën: bij Klein materiaal > Sticks & rackets gezet",
    },
  },

  // Fitness met uitzonderingen.
  { oud: ["fitness_losse_materialen"], slug: /^springtouw/, place: { categorie: "klein_materiaal", subgroep: "overig" } },
  {
    oud: ["fitness_losse_materialen"],
    slug: /(fitnessmat|yogamat)/,
    place: { categorie: "fitness", reden: "Mat: kan bij Matten of Fitness; bij Fitness gelaten (oude categorie)" },
  },
  {
    oud: ["fitness_losse_materialen"],
    slug: /^plyobox/,
    place: { categorie: "fitness", reden: "Plyobox: kan bij Fitness of Toestellen > Springen; bij Fitness gelaten (oude categorie)" },
  },
  { oud: ["fitness_losse_materialen"], place: { categorie: "fitness" } },

  // Ballen met subgroepen.
  { oud: ["ballen"], slug: /basketbal/, place: { categorie: "ballen", subgroep: "basketbal" } },
  { oud: ["ballen"], slug: /(voetbal|futsal|plofbal)/, place: { categorie: "ballen", subgroep: "voetbal" } },
  { oud: ["ballen"], slug: /(volleybal|handbal)/, place: { categorie: "ballen", subgroep: "volley_hand" } },
  {
    oud: ["ballen"],
    slug: /^korfbal/,
    place: { categorie: "ballen", subgroep: "overig", reden: "Korfbal past in geen van de vaste subgroepen (Basketbal, Voetbal, Volley/Hand): bij Overig gezet" },
  },
  { oud: ["ballen"], place: { categorie: "ballen", subgroep: "overig" } },
];

// Sporten afleiden uit slug-trefwoorden. Eén item kan meerdere sporten hebben.
const SPORT_KEYWORDS: [RegExp, string[]][] = [
  [/basketbal/, ["basketbal"]],
  [/korfbal/, ["korfbal"]],
  [/(badminton|shuttle)/, ["badminton"]],
  [/volleybal/, ["volleybal"]],
  [/(voetbal|futsal|plofbal|hoekvlag|cornervlag|grensrechter)/, ["voetbal"]],
  [/handbal/, ["handbal"]],
  [/(?<!uni)hockey/, ["hockey"]],
  [/(floorball|unihockey)/, ["floorball"]],
  [/(tennis|padel|squash|pickleball|crossminton|tafeltennis)/, ["racketsport"]],
  [/(honkbal|softbal|slagbal|cricket|batting|slagplank)/, ["slagspelen"]],
  [/(dodgeball|foambal|kin_ball|trefbal|reactiebal|slow_motion)/, ["trefspelen"]],
  [/(start_finish|atletiek)/, ["atletiek"]],
];

const TAG_KEYWORDS: [RegExp, string[]][] = [
  [/(pion|dopje|slalompalen|vloermarkering)/, ["lijn afzetten", "afzetten", "markeren"]],
  [/hoepel/, ["hoepel"]],
  [/net(_|$)|volleybalnet|badmintonnet|klimnet/, ["net"]],
  [/(evenwichtsbalk|bosu|balanstrainer)/, ["balans"]],
  [/(hangend|touwladder|klimtouw|rekstok|ringen)/, ["hangen"]],
  [/(kar|rek_|ballenrek|opberg|transportwagen)/, ["opbergen", "transport"]],
  [/(mat_|^mat|turnmat|_mat$|matten)/, ["mat"]],
  [/(trampoline|springplank|springbok|springpaard|minitrampoline)/, ["springen"]],
  [/(hesjes|teamlintjes)/, ["teamkleuren", "hesjes"]],
  [/fluit/, ["fluit", "geluid"]],
  [/(stopwatch|timer|zandloper)/, ["tijd", "timing"]],
  [/scorebord/, ["score"]],
  [/(racket|batje|paddle)/, ["racket"]],
  [/(stick|knuppel|crosse|bat$)/, ["stick"]],
  [/(doel|korfbalpaal|korfbalmand|basketbalbord|basketbaltoren)/, ["doel"]],
];

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function deriveSports(slug: string, categorie: string, oud: string): string[] {
  const sports: string[] = [];
  for (const [pattern, ids] of SPORT_KEYWORDS) if (pattern.test(slug)) sports.push(...ids);
  if (oud === "badminton" || oud === "basketbal" || oud === "korfbal" || oud === "volleybal") sports.push(oud);
  if (categorie === "toestellen") {
    sports.push("turnen");
    if (oud === "klimmen") sports.push("klimmen");
  } else if (categorie === "matten" && oud !== "fitness_losse_materialen") sports.push("turnen");
  else if (categorie === "fitness") sports.push("fitness");
  else if (/^springtouw/.test(slug)) sports.push("fitness");
  return sports.length > 0 ? unique(sports) : ["algemeen"];
}

function deriveTags(slug: string, naam: string, sporten: string[]): string[] {
  const tags: string[] = [];
  for (const [pattern, ids] of TAG_KEYWORDS) if (pattern.test(slug)) tags.push(...ids);
  if (/(jeugd|junior|school)/.test(slug)) tags.push("jeugd");
  if (/senior/.test(slug)) tags.push("senior");
  if (/^(zaal|volleybal_zaal)/.test(slug) || /zaal/.test(slug)) tags.push("binnen");
  if (/^(veld|strand)/.test(slug) || /(veld_maat|beach)/.test(slug)) tags.push("buiten");
  for (const sport of sporten) if (sport !== "algemeen") tags.push(sport);
  tags.push(...naam.toLowerCase().split(/[^a-z0-9à-ÿ]+/).filter((word) => word.length > 3 && !/^\d+$/.test(word)));
  return unique(tags);
}

/** Deelt één item in. Nooit leeg: onbekende oude categorieën → onzeker. */
export function classifyModel(input: ClassifyInput): Classification {
  const slug = input.slug.toLowerCase();
  const oud = input.categorie_oud;

  const rule = RULES.find((candidate) => {
    if (candidate.oud && !candidate.oud.includes(oud)) return false;
    if (candidate.slug && !candidate.slug.test(slug)) return false;
    return true;
  });

  if (!rule) {
    const sporten = deriveSports(slug, "klein_materiaal", oud);
    return {
      categorie: "klein_materiaal",
      subgroep: "overig",
      sporten,
      tags: deriveTags(slug, input.naam, sporten),
      zeker: false,
      reden: `Onbekende oude categorie "${oud}": voorlopig bij Klein materiaal gezet`,
    };
  }

  const { place } = rule;
  const sporten = place.sporten ?? deriveSports(slug, place.categorie, oud);
  return {
    categorie: place.categorie,
    subgroep: place.subgroep ?? null,
    sporten,
    tags: deriveTags(slug, input.naam, sporten),
    zeker: !place.reden,
    reden: place.reden ?? null,
  };
}
