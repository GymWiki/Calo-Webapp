"use client";

import { useMemo, useState } from "react";
import { Search, SearchX } from "lucide-react";

import { ActivityCard } from "@/components/activity-card";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { DOELGROEP_LABELS, DOELGROEP_WAARDEN, type Activity } from "@/types/activity";

const PAGE_SIZE = 24;
const WEINIG_MATERIAAL_MAX = 2;

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
        "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
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

export function ActiviteitenSearchClient({
  activities,
  savedIds,
}: {
  activities: Activity[];
  savedIds: string[];
}) {
  const [query, setQuery] = useState("");
  const [leerlijnFilter, setLeerlijnFilter] = useState<Set<string>>(new Set());
  const [categorieFilter, setCategorieFilter] = useState<Set<string>>(new Set());
  const [doelgroepFilter, setDoelgroepFilter] = useState<Set<number>>(new Set());
  const [weinigMateriaal, setWeinigMateriaal] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

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

  const hasActiveFilters =
    query.trim() !== "" ||
    leerlijnFilter.size > 0 ||
    categorieFilter.size > 0 ||
    doelgroepFilter.size > 0 ||
    weinigMateriaal;

  function resetPaging() {
    setVisibleCount(PAGE_SIZE);
  }

  function clearFilters() {
    setQuery("");
    setLeerlijnFilter(new Set());
    setCategorieFilter(new Set());
    setDoelgroepFilter(new Set());
    setWeinigMateriaal(false);
    resetPaging();
  }

  const filtered = useMemo(() => {
    const trimmedQuery = query.trim();

    return activities.filter((activity) => {
      if (trimmedQuery && !matchesQuery(activity, trimmedQuery)) return false;

      if (leerlijnFilter.size > 0 && !leerlijnFilter.has(activity.leerlijn ?? "")) {
        return false;
      }

      if (
        categorieFilter.size > 0 &&
        !categorieFilter.has(activity.categorie ?? "")
      ) {
        return false;
      }

      if (
        doelgroepFilter.size > 0 &&
        !(activity.doelgroep ?? []).some((waarde) => doelgroepFilter.has(waarde))
      ) {
        return false;
      }

      if (weinigMateriaal && (activity.materiaal?.length ?? 0) > WEINIG_MATERIAAL_MAX) {
        return false;
      }

      return true;
    });
  }, [activities, query, leerlijnFilter, categorieFilter, doelgroepFilter, weinigMateriaal]);

  const visible = filtered.slice(0, visibleCount);

  return (
    <div className="space-y-6">
      <div className="relative">
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

      <div className="space-y-3">
        {leerlijnen.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {leerlijnen.map((leerlijn) => (
              <FilterChip
                key={leerlijn}
                active={leerlijnFilter.has(leerlijn)}
                onClick={() => {
                  setLeerlijnFilter((prev) => toggle(prev, leerlijn));
                  resetPaging();
                }}
              >
                {leerlijn}
              </FilterChip>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {categorieen.map((categorie) => (
            <FilterChip
              key={categorie}
              active={categorieFilter.has(categorie)}
              onClick={() => {
                setCategorieFilter((prev) => toggle(prev, categorie));
                resetPaging();
              }}
            >
              {categorie}
            </FilterChip>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {DOELGROEP_WAARDEN.map((waarde) => (
            <FilterChip
              key={waarde}
              active={doelgroepFilter.has(waarde)}
              onClick={() => {
                setDoelgroepFilter((prev) => toggle(prev, waarde));
                resetPaging();
              }}
            >
              {DOELGROEP_LABELS[waarde]}
            </FilterChip>
          ))}
          <FilterChip
            active={weinigMateriaal}
            onClick={() => {
              setWeinigMateriaal((prev) => !prev);
              resetPaging();
            }}
          >
            Weinig materiaal
          </FilterChip>
        </div>
      </div>

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
              <Button variant="outline" onClick={clearFilters}>
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
    </div>
  );
}
