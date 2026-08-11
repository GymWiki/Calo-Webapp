export type Activity = {
  id: string;
  titel: string;
  actcode: string | null;
  afbeelding: string | null;
  beginsituatie: string | null;
  beschrijving: string | null;
  categorie: string | null;
  beweegthema: string | null;
  doel: string | null;
  leerlijn: string | null;
  loopt: string[] | null;
  lukt: string[] | null;
  leeft: string[] | null;
  niveau: number | null;
  materiaal: string[] | null;
  onderwijs_type: string | null;
  veld: string | null;
  regels: string[] | null;
  doelgroep: number[] | null;
};

// `doelgroep` isn't a school-year number — it's a fixed 1-6 bucket code
// from the source system (see docs/superpowers/specs/2026-08-11-activiteiten-
// bibliotheek-design.md). 0 appears in the data but has no defined label.
export const DOELGROEP_LABELS: Record<number, string> = {
  1: "Groep 1/2",
  2: "Groep 3/4",
  3: "Groep 5/6",
  4: "Groep 7/8",
  5: "Onderbouw",
  6: "Bovenbouw",
};

export const DOELGROEP_WAARDEN = [1, 2, 3, 4, 5, 6] as const;

export const CATEGORIE_WAARDEN = [
  "Atletiek",
  "Spel",
  "Turnen",
  "Zelfverdediging",
  "Bewegen op muziek",
  "Overig",
] as const;
