"use client";

import { useCallback, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SearchX, SlidersHorizontal, Users2, X } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { LibraryItemCard, type LibraryListItem } from "@/components/library-item-card";
import { tagColorClass } from "@/components/team/TagEditor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  applyCategorieAlles,
  applyLeerlijnToggle,
  EMPTY_FILTERS,
  FilterChip,
  FilterSections,
  matchesActivityQuery,
  PAGE_SIZE,
  toFilterableFields,
  toggle,
  type FilterState,
} from "@/app/(protected)/zoeken/library-search-client";
import { cn } from "@/lib/utils";
import type { Activity } from "@/types/activity";
import type { TeamLibraryItem, TeamTag } from "@/types/teamLibrary";

type HerkomstFilter = "alles" | "eigen" | "gymwiki";
type TagMode = "any" | "all";

type TeamLibraryEntry = { activity: Activity; item: TeamLibraryItem };

function isZelfGemaakt(item: TeamLibraryItem): boolean {
  return item.kind === "own";
}

function readParamList(params: URLSearchParams, key: string): string[] {
  const value = params.get(key);
  return value ? value.split(",").filter(Boolean) : [];
}

/**
 * Teambibliotheek-weergave op /zoeken (zie de scope-wisselaar in
 * zoeken/page.tsx) — hergebruikt bewust dezelfde categorie/leerlijn/
 * doelgroep/materiaal-filterlogica als library-search-client.tsx (geen
 * tweede filtersysteem, zie de brief), met tags/herkomst/gemaakt-door
 * ERBOVENOP. Filterstatus staat in de URL (i.p.v. localStorage zoals de
 * gedeelde bibliotheek) zodat een teamlid een gefilterde link kan delen.
 */
