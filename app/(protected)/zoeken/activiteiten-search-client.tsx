"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { Search, SearchX, SlidersHorizontal } from "lucide-react";

import { ActivityCard } from "@/components/activity-card";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { DOELGROEP_LABELS, DOELGROEP_WAARDEN, type Activity } from "@/types/activity";

const PAGE_SIZE = 24;
const WEINIG_MATERIAAL_MAX = 2;

function subscribeToDesktopQuery(callback: () => void) {
  const mql = window.matchMedia("(min-width: 640px)");
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

function getIsDesktopSnapshot() {
  return window.matchMedia("(min-width: 640px)").matches;
}

function getIsDesktopServerSnapshot() {
  return false;
}

function useIsDesktop() {
  return useSyncExternalStore(
    subscribeToDesktopQuery,
    getIsDesktopSnapshot,
    getIsDesktopServerSnapshot,
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-input bg-background text-foreground hover:bg-accent",
      )}
    >
      {children}
    </button>
  );
}

function toggle<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) {
    next.delete(value);
  } else {
    next.add(value);
  }
  return next;
}

function matchesQuery(activity: Activity, query: string) {
  const haystack = [
    activity.titel,
    activity.beweegthema,
    activity.doel,
    activity.leerlijn,
    activity.actcode,
    ...(activity.materiaal ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(query.toLowerCase());
}

type FilterState = {
  leerlijn: Set<string>;
  categorie: Set<string>;
  doelgroep: Set<number>;
  weinigMateriaal: boolean;
};

const EMPTY_FILTERS: FilterState = {
  leerlijn: new Set(),
  categorie: new Set(),
  doelgroep: new Set(),
  weinigMateriaal: false,
};

function countActive(filters: FilterState) {
  return (
    filters.leerlijn.size +
    filters.categorie.size +
    filters.doelgroep.size +
    (filters.weinigMateriaal ? 1 : 0)
  );
}

export function ActiviteitenSearchClient({
  activities,
  savedIds,
}: {
  activities: Activity[];
  savedIds: string[];
}) {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [draft, setDraft] = useState<FilterState>(EMPTY_FILTERS);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const isDesktop = useIsDesktop();

  const savedIdSet = useMemo(() => new Set(savedIds), [savedIds]);

  const leerlijnen = useMemo(
    () =>
      Array.from(new Set(activities.map((a) => a.leerlijn).filter(Boolean))).sort() as string[],
    [activities],
  );
  const categorieen = useMemo(
    () =>
      Array.from(new Set(activities.map((a) => a.categorie).filter(Boolean))).sort() as string[],
    [activities],
  );

  const activeCount = countActive(filters);

  function resetPaging() {
    setVisibleCount(PAGE_SIZE);
  }

  // Quick-row (leerlijn) toggles the committed filters directly — no drawer needed.
  function toggleQuickLeerlijn(leerlijn: string) {
    setFilters((prev) => ({ ...prev, leerlijn: toggle(prev.leerlijn, leerlijn) }));
    resetPaging();
  }

  function openSheet() {
    setDraft(filters); // seed the drawer with whatever is currently committed
    setSheetOpen(true);
  }

  function applyDraft() {
    setFilters(draft);
    resetPaging();
    setSheetOpen(false);
  }

  function clearAll() {
    setFilters(EMPTY_FILTERS);
    setDraft(EMPTY_FILTERS);
    setQuery("");
    resetPaging();
    setSheetOpen(false);
  }

  const filtered = useMemo(() => {
    const trimmedQuery = query.trim();

    return activities.filter((activity) => {
      if (trimmedQuery && !matchesQuery(activity, trimmedQuery)) return false;

      if (filters.leerlijn.size > 0 && !filters.leerlijn.has(activity.leerlijn ?? "")) {
        return false;
      }

      if (
        filters.categorie.size > 0 &&
        !filters.categorie.has(activity.categorie ?? "")
      ) {
        return false;
      }

      if (
        filters.doelgroep.size > 0 &&
        !(activity.doelgroep ?? []).some((waarde) => filters.doelgroep.has(waarde))
      ) {
        return false;
      }

      if (
        filters.weinigMateriaal &&
        (activity.materiaal?.length ?? 0) > WEINIG_MATERIAAL_MAX
      ) {
        return false;
      }

      return true;
    });
  }, [activities, query, filters]);

  const visible = filtered.slice(0, visibleCount);
  const hasActiveFilters = query.trim() !== "" || activeCount > 0;

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              resetPaging();
            }}
            placeholder="Zoek op trefwoord, bijv. trefbal, keeperspelen, groep 7…"
            className="h-12 pl-10 text-base"
            aria-label="Zoek activiteiten"
          />
        </div>
        <Button
          variant="outline"
          className="relative h-12 shrink-0 px-3"
          onClick={openSheet}
          aria-label="Filters"
        >
          <SlidersHorizontal className="size-4" />
          <span className="hidden sm:inline">Filters</span>
          {activeCount > 0 && (
            <Badge className="absolute -top-2 -right-2 size-5 justify-center rounded-full p-0">
              {activeCount}
            </Badge>
          )}
        </Button>
      </div>

      {leerlijnen.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {leerlijnen.map((leerlijn) => (
            <FilterChip
              key={leerlijn}
              active={filters.leerlijn.has(leerlijn)}
              onClick={() => toggleQuickLeerlijn(leerlijn)}
            >
              {leerlijn}
            </FilterChip>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title={
            activities.length === 0
              ? "Nog geen activiteiten in de bibliotheek"
              : "Geen activiteiten gevonden"
          }
          description={
            activities.length === 0
              ? "Zodra activiteiten zijn toegevoegd, kun je ze hier terugvinden."
              : "Niets gevonden voor deze zoekterm/filters."
          }
          action={
            hasActiveFilters ? (
              <Button variant="outline" onClick={clearAll}>
                Wis filters
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {filtered.length} {filtered.length === 1 ? "activiteit" : "activiteiten"}{" "}
            gevonden
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((activity, index) => (
              <div
                key={activity.id}
                className="animate-fade-up"
                style={{ animationDelay: `${Math.min(index, 6) * 40}ms` }}
              >
                <ActivityCard
                  activity={activity}
                  initiallySaved={savedIdSet.has(activity.id)}
                />
              </div>
            ))}
          </div>
          {visibleCount < filtered.length && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
              >
                Laad meer
              </Button>
            </div>
          )}
        </>
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side={isDesktop ? "right" : "bottom"} className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Filters</SheetTitle>
          </SheetHeader>

          <div className="space-y-6 overflow-y-auto px-4">
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">
                Leerlijnen & Thema&apos;s
              </h3>
              <div className="flex flex-wrap gap-2">
                {leerlijnen.map((leerlijn) => (
                  <FilterChip
                    key={leerlijn}
                    active={draft.leerlijn.has(leerlijn)}
                    onClick={() =>
                      setDraft((prev) => ({
                        ...prev,
                        leerlijn: toggle(prev.leerlijn, leerlijn),
                      }))
                    }
                  >
                    {leerlijn}
                  </FilterChip>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {categorieen.map((categorie) => (
                  <FilterChip
                    key={categorie}
                    active={draft.categorie.has(categorie)}
                    onClick={() =>
                      setDraft((prev) => ({
                        ...prev,
                        categorie: toggle(prev.categorie, categorie),
                      }))
                    }
                  >
                    {categorie}
                  </FilterChip>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Doelgroep & Groep</h3>
              <div className="flex flex-wrap gap-2">
                {DOELGROEP_WAARDEN.map((waarde) => (
                  <FilterChip
                    key={waarde}
                    active={draft.doelgroep.has(waarde)}
                    onClick={() =>
                      setDraft((prev) => ({
                        ...prev,
                        doelgroep: toggle(prev.doelgroep, waarde),
                      }))
                    }
                  >
                    {DOELGROEP_LABELS[waarde]}
                  </FilterChip>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Materiaal & Extra&apos;s</h3>
              <div className="flex flex-wrap gap-2">
                <FilterChip
                  active={draft.weinigMateriaal}
                  onClick={() =>
                    setDraft((prev) => ({
                      ...prev,
                      weinigMateriaal: !prev.weinigMateriaal,
                    }))
                  }
                >
                  Weinig materiaal
                </FilterChip>
              </div>
            </div>
          </div>

          <SheetFooter>
            <Button variant="outline" className="flex-1" onClick={clearAll}>
              Filters wissen
            </Button>
            <Button className="flex-1" onClick={applyDraft}>
              Toepassen
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
