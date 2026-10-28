"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Clock, LayoutGrid, List, Search, Star, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ModelItem } from "@/components/library/ModelItem";
import { SportFilter } from "@/components/library/SportFilter";
import { LIBRARY_ICONS } from "@/components/library/library-icons";
import { RECENT_LIMIT, useLibraryPrefs, type LibraryView } from "@/components/library/useLibraryPrefs";
import { PERSONS_CATEGORY, SHOW_PERSONS_IN_LIBRARY, getCategory, type LibraryCategory } from "@/lib/constants/libraryTaxonomy";
import { filterItems, groupByCategory, isPerson, sportCounts, type CategoryGroup } from "@/lib/library/search";
import { useShortViewport } from "@/components/canvas-3d/mobile/useEditorLayout";
import { cn } from "@/lib/utils";
import type { MaterialModel } from "@/types/materialModel";

type OnSelect = (model: MaterialModel) => void;

function ItemGrid({
  models,
  view,
  favorites,
  onSelect,
  onToggleFavorite,
}: {
  models: MaterialModel[];
  view: LibraryView;
  favorites: Set<string>;
  onSelect: OnSelect;
  onToggleFavorite: (slug: string) => void;
}) {
  return (
    <div
      className={cn(
        view === "list" ? "flex flex-col gap-1" : "grid grid-cols-2 gap-2 min-[520px]:grid-cols-3 lg:grid-cols-2",
      )}
    >
      {models.map((model) => (
        <ModelItem
          key={model.id}
          model={model}
          view={view}
          favorite={favorites.has(model.slug)}
          onSelect={onSelect}
          onToggleFavorite={onToggleFavorite}
        />
      ))}
    </div>
  );
}

/** Accordeon met sticky kop; de inhoud wordt pas gerenderd als hij openstaat. */
function Section({
  id,
  title,
  count,
  icon,
  color,
  open,
  onOpenChange,
  stickyTop,
  surface,
  children,
}: {
  id: string;
  title: string;
  count: number;
  icon: React.ReactNode;
  color?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stickyTop: number;
  surface: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={`library-${id}`} className="border-b pb-2 last:border-b-0">
      <div className={cn("sticky z-10", surface)} style={{ top: stickyTop }}>
        <h3 className="m-0">
          <button
            type="button"
            aria-expanded={open}
            aria-controls={`library-panel-${id}`}
            onClick={() => onOpenChange(!open)}
            className="flex w-full items-center justify-between gap-2 rounded-md py-2 text-left text-sm font-semibold pointer-coarse:min-h-11 hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <span id={`library-${id}`} className="flex items-center gap-2">
              <span style={color ? { color } : undefined} aria-hidden="true">
                {icon}
              </span>
              <span>
                {title} <span className="font-normal text-muted-foreground">({count})</span>
              </span>
            </span>
            <ChevronDown
              className={cn("size-4 shrink-0 text-muted-foreground transition-transform duration-150 ease-brand", open && "rotate-180")}
              aria-hidden="true"
            />
          </button>
        </h3>
      </div>
      {open && (
        <div id={`library-panel-${id}`} className="animate-fade-up mt-1 mb-1">
          {children}
        </div>
      )}
    </section>
  );
}

/** Subgroepen als kleine tabs (geen nieuwe accordeons) — alleen bij categorieën met subgroepen. */
function SubgroupTabs({
  group,
  active,
  onChange,
}: {
  group: CategoryGroup<MaterialModel>;
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div role="tablist" aria-label={`Subgroepen van ${group.label}`} className="mb-2 flex flex-wrap gap-1">
      {[{ id: "alle", label: "Alle", count: group.items.length }, ...group.subgroups.map((s) => ({ id: s.id, label: s.label, count: s.items.length }))].map(
        (tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active === tab.id}
            onClick={() => onChange(tab.id)}
            className={cn(
              "rounded-md px-2 py-1 text-xs font-medium transition-colors duration-150 ease-brand pointer-coarse:min-h-11 pointer-coarse:px-3 pointer-coarse:text-sm focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
              active === tab.id ? "bg-primary/15 text-foreground ring-1 ring-primary/40" : "text-muted-foreground hover:bg-accent",
            )}
          >
            {tab.label} <span className="tabular-nums opacity-70">{tab.count}</span>
          </button>
        ),
      )}
    </div>
  );
}

