import type { LessonSlot } from "@/types/planning";

// Pure datum-helpers voor de Planning-functie — geen Supabase-imports, dus
// makkelijk te testen en herbruikbaar in zowel server-code als client-
// componenten (de maandkalender en de mini-datumkiezer delen dezelfde
// grid-berekening).

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

// Maandag (ISO-weekstart) van de week die `date` bevat.
export function getWeekStart(date: string): string {
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
  const isoDow = dow === 0 ? 7 : dow;
  return addDays(date, -(isoDow - 1));
}

// Maandag-t/m-zondag bereik van de week die `date` bevat — voor het
// weekrooster op /profiel/planning.
export function getWeekRange(date: string): { start: string; end: string } {
  const start = getWeekStart(date);
  return { start, end: addDays(start, 6) };
}

// `weekStart` is de maandag-datum van de huidige week; ±7 dagen blijft dus
// altijd zelf ook een maandag.
export function getPreviousWeek(weekStart: string): string {
  return addDays(weekStart, -7);
}

export function getNextWeek(weekStart: string): string {
  return addDays(weekStart, 7);
}

// ISO-8601-weeknummer (1-53) — voor het "Week 39 · 21-27 sep"-label.
// Standaardalgoritme: schuif naar de donderdag van de week die `date` bevat
// (die donderdag bepaalt altijd in welk ISO-jaar de week valt) en tel dan
// hoeveel volledige weken dat is na 1 januari van dat jaar.
export function getISOWeekNumber(date: string): number {
  const parsed = new Date(`${date}T00:00:00Z`);
  const isoDow = parsed.getUTCDay() || 7;
  parsed.setUTCDate(parsed.getUTCDate() + 4 - isoDow);
  const yearStart = new Date(Date.UTC(parsed.getUTCFullYear(), 0, 1));
  return Math.ceil((diffInDays(toDateOnlyString(yearStart), toDateOnlyString(parsed)) + 1) / 7);
}

function diffInDays(from: string, to: string): number {
  const ms = new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime();
  return Math.round(ms / (24 * 60 * 60 * 1000));
}

// "YYYY-MM" -> eerste en laatste kalenderdag van die maand.
export function getMonthRange(month: string): { start: string; end: string } {
  const [year, monthNum] = month.split("-").map(Number);
  const start = toDateOnlyString(new Date(Date.UTC(year, monthNum - 1, 1)));
  // Dag 0 van de volgende maand = laatste dag van deze maand.
  const end = toDateOnlyString(new Date(Date.UTC(year, monthNum, 0)));
  return { start, end };
}

export function getPreviousMonth(month: string): string {
  const [year, monthNum] = month.split("-").map(Number);
  const prev = new Date(Date.UTC(year, monthNum - 2, 1));
  return `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function getNextMonth(month: string): string {
  const [year, monthNum] = month.split("-").map(Number);
  const next = new Date(Date.UTC(year, monthNum, 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`;
}

export type MonthGridDay = { date: string; inCurrentMonth: boolean };

// 6x7-grid (altijd volledige weken, maandag als eerste kolom) voor de
// maand die `month` ("YYYY-MM") aanduidt — inclusief de leidende/sluitende
// dagen uit de vorige/volgende maand zodat elke week compleet is. Gedeeld
// tussen MonthCalendar en MiniMonthPicker.
export function getMonthGridDays(month: string): MonthGridDay[] {
  const { start, end } = getMonthRange(month);
  const gridStart = getWeekStart(start);
  const lastWeekStart = getWeekStart(end);
  const gridEnd = addDays(lastWeekStart, 6);

  const totalDays = diffInWeeks(gridStart, gridEnd) * 7 + 7;
  const monthPrefix = month; // "YYYY-MM" komt overeen met de eerste 7 tekens van elke datum in deze maand.

  return Array.from({ length: totalDays }, (_, i) => {
    const date = addDays(gridStart, i);
    return { date, inCurrentMonth: date.startsWith(monthPrefix) };
  });
}

// Genereert concrete lesdatums voor alle lesson-slots van een klas binnen
// [rangeStart, rangeEnd] (inclusief) — de virtuele lesmomenten van een
// klas/periode, vóórdat ze gemerged worden met echte geplande_lessen-rijen
// (zie lib/services/planning.ts's getClassLessonsForMonth/getWeekLessons).
// `weekday` is ISO (1 = maandag .. 7 = zondag).
export function generateLessonDatesInRange(
  lessonSlots: LessonSlot[],
  rangeStart: string,
  rangeEnd: string,
): { lessonDate: string; startTime: string; durationMinutes: number }[] {
  const results: { lessonDate: string; startTime: string; durationMinutes: number }[] = [];

  for (const slot of lessonSlots) {
    const startWeekday = new Date(`${rangeStart}T00:00:00Z`).getUTCDay();
    const isoStartWeekday = startWeekday === 0 ? 7 : startWeekday;
    const daysUntilFirst = (slot.weekday - isoStartWeekday + 7) % 7;

    for (let date = addDays(rangeStart, daysUntilFirst); date <= rangeEnd; date = addDays(date, 7)) {
      results.push({ lessonDate: date, startTime: slot.startTime, durationMinutes: slot.durationMinutes });
    }
  }

  results.sort((a, b) =>
    a.lessonDate === b.lessonDate
      ? a.startTime.localeCompare(b.startTime)
      : a.lessonDate.localeCompare(b.lessonDate),
  );
  return results;
}
