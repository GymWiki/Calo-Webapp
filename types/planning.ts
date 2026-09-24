import { z } from "zod";

// ----------------------------------------------------------------------------
// Klassen — naam, doelgroep en vaste weekmomenten. `lesson_slots` is een
// jsonb-array op de `klassen`-tabel (zie supabase/migrations/
// planning_feature.sql); weekday is ISO (1 = maandag, 7 = zondag).
// ----------------------------------------------------------------------------

export const lessonSlotSchema = z.object({
  weekday: z.number().int().min(1, "Kies een dag.").max(7, "Kies een dag."),
  startTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Gebruik het formaat UU:MM."),
  durationMinutes: z.coerce
    .number()
    .int()
    .min(5, "Minimaal 5 minuten.")
    .max(240, "Maximaal 240 minuten."),
});

export type LessonSlot = z.infer<typeof lessonSlotSchema>;

export const WEEKDAY_LABELS: Record<number, string> = {
  1: "Maandag",
  2: "Dinsdag",
  3: "Woensdag",
  4: "Donderdag",
  5: "Vrijdag",
  6: "Zaterdag",
  7: "Zondag",
};

export const createClassInputSchema = z.object({
  name: z.string().trim().min(1, "Naam is verplicht."),
  doelgroep: z.coerce.number().int().min(1, "Kies een doelgroep.").max(6, "Kies een doelgroep."),
  lessonSlots: z.array(lessonSlotSchema).min(1, "Voeg minstens één weekmoment toe."),
});

export type CreateClassInput = z.infer<typeof createClassInputSchema>;

export const updateClassInputSchema = createClassInputSchema.extend({
  id: z.string().uuid(),
});

export type UpdateClassInput = z.infer<typeof updateClassInputSchema>;

export type PlanningClass = {
  id: string;
  user_id: string;
  name: string;
  doelgroep: number;
  lesson_slots: LessonSlot[];
  created_at: string;
};

// ----------------------------------------------------------------------------
// Jaarplanning-blokken — welke leerlijn een klas krijgt van start_date t/m
// end_date. `leerlijn` is vrije tekst (zelfde sleutel als
// activiteiten.leerlijn/LEARNING_LINE_CATEGORIES), geen foreign key.
// Overlap binnen dezelfde klas wordt door de database geweigerd (exclude-
// constraint) — de server action zet die foutmelding om in een vriendelijke
// tekst i.p.v. de ruwe Postgres-foutcode door te geven.
// ----------------------------------------------------------------------------

const yearPlanBlockDateOrder = (value: { startDate: string; endDate: string }) =>
  value.endDate >= value.startDate;
const yearPlanBlockDateOrderIssue = {
  message: "Einddatum moet op of na de startdatum liggen.",
  path: ["endDate"],
};

const yearPlanBlockFieldsSchema = z.object({
  classId: z.string().uuid(),
  leerlijn: z.string().trim().min(1, "Kies een leerlijn."),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ongeldige startdatum."),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ongeldige einddatum."),
});

export const createYearPlanBlockInputSchema = yearPlanBlockFieldsSchema.refine(
  yearPlanBlockDateOrder,
  yearPlanBlockDateOrderIssue,
);

export type CreateYearPlanBlockInput = z.infer<typeof createYearPlanBlockInputSchema>;

export const updateYearPlanBlockInputSchema = yearPlanBlockFieldsSchema
  .extend({ id: z.string().uuid() })
  .refine(yearPlanBlockDateOrder, yearPlanBlockDateOrderIssue);

export type UpdateYearPlanBlockInput = z.infer<typeof updateYearPlanBlockInputSchema>;

export type YearPlanBlock = {
  id: string;
  class_id: string;
  user_id: string;
  leerlijn: string;
  start_date: string;
  end_date: string;
  created_at: string;
};

// ----------------------------------------------------------------------------
// Geplande lessen — één rij per concreet lesmoment. `lesson_date`/
// `start_time`/`duration_minutes` worden bij generatie "bevroren" (zie
// lib/planningSchedule.ts) en niet elke render herberekend uit de
// lesson_slots van de klas.
// ----------------------------------------------------------------------------

export const PLANNED_LESSON_STATUSES = ["nog_te_bepalen", "gepland", "gegeven"] as const;
export type PlannedLessonStatus = (typeof PLANNED_LESSON_STATUSES)[number];

export const PLANNED_LESSON_STATUS_LABELS: Record<PlannedLessonStatus, string> = {
  nog_te_bepalen: "Nog te bepalen",
  gepland: "Gepland",
  gegeven: "Gegeven",
};

export const updatePlannedLessonInputSchema = z.object({
  id: z.string().uuid(),
  activityId: z.string().trim().min(1).nullable().optional(),
  status: z.enum(PLANNED_LESSON_STATUSES).optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

export type UpdatePlannedLessonInput = z.infer<typeof updatePlannedLessonInputSchema>;

export type PlannedLesson = {
  id: string;
  class_id: string;
  user_id: string;
  lesson_date: string;
  start_time: string;
  duration_minutes: number;
  activity_id: string | null;
  status: PlannedLessonStatus;
  notes: string | null;
  created_at: string;
};

// Weekplanning-rij verrijkt met de actieve leerlijn (afgeleid uit de
// jaarplanning-blokken, niet opgeslagen) en, indien gekoppeld, de titel van
// de activiteit — voor gebruik in WeekPlanningView zonder een aparte lookup
// per rij nodig te hebben.
export type PlannedLessonWithContext = PlannedLesson & {
  activeLeerlijn: string | null;
  activityTitel: string | null;
};

// Voor de "Gepland voor Groep 5A op 12 oktober"-koppeling op de activiteit-
// detailpagina.
export type PlannedLessonForActivity = {
  id: string;
  class_id: string;
  class_name: string;
  lesson_date: string;
  start_time: string;
};
