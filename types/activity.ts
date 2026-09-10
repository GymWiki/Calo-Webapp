export type ActivityReviewStatus = "draft" | "pending" | "approved" | "rejected";

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
  // Genummerde leeruitkomsten, getoond in "Lesinhoud & Regels" — nullable en
  // voor de meeste rijen een lege array; alleen tonen als er items in staan.
  learning_outcomes: string[] | null;
  // null voor de oorspronkelijk geïmporteerde bibliotheek-activiteiten —
  // die hebben geen indiener. Alles wat via /activiteit-toevoegen binnenkomt
  // heeft een author_id.
  author_id: string | null;
  status: ActivityReviewStatus;
  rejection_reason: string | null;
  submitted_at: string;
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

// -- Toevoegen van een nieuwe activiteit (bijdrage-freemium-model) ---------

import { z } from "zod";

export const submitActivityInputSchema = z.object({
  titel: z.string().trim().min(3, "Titel moet minstens 3 tekens bevatten."),
  categorie: z.enum(CATEGORIE_WAARDEN, { message: "Kies een categorie." }),
  leerlijn: z.string().trim().min(1, "Leerlijn is verplicht."),
  doelgroep: z
    .array(z.number().int())
    .min(1, "Kies minstens één doelgroep."),
  beschrijving: z
    .string()
    .trim()
    .min(40, "Beschrijf de activiteit in minstens 40 tekens."),
  beginsituatie: z.string().trim(),
  doel: z.string().trim().min(1, "Doelstelling is verplicht."),
  veld: z.string().trim(),
  materiaal: z.array(z.string().trim().min(1)),
  regels: z.array(z.string().trim().min(1)),
  loopt: z.array(z.string().trim().min(1)),
  lukt: z.array(z.string().trim().min(1)),
  leeft: z.array(z.string().trim().min(1)),
});

export type SubmitActivityInput = z.infer<typeof submitActivityInputSchema>;
