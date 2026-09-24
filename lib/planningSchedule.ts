import type { LessonSlot, YearPlanBlock } from "@/types/planning";

// Pure datum-helpers voor de Planning-functie — geen Supabase-imports, dus
// makkelijk te testen en herbruikbaar in zowel server actions als client-
// componenten (bijv. de jaarplanning-timeline die het schooljaar-bereik
// nodig heeft om te renderen).

function toDateOnlyString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// `date` als YYYY-MM-DD; alle rekenwerk in UTC om tijdzone-drift rond
// middernacht te vermijden (geen enkele planning-datum hoeft een lokale
// klokwaarde te dragen, alleen een kalenderdag).
export function addDays(date: string, days: number): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return toDateOnlyString(parsed);
}

export function diffInWeeks(from: string, to: string): number {
  const ms = new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime();
  return Math.floor(ms / (7 * 24 * 60 * 60 * 1000));
}

// Maandag (ISO-weekstart) van de week die `date` bevat — gebruikt om
// geplande lessen per week te groeperen in WeekPlanningView.
export function getWeekStart(date: string): string {
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
  const isoDow = dow === 0 ? 7 : dow;
  return addDays(date, -(isoDow - 1));
}

// Nederlands schooljaar loopt 1 augustus t/m 31 juli. Wordt dynamisch
// berekend i.p.v. opgeslagen — een klas hoeft dus niet apart bij te houden
// "voor welk schooljaar" hij is; de jaarplanning-timeline toont altijd het
// lopende schooljaar t.o.v. `reference` (standaard: vandaag).
export function getCurrentSchoolYearRange(reference: Date = new Date()): {
  start: string;
  end: string;
} {
  const year = reference.getUTCFullYear();
  const month = reference.getUTCMonth(); // 0 = januari, 7 = augustus
  const startYear = month >= 7 ? year : year - 1;
  return {
    start: toDateOnlyString(new Date(Date.UTC(startYear, 7, 1))),
    end: toDateOnlyString(new Date(Date.UTC(startYear + 1, 6, 31))),
  };
}

// Genereert concrete lesdatums voor de komende `weeks` weken, één per
// lesson-slot per week, vanaf (en inclusief) `from`. `weekday` is ISO
// (1 = maandag .. 7 = zondag).
export function generateLessonDates(
  lessonSlots: LessonSlot[],
  from: Date,
  weeks: number,
): { lessonDate: string; startTime: string; durationMinutes: number }[] {
  const results: { lessonDate: string; startTime: string; durationMinutes: number }[] = [];
  const fromMidnight = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));

  for (const slot of lessonSlots) {
    // Vind de eerste occurrence van deze weekdag op of na `from`.
    const fromWeekday = fromMidnight.getUTCDay() === 0 ? 7 : fromMidnight.getUTCDay();
    const daysUntilFirst = (slot.weekday - fromWeekday + 7) % 7;
    const firstOccurrence = new Date(fromMidnight);
    firstOccurrence.setUTCDate(firstOccurrence.getUTCDate() + daysUntilFirst);

    for (let week = 0; week < weeks; week++) {
      const occurrence = new Date(firstOccurrence);
      occurrence.setUTCDate(occurrence.getUTCDate() + week * 7);
      results.push({
        lessonDate: toDateOnlyString(occurrence),
        startTime: slot.startTime,
        durationMinutes: slot.durationMinutes,
      });
    }
  }

  results.sort((a, b) =>
    a.lessonDate === b.lessonDate
      ? a.startTime.localeCompare(b.startTime)
      : a.lessonDate.localeCompare(b.lessonDate),
  );
  return results;
}

// Zoekt het jaarplanning-blok dat `date` (YYYY-MM-DD) dekt, of `null` als er
// voor die datum nog geen leerlijn is toegewezen (lege witruimte in de
// timeline).
export function getActiveLeerlijnForDate(
  yearPlanBlocks: YearPlanBlock[],
  date: string,
): string | null {
  const block = yearPlanBlocks.find((b) => date >= b.start_date && date <= b.end_date);
  return block?.leerlijn ?? null;
}
