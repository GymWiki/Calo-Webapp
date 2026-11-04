// Past een vloermarkering in een zaal, en hoeveel velden van dezelfde sport passen tegelijk? Puur; zie courtFit.test.ts.
import { COURT_MARKINGS, type CourtMarking, type Orientation } from "@/lib/constants/courtMarkings";

export type Hall = { width_m: number; length_m: number };
export type Placement = { orientation: Orientation };
export type Fit = { fits: boolean; copies: number; orientation: Orientation | null; cols: number; rows: number; needed: { width_m: number; length_m: number } };

const EPS = 1e-9;

/** Aantal velden van `fieldDim` (+ vrije ruimte `end` aan beide uiteinden, `gap` ertussen) dat in `hallDim` past. */
function count(hallDim: number, fieldDim: number, runoff: number, gap: number): number {
  const free = hallDim - 2 * runoff + gap + EPS;
  return Math.max(0, Math.floor(free / (fieldDim + gap)));
}

/** Benodigde zaalmaat voor `copies` velden naast elkaar (in de oriëntatie `lengthwise`): voor de reden in de UI. */
export function neededHall(marking: CourtMarking, copies = 1, orientation: Orientation = "lengthwise", sideBySide = copies): { width_m: number; length_m: number } {
  const gap = marking.shared_gap_m ?? 2 * marking.runoff_min_m.side;
  const across = sideBySide * marking.width_m + (sideBySide - 1) * gap + 2 * marking.runoff_min_m.side;
  const along = marking.length_m + 2 * marking.runoff_min_m.end;
  return orientation === "lengthwise" ? { width_m: along, length_m: across } : { width_m: across, length_m: along };
}

/** Hoeveel velden van deze markering passen in de zaal (beste oriëntatie), inclusief vrije ruimte. */
export function computeMaxCopies({ markering, zaal }: { markering: CourtMarking; zaal: Hall }): Fit {
  const gap = markering.shared_gap_m ?? 2 * markering.runoff_min_m.side;
  let best: Fit = { fits: false, copies: 0, orientation: null, cols: 0, rows: 0, needed: neededHall(markering) };
  for (const orientation of markering.orientations) {
    // lengthwise: veldlengte langs zaal.width_m, veldbreedte langs zaal.length_m.
    const [alongDim, acrossDim] = orientation === "lengthwise" ? [zaal.width_m, zaal.length_m] : [zaal.length_m, zaal.width_m];
    const cols = count(alongDim, markering.length_m, markering.runoff_min_m.end, 2 * markering.runoff_min_m.end);
    const rows = count(acrossDim, markering.width_m, markering.runoff_min_m.side, gap);
    const copies = cols * rows;
    if (copies > best.copies) best = { fits: copies > 0, copies, orientation, cols, rows, needed: best.needed };
  }
  return best;
}

/** Past `copies` velden (standaard één) in de zaal? */
export function fitsInHall({ markering, zaal, copies = 1 }: { markering: CourtMarking; zaal: Hall; copies?: number }): boolean {
  return computeMaxCopies({ markering, zaal }).copies >= copies;
}

/** Korte Nederlandse reden waarom een markering niet past, of null als hij past. */
export function misfitReason(markering: CourtMarking, zaal: Hall, copies = markering.glb_copies ?? 1): string | null {
  if (fitsInHall({ markering, zaal, copies })) return null;
  const need = neededHall(markering, copies, "lengthwise", copies);
  const fmt = (value: number) => String(Math.round(value * 10) / 10).replace(".", ",");
  return `Past niet in ${fmt(zaal.width_m)} × ${fmt(zaal.length_m)} m: minimaal ${fmt(need.width_m)} × ${fmt(need.length_m)} m nodig`;
}

/** Overzicht per zaal: welke markeringen passen (en hoeveel velden). */
export function whatFits(zaal: Hall, markings: readonly CourtMarking[] = COURT_MARKINGS): { marking: CourtMarking; copies: number }[] {
  return markings.map((marking) => ({ marking, copies: computeMaxCopies({ markering: marking, zaal }).copies })).filter((entry) => entry.copies > 0);
}

/** Hint voor een zaal: "Deze zaal past: 1 volleybalveld, 3 badmintonvelden, ...". Eén regel per sport (hoogste aantal, niet-verkleinde varianten eerst). */
export function hallHint(zaal: Hall, markings: readonly CourtMarking[] = COURT_MARKINGS): string {
  const bySport = new Map<string, { label: string; copies: number }>();
  for (const { marking, copies } of whatFits(zaal, markings)) {
    const previous = bySport.get(marking.sport);
    if (!previous || copies > previous.copies) bySport.set(marking.sport, { label: marking.sport, copies });
  }
  if (bySport.size === 0) return "In deze zaal past geen van de bekende sportvelden.";
  return `Deze zaal past: ${[...bySport.values()].map((entry) => `${entry.copies} ${entry.label}veld${entry.copies === 1 ? "" : "en"}`).join(", ")}.`;
}

/** Zijn de gekozen markeringen (ids) geldig in deze zaal? Geeft de ids die niet passen terug (voor een waarschuwing en "Herstel"). */
export function invalidMarkings(selectedIds: readonly string[], zaal: Hall): string[] {
  return selectedIds.filter((id) => {
    const marking = COURT_MARKINGS.find((candidate) => candidate.id === id);
    return marking ? !fitsInHall({ markering: marking, zaal, copies: marking.glb_copies ?? 1 }) : false;
  });
}
