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

// "Toevoegen aan planning" vanaf de activiteit-detailpagina: klas + datum
// kiezen, koppelt aan een bestaand lesmoment op die datum of maakt er één
// aan (zie actions/planning.ts's addActivityToPlanning).
export const addActivityToPlanningInputSchema = z.object({
  activityId: z.string().trim().min(1, "Kies een activiteit."),
  classId: z.string().uuid(),
  lessonDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ongeldige datum."),
});

export type AddActivityToPlanningInput = z.infer<typeof addActivityToPlanningInputSchema>;

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

// Maandkalender-rij verrijkt met de klasnaam (voor de les-"chip" die klasnaam
// + activiteit toont zonder een aparte lookup per rij) en, indien gekoppeld,
// de titel van de activiteit.
export type PlannedLessonWithContext = PlannedLesson & {
  class_name: string;
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

// ----------------------------------------------------------------------------
// Schoolvakanties — centraal beheerde, per regio verschillende periodes (zie
// supabase/migrations/planning_feature_rework.sql). `holiday_region` staat
// op het gebruikersprofiel (lib/types.ts's UserProfile) en bepaalt welke
// rijen hier relevant zijn.
// ----------------------------------------------------------------------------

export const HOLIDAY_REGIONS = ["noord", "midden", "zuid"] as const;
export type HolidayRegion = (typeof HOLIDAY_REGIONS)[number];

export const HOLIDAY_REGION_LABELS: Record<HolidayRegion, string> = {
  noord: "Noord",
  midden: "Midden",
  zuid: "Zuid",
};

export type SchoolHoliday = {
  id: string;
  region: HolidayRegion;
  name: string;
  start_date: string;
  end_date: string;
  school_year: string;
};
