"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import type { Activity } from "@/types/activity";

const RESULT_LIMIT = 50;

function matchesQuery(activity: Activity, query: string) {
  if (!query) return true;
  const haystack = [activity.titel, activity.leerlijn, activity.beschrijving]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

/**
 * Zoek/filter-body — apart van ActivityPickerSheet zodat elke keer openen
 * (zie de `key` op de aanroep hieronder) een verse instantie krijgt die zijn
 * zoek/filter-state opnieuw begint, i.p.v. een useEffect-reset op `open`
 * (zelfde afweging als ClassFormDialog.tsx — react-hooks/set-state-in-effect).
 */
function ActivityPickerBody({
  activities,
  defaultLeerlijn,
  onSelect,
}: {
  activities: Activity[];
  defaultLeerlijn: string | null;
  onSelect: (activity: Activity) => void;
}) {
  const [query, setQuery] = useState("");
  const [restrictToLeerlijn, setRestrictToLeerlijn] = useState(defaultLeerlijn !== null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return activities.filter((activity) => {
      if (restrictToLeerlijn && defaultLeerlijn && activity.leerlijn !== defaultLeerlijn) {
        return false;
      }
      return matchesQuery(activity, q);
    });
  }, [activities, query, restrictToLeerlijn, defaultLeerlijn]);

  return (
    <>
      <SheetHeader>
        <SheetTitle>Kies activiteit</SheetTitle>
        <SheetDescription>
          {defaultLeerlijn
            ? `Standaard gefilterd op ${defaultLeerlijn} — zet de toggle uit om breder te zoeken.`
            : "Zoek in de volledige bibliotheek."}
        </SheetDescription>
      </SheetHeader>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pb-4">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Zoek een activiteit..."
            className="pl-9"
          />
        </div>

        {defaultLeerlijn && (
          <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <Label htmlFor="picker-restrict-leerlijn" className="text-sm font-normal">
              Alleen {defaultLeerlijn}
            </Label>
            <Switch
              id="picker-restrict-leerlijn"
              checked={restrictToLeerlijn}
              onCheckedChange={setRestrictToLeerlijn}
            />
          </div>
        )}

        {filtered.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Geen activiteiten gevonden.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {filtered.slice(0, RESULT_LIMIT).map((activity) => (
              <li key={activity.id}>
                <button
                  type="button"
                  onClick={() => onSelect(activity)}
                  className="flex w-full flex-col items-start gap-0.5 rounded-lg border bg-background p-3 text-left transition-colors duration-150 ease-brand hover:bg-accent active:scale-[0.99]"
                >
                  <span className="text-sm font-medium">{activity.titel}</span>
                  <span className="text-xs text-muted-foreground">
                    {activity.leerlijn ?? "Geen leerlijn"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

/**
 * Compacte activiteiten-kiezer voor een lesmoment — naar het patroon van
 * components/canvas/MaterialPicker.tsx (client zoek+filter, geen eigen
 * Dialog/Sheet-wrapper zelf... hier wél gewrapt in Sheet, want dit is de
 * enige plek die deze picker gebruikt). Standaard gefilterd op de actieve
 * leerlijn van het lesmoment, met een toggle om breder te zoeken. De
 * volledige activiteitenlijst komt als prop binnen (server-side opgehaald
 * door de pagina) — zelfde "haal alles server-side op, filter client-side"
 * patroon als app/(protected)/zoeken/library-search-client.tsx, i.p.v. een
 * eigen API-route.
 */
export function ActivityPickerSheet({
  open,
  onOpenChange,
  activities,
  defaultLeerlijn,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activities: Activity[];
  defaultLeerlijn: string | null;
  onSelect: (activity: Activity) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <ActivityPickerBody
          key={open ? "open" : "closed"}
          activities={activities}
          defaultLeerlijn={defaultLeerlijn}
          onSelect={onSelect}
        />
      </SheetContent>
    </Sheet>
  );
}