/**
 * Itembibliotheek van de 3D-editor: zoekbalk, sportfilter, accordeons per
 * hoofdcategorie (standaard dicht) met "Recent gebruikt" en "Favorieten"
 * bovenaan, en een aparte sectie "Personen". Zoeken/filteren klapt alleen
 * categorieën met resultaten open. `models` komt server-side al mee.
 * Indeling: lib/constants/libraryTaxonomy.ts; logica: lib/library/search.ts.
 */
export function ModelLibrary({
  models,
  onSelect,
  surfaceClassName = "bg-card",
  syncFavorites = true,
}: {
  models: MaterialModel[];
  onSelect: OnSelect;
  /** Achtergrond voor de sticky delen (moet gelijk zijn aan de ondergrond). */
  surfaceClassName?: string;
  /** Gastmodus: false = favorieten alleen lokaal (geen serveracties). */
  syncFavorites?: boolean;
}) {
  const prefs = useLibraryPrefs({ syncServer: syncFavorites });
  // Telefoon in landscape: weinig hoogte. Zoekbalk en chips scrollen dan mee (alleen de categoriekop
  // blijft plakken), anders blijft er nauwelijks ruimte voor de items zelf.
  const shortViewport = useShortViewport();
  const [query, setQuery] = useState("");
  const [sports, setSports] = useState<string[]>([]);
  const [mode, setMode] = useState<"materiaal" | "personen">("materiaal");
  // Handmatig open/dicht per modus (zonder filter / met filter), zodat een
  // opgeruimd filter de gewone staat terugbrengt.
  const [manualOpen, setManualOpen] = useState<{ plain: Record<string, boolean>; filtered: Record<string, boolean> }>({
    plain: {},
    filtered: {},
  });
  const [subgroupTab, setSubgroupTab] = useState<Record<string, string>>({});
  const headRef = useRef<HTMLDivElement>(null);
  const [headHeight, setHeadHeight] = useState(0);

  useEffect(() => {
    const element = headRef.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setHeadHeight(element.offsetHeight));
    observer.observe(element);
    setHeadHeight(element.offsetHeight);
    return () => observer.disconnect();
  }, []);

  const stickyOffset = shortViewport ? 0 : headHeight;
  const favorites = useMemo(() => new Set(prefs.favorites), [prefs.favorites]);
  const materials = useMemo(() => models.filter((model) => !isPerson(model)), [models]);
  const persons = useMemo(() => (SHOW_PERSONS_IN_LIBRARY ? models.filter(isPerson) : []), [models]);

  const isFiltering = query.trim().length > 0 || sports.length > 0;
  const filtered = useMemo(() => filterItems(materials, { query, sports }), [materials, query, sports]);
  const counts = useMemo(() => sportCounts(materials, query), [materials, query]);
  const groups = useMemo(() => groupByCategory(filtered), [filtered]);

  const bySlug = useMemo(() => new Map(filtered.map((model) => [model.slug, model])), [filtered]);
  const recentModels = useMemo(
    () => prefs.recent.map((slug) => bySlug.get(slug)).filter((model): model is MaterialModel => Boolean(model)).slice(0, RECENT_LIMIT),
    [prefs.recent, bySlug],
  );
  const favoriteModels = useMemo(
    () => prefs.favorites.map((slug) => bySlug.get(slug)).filter((model): model is MaterialModel => Boolean(model)),
    [prefs.favorites, bySlug],
  );

  const bucket = isFiltering ? "filtered" : "plain";
  const isOpen = (id: string) => manualOpen[bucket][id] ?? isFiltering;
  const setOpen = (id: string, open: boolean) =>
    setManualOpen((current) => ({ ...current, [bucket]: { ...current[bucket], [id]: open } }));

  function handleSelect(model: MaterialModel) {
    prefs.pushRecent(model.slug);
    onSelect(model);
  }

  function clearFilters() {
    setQuery("");
    setSports([]);
  }

  if (models.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Nog geen 3D-materiaal beschikbaar — zie README.md &quot;3D-materiaal toevoegen&quot;.
      </p>
    );
  }

  const CategoryIcon = (category: LibraryCategory) => {
    const Icon = LIBRARY_ICONS[category.icon];
    return <Icon className="size-4" />;
  };

  return (
    <div className="space-y-2" style={{ "--library-sticky-top": `${stickyOffset}px` } as React.CSSProperties}>
      {persons.length > 0 && (
        <div role="group" aria-label="Materiaal of personen" className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
          {(["materiaal", "personen"] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={mode === option}
              onClick={() => setMode(option)}
              className={cn(
                "rounded-md px-2 py-1.5 text-sm font-medium transition-colors duration-150 ease-brand focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none pointer-coarse:min-h-11",
                mode === option ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {option === "materiaal" ? "Materiaal" : `Personen (${persons.length})`}
            </button>
          ))}
        </div>
      )}

      {mode === "personen" && persons.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">{PERSONS_CATEGORY.description}</p>
          <ItemGrid
            models={persons}
            view={prefs.view}
            favorites={favorites}
            onSelect={handleSelect}
            onToggleFavorite={prefs.toggleFavorite}
          />
        </div>
      ) : (
        <>
          <div ref={headRef} className={cn("z-20 -mx-1 space-y-2 px-1 pt-1 pb-2", !shortViewport && "sticky top-0", surfaceClassName)}>
            <div className="flex items-center gap-1.5">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Zoek materiaal..."
                  aria-label="Zoek materiaal"
                  className="pr-8 pl-9 [&::-webkit-search-cancel-button]:hidden"
                />
                {query && (
                  <button
                    type="button"
                    aria-label="Zoekopdracht wissen"
                    onClick={() => setQuery("")}
                    className="absolute top-1/2 right-2 flex size-5 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    <X className="size-3.5" aria-hidden="true" />
                  </button>
                )}
              </div>
              <div role="group" aria-label="Weergave" className="flex shrink-0 rounded-md border">
                {([
                  ["grid", "Grote kaarten", LayoutGrid],
                  ["list", "Compacte lijst", List],
                ] as const).map(([value, label, Icon]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={prefs.view === value}
                    aria-label={label}
                    title={label}
                    onClick={() => prefs.setView(value)}
                    className={cn(
                      "flex size-8 items-center justify-center first:rounded-l-md last:rounded-r-md pointer-coarse:size-11 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                      prefs.view === value ? "bg-primary text-primary-foreground" : "hover:bg-accent",
                    )}
                  >
                    <Icon className="size-4" aria-hidden="true" />
                  </button>
                ))}
              </div>
            </div>
            <SportFilter total={counts.total} sports={counts.sports} selected={sports} onChange={setSports} />
          </div>

          {isFiltering && filtered.length === 0 ? (
            <div role="status" className="space-y-3 py-6 text-center">
              <p className="text-sm text-muted-foreground">Geen materiaal gevonden, wis filters.</p>
              <Button type="button" variant="outline" size="sm" onClick={clearFilters}>
                Filters wissen
              </Button>
            </div>
          ) : (
            <div>
              {favoriteModels.length > 0 && (
                <Section
                  id="favorieten"
                  title="Favorieten"
                  count={favoriteModels.length}
                  icon={<Star className="size-4" />}
                  color="var(--primary)"
                  open={isOpen("favorieten")}
                  onOpenChange={(open) => setOpen("favorieten", open)}
                  stickyTop={stickyOffset}
                  surface={surfaceClassName}
                >
                  <ItemGrid models={favoriteModels} view={prefs.view} favorites={favorites} onSelect={handleSelect} onToggleFavorite={prefs.toggleFavorite} />
                </Section>
              )}
              {recentModels.length > 0 && (
                <Section
                  id="recent"
                  title="Recent gebruikt"
                  count={recentModels.length}
                  icon={<Clock className="size-4" />}
                  open={isOpen("recent")}
                  onOpenChange={(open) => setOpen("recent", open)}
                  stickyTop={stickyOffset}
                  surface={surfaceClassName}
                >
                  <ItemGrid models={recentModels} view={prefs.view} favorites={favorites} onSelect={handleSelect} onToggleFavorite={prefs.toggleFavorite} />
                </Section>
              )}
              {groups.map((group) => {
                const category = getCategory(group.id);
                const active = subgroupTab[group.id] ?? "alle";
                const shown =
                  active === "alle" ? group.items : (group.subgroups.find((subgroup) => subgroup.id === active)?.items ?? group.items);
                return (
                  <Section
                    key={group.id}
                    id={group.id}
                    title={group.label}
                    count={group.items.length}
                    icon={category ? CategoryIcon(category) : null}
                    color={category?.color}
                    open={isOpen(group.id)}
                    onOpenChange={(open) => setOpen(group.id, open)}
                    stickyTop={stickyOffset}
                    surface={surfaceClassName}
                  >
                    {group.subgroups.length > 1 && (
                      <SubgroupTabs
                        group={group}
                        active={active}
                        onChange={(id) => setSubgroupTab((current) => ({ ...current, [group.id]: id }))}
                      />
                    )}
                    <ItemGrid models={shown} view={prefs.view} favorites={favorites} onSelect={handleSelect} onToggleFavorite={prefs.toggleFavorite} />
                  </Section>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
