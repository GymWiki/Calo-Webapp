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
// Geplande lessen — een rij bestaat pas zodra er iets aan een lesmoment
// gekoppeld is (activiteit, notitie, of expliciet "vervallen"); zolang dat
// niet zo is, is een lesmoment puur virtueel, berekend uit klassen.
// lesson_slots (zie lib/planningSchedule.ts's generateLessonDatesInRange en
// lib/services/planning.ts's getClassLessonsForMonth/getWeekLessons).
// `duration_minutes` staat niet meer op deze tabel — bij weergave afgeleid
// uit de bijbehorende lesson_slot van de klas.
// ----------------------------------------------------------------------------

export const PLANNED_LESSON_STATUSES = ["gepland", "vervallen"] as const;
export type PlannedLessonStatus = (typeof PLANNED_LESSON_STATUSES)[number];

export const PLANNED_LESSON_STATUS_LABELS: Record<PlannedLessonStatus, string> = {
  gepland: "Gepland",
  vervallen: "Vervallen",
};

export type PlannedLesson = {
  id: string;
  class_id: string;
  user_id: string;
  lesson_date: string;
  start_time: string;
  status: PlannedLessonStatus;
  notes: string | null;
  created_at: string;
};

// Eén gekoppelde activiteit binnen een lesmoment — `position` bepaalt de
// volgorde binnen dat lesmoment (zie actions/planning.ts's
// reorderLessonActivities).
export type LessonActivity = {
  id: string;
  activityId: string;
  position: number;
  titel: string;
  leerlijn: string | null;
};

const lessonLocationSchema = z.object({
  classId: z.string().uuid(),
  lessonDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ongeldige datum."),
  startTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Gebruik het formaat UU:MM."),
});

export const cancelLessonInputSchema = lessonLocationSchema;
export type CancelLessonInput = z.infer<typeof cancelLessonInputSchema>;

export const restoreLessonInputSchema = lessonLocationSchema;
export type RestoreLessonInput = z.infer<typeof restoreLessonInputSchema>;

export const updateLessonNotesInputSchema = lessonLocationSchema.extend({
  notes: z.string().trim().max(2000).nullable(),
});
export type UpdateLessonNotesInput = z.infer<typeof updateLessonNotesInputSchema>;

export const addActivitiesToLessonInputSchema = lessonLocationSchema.extend({
  activityIds: z.array(z.string().trim().min(1)).min(1, "Kies minstens één activiteit."),
});
export type AddActivitiesToLessonInput = z.infer<typeof addActivitiesToLessonInputSchema>;

export const removeActivityFromLessonInputSchema = z.object({
  lessonActivityId: z.string().uuid(),
});
export type RemoveActivityFromLessonInput = z.infer<typeof removeActivityFromLessonInputSchema>;

export const reorderLessonActivitiesInputSchema = z.object({
  lessonId: z.string().uuid(),
  orderedLessonActivityIds: z.array(z.string().uuid()).min(1),
});
export type ReorderLessonActivitiesInput = z.infer<typeof reorderLessonActivitiesInputSchema>;

// "Toevoegen aan planning" vanaf de activiteit-detailpagina: klas + datum
// kiezen, koppelt aan een bestaand lesmoment op die datum of maakt er één
// aan (zie actions/planning.ts's addActivityToPlanning — intern via
// dezelfde add-activities-primitive als addActivitiesToLesson hierboven).
export const addActivityToPlanningInputSchema = z.object({
  activityId: z.string().trim().min(1, "Kies een activiteit."),
  classId: z.string().uuid(),
  lessonDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ongeldige datum."),
});

export type AddActivityToPlanningInput = z.infer<typeof addActivityToPlanningInputSchema>;

// Klas-detailpagina's lijst-rij: één per lesmoment (virtueel of echt) in de
// bekeken maand, chronologisch. `lessonId` is null zolang het lesmoment
// puur virtueel is (nog geen geplande_lessen-rij).
export type ClassLessonEntry = {
  date: string;
  startTime: string;
  durationMinutes: number;
  lessonId: string | null;
  status: PlannedLessonStatus;
  notes: string | null;
  activities: LessonActivity[];
  holidayName: string | null;
};

// Weekrooster-rij (alle klassen samen) — zelfde vorm als ClassLessonEntry,
// aangevuld met klascontext voor het compacte lesblok.
export type WeekLessonEntry = ClassLessonEntry & {
  classId: string;
  className: string;
  doelgroep: number;
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
