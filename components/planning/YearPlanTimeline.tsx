"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { YearPlanBlockDialog, type YearPlanBlockDialogState } from "@/components/planning/YearPlanBlockDialog";
import { getCategoryForLearningLine } from "@/lib/constants/learningLines";
import { getCategoryColor } from "@/lib/constants/categoryColors";
import { addDays, diffInWeeks, getCurrentSchoolYearRange } from "@/lib/planningSchedule";
import { cn } from "@/lib/utils";
import type { YearPlanBlock } from "@/types/planning";

const WEEK_COLUMN_WIDTH = 36; // px — smal genoeg om ~40+ weken horizontaal scrollbaar te tonen
const MONTH_LABELS = [
  "jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec",
];

/**
 * Horizontale weken-timeline van het lopende schooljaar (1 aug t/m 31 jul,
 * zie lib/planningSchedule.ts's getCurrentSchoolYearRange). Twee lagen op
 * dezelfde kolombreedte: een basisrij met klikbare lege weken (nieuw blok
 * toevoegen) en, los daarvan, de bestaande blokken als geabsoluteerd
 * gepositioneerde balken erbovenop — een week die door een blok gedekt
 * wordt, krijgt bewust GEEN klikbare basis-cel (voorkomt overlappende
 * klikdoelen i.p.v. z-index-gejongleer).
 */
export function YearPlanTimeline({ classId, blocks }: { classId: string; blocks: YearPlanBlock[] }) {
  const { start, end } = useMemo(() => getCurrentSchoolYearRange(), []);
  const totalWeeks = diffInWeeks(start, end) + 1;
  const weekStarts = useMemo(
    () => Array.from({ length: totalWeeks }, (_, i) => addDays(start, i * 7)),
    [start, totalWeeks],
  );

  const [dialogState, setDialogState] = useState<YearPlanBlockDialogState | null>(null);

  function isCoveredByBlock(weekStart: string) {
    return blocks.some((block) => weekStart >= block.start_date && weekStart <= block.end_date);
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-base">Jaarplanning</CardTitle>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setDialogState({ mode: "create", startDate: weekStarts[0] })}
        >
          <Plus className="size-4" />
          Leerlijn toevoegen
        </Button>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto pb-2">
          <div className="relative" style={{ width: totalWeeks * WEEK_COLUMN_WIDTH }}>
            {/* Maandlabels */}
            <div className="flex h-5">
              {weekStarts.map((weekStart, index) => {
                const month = new Date(`${weekStart}T00:00:00Z`).getUTCMonth();
                const prevMonth =
                  index === 0
                    ? null
                    : new Date(`${weekStarts[index - 1]}T00:00:00Z`).getUTCMonth();
                const isNewMonth = month !== prevMonth;
                return (
                  <div
                    key={weekStart}
                    style={{ width: WEEK_COLUMN_WIDTH }}
                    className="shrink-0 text-[10px] font-medium text-muted-foreground"
                  >
                    {isNewMonth ? MONTH_LABELS[month] : ""}
                  </div>
                );
              })}
            </div>

            {/* Basisrij: lege, klikbare weken */}
            <div className="flex h-12 items-stretch rounded-md border border-dashed border-border/60">
              {weekStarts.map((weekStart) => {
                if (isCoveredByBlock(weekStart)) {
                  return <div key={weekStart} style={{ width: WEEK_COLUMN_WIDTH }} />;
                }
                return (
                  <button
                    key={weekStart}
                    type="button"
                    style={{ width: WEEK_COLUMN_WIDTH }}
                    className="shrink-0 border-r border-border/40 outline-none transition-colors last:border-r-0 hover:bg-muted focus-visible:bg-muted"
                    onClick={() => setDialogState({ mode: "create", startDate: weekStart })}
                    aria-label={`Voeg leerlijn toe vanaf de week van ${weekStart}`}
                  />
                );
              })}
            </div>

            {/* Blokken */}
            {blocks.map((block) => {
              const startIndex = Math.max(0, diffInWeeks(start, block.start_date));
              const endIndex = Math.min(totalWeeks - 1, diffInWeeks(start, block.end_date));
              const span = endIndex - startIndex + 1;
              if (span <= 0) return null;
              const color = getCategoryColor(getCategoryForLearningLine(block.leerlijn));

              return (
                <button
                  key={block.id}
                  type="button"
                  className={cn(
                    "absolute top-5 flex h-12 items-center overflow-hidden rounded-md border-l-4 bg-card px-2 text-left text-xs font-medium shadow-brand-sm outline-none transition-transform hover:-translate-y-0.5 focus-visible:ring-[3px] focus-visible:ring-ring/50",
                    color.border,
                  )}
                  style={{ left: startIndex * WEEK_COLUMN_WIDTH, width: span * WEEK_COLUMN_WIDTH }}
                  onClick={() => setDialogState({ mode: "edit", block })}
                >
                  <span className={cn("truncate", color.text)}>{block.leerlijn}</span>
                </button>
              );
            })}
          </div>
        </div>

        {blocks.length === 0 && (
          <p className="mt-3 text-sm text-muted-foreground">
            Nog geen leerlijnen toegewezen — klik op een week om te beginnen.
          </p>
        )}
      </CardContent>

      <YearPlanBlockDialog
        open={dialogState !== null}
        onOpenChange={(next) => !next && setDialogState(null)}
        classId={classId}
        state={dialogState}
      />
    </Card>
  );
}
