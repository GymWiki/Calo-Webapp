import { z } from "zod";

import { stateToColumns } from "@/lib/beheer/state";

const text = (max: number) => z.string().trim().max(max).transform((v) => (v === "" ? null : v)).nullable();
const lines = z.array(z.string().trim().min(1).max(300)).max(60);
const smallInt = (max: number) => z.number().int().min(0).max(max).nullable();

/** Bewerkbare kolommen van public.activiteiten in het beheer (allowlist: alles daarbuiten kan hier nooit geschreven worden). */
export const activityEditSchema = z.object({
  titel: z.string().trim().min(1, "Titel is verplicht.").max(200),
  doel: text(4000),
  beginsituatie: text(4000),
  beschrijving: text(8000),
  arrangement: text(8000),
  aandachtspunten: text(8000),
  plaatje_praatje: text(8000),
  deelnemers_regels: text(8000),
  categorie: text(80),
  leerlijn: text(120),
  beweegthema: text(120),
  niveau: smallInt(10),
  doelgroep: z.array(z.number().int().min(0).max(6)).max(7),
  materiaal: lines,
  base_materials: lines,
  rule_materials: lines,
  regels: lines,
  loopt: lines,
  lukt: lines,
  leeft: lines,
  min_participants: smallInt(500),
  participants_bench: smallInt(500),
  afbeelding: z
    .string()
    .trim()
    .max(1000)
    .refine((v) => v === "" || /^https:\/\//.test(v), "Een afbeelding moet een https-adres zijn.")
    .transform((v) => (v === "" ? null : v))
    .nullable(),
});
export type ActivityEdit = z.infer<typeof activityEditSchema>;
export const EDITABLE_COLUMNS = Object.keys(activityEditSchema.shape) as (keyof ActivityEdit)[];

export const stateSchema = z.enum(["concept", "gepubliceerd", "gearchiveerd"]);

export const bulkSchema = z
  .object({
    ids: z.array(z.string().min(1).max(64)).min(1, "Kies minstens één activiteit.").max(200, "Maximaal 200 activiteiten tegelijk."),
    categorie: z.string().trim().min(1).max(80).optional(),
    leerlijn: z.string().trim().min(1).max(120).optional(),
    state: stateSchema.optional(),
  })
  .refine((v) => v.categorie !== undefined || v.leerlijn !== undefined || v.state !== undefined, "Kies minstens één aanpassing.");
export type BulkInput = z.infer<typeof bulkSchema>;

/** Kolommen die een bulkactie schrijft (voor de bevestiging vooraf en voor de actie zelf). */
export function bulkPatch(input: BulkInput): Record<string, string> {
  return {
    ...(input.categorie !== undefined ? { categorie: input.categorie } : {}),
    ...(input.leerlijn !== undefined ? { leerlijn: input.leerlijn } : {}),
    ...(input.state ? stateToColumns(input.state) : {}),
  };
}

/** Een auditlog-wijziging terugzetten mag alleen voor bewerkbare kolommen plus de status-/verwijderkolommen. */
export const RESTORABLE_COLUMNS = [...EDITABLE_COLUMNS, "status", "visibility", "deleted_at", "deleted_by"] as string[];
