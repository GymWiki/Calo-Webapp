"use client";

import { toast } from "sonner";

import { updateHolidayRegion } from "@/actions/profile";
import { SELECT_FIELD_CLASS } from "@/components/planning/planning-ui";
import { Label } from "@/components/ui/label";
import { useOptimisticAction } from "@/lib/hooks/useOptimisticAction";
import { HOLIDAY_REGIONS, HOLIDAY_REGION_LABELS, type HolidayRegion } from "@/types/planning";

const NO_PREFERENCE = "none";

export function HolidayRegionSelect({ initialValue }: { initialValue: HolidayRegion | null }) {
  const {
    value,
    run: handleChange,
    isPending,
  } = useOptimisticAction(
    initialValue,
    (next: HolidayRegion | null) => updateHolidayRegion(next),
    {
      onSuccess: (_result, next) => {
        toast.success(next ? `Regio ingesteld op ${HOLIDAY_REGION_LABELS[next]}.` : "Geen regio-voorkeur meer ingesteld.");
      },
    },
  );

  return (
    <div className="space-y-1.5 rounded-lg border p-3">
      <Label htmlFor="holiday-region-select">Regio voor schoolvakanties</Label>
      <p className="text-xs text-muted-foreground">
        Bepaalt welke schoolvakanties zichtbaar zijn in de Planning-kalender.
      </p>
      <select
        id="holiday-region-select"
        value={value ?? NO_PREFERENCE}
        onChange={(event) =>
          handleChange(event.target.value === NO_PREFERENCE ? null : (event.target.value as HolidayRegion))
        }
        disabled={isPending}
        className={SELECT_FIELD_CLASS}
      >
        <option value={NO_PREFERENCE}>Geen voorkeur</option>
        {HOLIDAY_REGIONS.map((region) => (
          <option key={region} value={region}>
            {HOLIDAY_REGION_LABELS[region]}
          </option>
        ))}
      </select>
    </div>
  );
}
