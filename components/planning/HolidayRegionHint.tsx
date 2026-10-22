import Link from "next/link";
import { MapPin } from "lucide-react";

/**
 * Subtiele hint op /profiel/planning zolang de gebruiker geen
 * `holiday_region` heeft ingesteld — dan wordt er bewust geen vakantie-info
 * getoond (zie types/planning.ts). Server-renderbaar, geen client-state
 * nodig.
 */
export function HolidayRegionHint() {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
      <MapPin className="size-4 shrink-0" aria-hidden="true" />
      <span>
        Stel je regio in om schoolvakanties in de kalender te zien —{" "}
        <Link href="/profiel/instellingen" className="font-medium text-primary hover:underline">
          ga naar instellingen
        </Link>
        .
      </span>
    </div>
  );
}