export function TeamLibraryClient({
  teamName,
  entries,
  allTeamTags,
  members,
}: {
  teamName: string;
  entries: TeamLibraryEntry[];
  allTeamTags: TeamTag[];
  members: { userId: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const query = searchParams.get("q") ?? "";
  const filters: FilterState = useMemo(
    () => ({
      categorie: new Set(readParamList(searchParams, "categorie")),
      leerlijn: new Set(readParamList(searchParams, "leerlijn")),
      doelgroep: new Set(readParamList(searchParams, "doelgroep").map(Number)),
      weinigMateriaal: searchParams.get("weinigMateriaal") === "1",
    }),
    [searchParams],
  );
  const selectedTags = useMemo(() => new Set(readParamList(searchParams, "tags")), [searchParams]);
  const tagMode: TagMode = searchParams.get("tagMode") === "all" ? "all" : "any";
  const herkomst: HerkomstFilter =
    searchParams.get("herkomst") === "eigen" || searchParams.get("herkomst") === "gymwiki"
      ? (searchParams.get("herkomst") as HerkomstFilter)
      : "alles";
  const maker = searchParams.get("maker") ?? "";

  const [draft, setDraft] = useState<FilterState>(EMPTY_FILTERS);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams.toString());
      next.set("scope", "team");
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "") next.delete(key);
        else next.set(key, value);
      }
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
      setVisibleCount(PAGE_SIZE);
    },
    [pathname, router, searchParams],
  );

  function commitFilters(next: FilterState) {
    updateParams({
      categorie: [...next.categorie].join(",") || null,
      leerlijn: [...next.leerlijn].join(",") || null,
      doelgroep: [...next.doelgroep].join(",") || null,
      weinigMateriaal: next.weinigMateriaal ? "1" : null,
    });
  }

  function toggleTag(tagId: string) {
    updateParams({ tags: [...toggle(selectedTags, tagId)].join(",") || null });
  }

  const preFilterEntries = useMemo(() => {
    const trimmedQuery = query.trim();
    return entries.filter(({ activity }) => matchesActivityQuery(activity, trimmedQuery));
  }, [entries, query]);

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const { activity } of preFilterEntries) {
      const { categorie } = toFilterableFields({ source: "public", id: activity.id, activity });
      if (!categorie) continue;
      counts.set(categorie, (counts.get(categorie) ?? 0) + 1);
    }
    return counts;
  }, [preFilterEntries]);

  const filteredEntries = useMemo(() => {
    return preFilterEntries.filter(({ activity, item }) => {
      const { categorie, leerlijn, doelgroep, materiaalCount } = toFilterableFields({
        source: "public",
        id: activity.id,
        activity,
      });

      if (filters.categorie.size > 0 || filters.leerlijn.size > 0) {
        if (!filters.categorie.has(categorie) && !filters.leerlijn.has(leerlijn)) return false;
      }
      if (filters.doelgroep.size > 0 && !doelgroep.some((waarde) => filters.doelgroep.has(waarde))) {
        return false;
      }
      if (filters.weinigMateriaal && materiaalCount > 2) return false;

      if (selectedTags.size > 0) {
        const itemTagIds = new Set(item.tags.map((tag) => tag.id));
        const matches =
          tagMode === "all"
            ? [...selectedTags].every((tagId) => itemTagIds.has(tagId))
            : [...selectedTags].some((tagId) => itemTagIds.has(tagId));
        if (!matches) return false;
      }

      if (herkomst === "eigen" && !isZelfGemaakt(item)) return false;
      if (herkomst === "gymwiki" && isZelfGemaakt(item)) return false;

      if (maker && item.addedBy !== maker) return false;

      return true;
    });
  }, [preFilterEntries, filters, selectedTags, tagMode, herkomst, maker]);

  const visible = filteredEntries.slice(0, visibleCount);
  const activeFilterCount =
    filters.categorie.size +
    filters.leerlijn.size +
    filters.doelgroep.size +
    (filters.weinigMateriaal ? 1 : 0) +
    selectedTags.size +
    (herkomst !== "alles" ? 1 : 0) +
    (maker ? 1 : 0);

  function clearAll() {
    router.replace(`${pathname}?scope=team`, { scroll: false });
    setDraft(EMPTY_FILTERS);
    setVisibleCount(PAGE_SIZE);
  }

  if (entries.length === 0) {
    return (
      <EmptyState
        icon={Users2}
        title="Nog geen activiteiten in de teambibliotheek"
        description={`Maak een teamactiviteit, of voeg een GymWiki-activiteit toe als referentie of kopie — zie de "Team"-knop op een activiteit.`}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          value={query}
          onChange={(event) => updateParams({ q: event.target.value || null })}
          placeholder={`Zoek in de teambibliotheek van ${teamName}...`}
          className="h-12 text-base"
          aria-label="Zoek in de teambibliotheek"
        />
        <Button variant="outline" className="relative h-12 shrink-0 px-3" onClick={() => { setDraft(filters); setSheetOpen(true); }}>
          <SlidersHorizontal className="size-4" />
          Filters
          {activeFilterCount > 0 && (
            <Badge className="absolute -top-2 -right-2 size-5 justify-center rounded-full p-0">{activeFilterCount}</Badge>
          )}
        </Button>
      </div>

      {allTeamTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {allTeamTags.map((tag) => (
            <FilterChip key={tag.id} active={selectedTags.has(tag.id)} onClick={() => toggleTag(tag.id)}>
              {tag.name}
            </FilterChip>
          ))}
          {selectedTags.size > 1 && (
            <button
              type="button"
              onClick={() => updateParams({ tagMode: tagMode === "all" ? null : "all" })}
              className="text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              {tagMode === "all" ? "Alle geselecteerde tags" : "Één van de geselecteerde tags"}
            </button>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {(["alles", "eigen", "gymwiki"] as const).map((value) => (
          <FilterChip key={value} active={herkomst === value} onClick={() => updateParams({ herkomst: value === "alles" ? null : value })}>
            {value === "alles" ? "Alles" : value === "eigen" ? "Zelf gemaakt" : "Uit GymWiki"}
          </FilterChip>
        ))}
        {members.length > 0 && (
          <select
            value={maker}
            onChange={(event) => updateParams({ maker: event.target.value || null })}
            className="h-9 rounded-full border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <option value="">Gemaakt door: iedereen</option>
            {members.map((member) => (
              <option key={member.userId} value={member.userId}>
                {member.name}
              </option>
            ))}
          </select>
        )}
        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={clearAll}
            className="flex items-center gap-1 text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            <X className="size-3.5" />
            Wis alles
          </button>
        )}
      </div>

      {filteredEntries.length === 0 ? (
        <EmptyState icon={SearchX} title="Niets gevonden" description="Niets gevonden voor deze zoekterm/filters." />
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {filteredEntries.length} {filteredEntries.length === 1 ? "resultaat" : "resultaten"}
          </p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4">
            {visible.map(({ activity, item }) => (
              <TeamActivityTile key={activity.id} activity={activity} item={item} />
            ))}
          </div>
          {visibleCount < filteredEntries.length && (
            <div className="flex justify-center">
              <Button variant="outline" onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}>
                Laad meer
              </Button>
            </div>
          )}
        </>
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Filters</SheetTitle>
          </SheetHeader>
          <div className="overflow-y-auto px-4">
            <FilterSections
              state={draft}
              categoryCounts={categoryCounts}
              onCategorieAlles={(category, lines) => setDraft((prev) => applyCategorieAlles(prev, category, lines))}
              onLeerlijnToggle={(category, line) => setDraft((prev) => applyLeerlijnToggle(prev, category, line))}
              onDoelgroepToggle={(waarde) => setDraft((prev) => ({ ...prev, doelgroep: toggle(prev.doelgroep, waarde) }))}
              onWeinigMateriaalToggle={() => setDraft((prev) => ({ ...prev, weinigMateriaal: !prev.weinigMateriaal }))}
            />
          </div>
          <SheetFooter>
            <Button variant="outline" className="flex-1" onClick={clearAll}>
              Filters wissen
            </Button>
            <Button className="flex-1" onClick={() => { commitFilters(draft); setSheetOpen(false); }}>
              Toepassen
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

const MAX_VISIBLE_TAGS = 2;

function TeamActivityTile({ activity, item }: { activity: Activity; item: TeamLibraryItem }) {
  const listItem: LibraryListItem = { source: "public", id: activity.id, activity };
  const visibleTags = item.tags.slice(0, MAX_VISIBLE_TAGS);
  const extraCount = item.tags.length - visibleTags.length;

  return (
    <div className="flex flex-col gap-1.5">
      <LibraryItemCard item={listItem} />
      {item.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {visibleTags.map((tag) => (
            <span
              key={tag.id}
              className={cn("rounded-full border px-1.5 py-0.5 text-[10px] font-medium", tagColorClass(tag.color))}
            >
              {tag.name}
            </span>
          ))}
          {extraCount > 0 && (
            <span className="rounded-full border border-input px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              +{extraCount}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
