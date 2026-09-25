"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Lock, Search, SearchX, SlidersHorizontal, X } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { LibraryItemCard, type LibraryListItem } from "@/components/library-item-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { getCategoryForLearningLine, LEARNING_LINE_CATEGORIES } from "@/lib/constants/learningLines";
import { getCategoryColor } from "@/lib/constants/categoryColors";
import { cn } from "@/lib/utils";
import { DOELGROEP_LABELS, DOELGROEP_WAARDEN, type Activity } from "@/types/activity";

const PAGE_SIZE = 24;
const WEINIG_MATERIAAL_MAX = 2;

type SourceFilter = "all" | "gymwiki" | "public";

const SOURCE_TABS: { value: SourceFilter; label: string }[] = [
  { value: "all", label: "Alles" },
  { value: "gymwiki", label: "GymWiki" },
  { value: "public", label: "Publiek" },
];

// "Standaard" laat de bestaande alfabetische/nieuwste-eerst database-volgorde
// intact (zie getAllActivities/getPublicActivities) — sorteren gebeurt dus
// alleen client-side wanneer de gebruiker expliciet "Meest gewaardeerd" kiest.
type SortOption = "standaard" | "meest_gewaardeerd";

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "standaard", label: "Standaard" },
  { value: "meest_gewaardeerd", label: "Meest gewaardeerd" },
];

function readStoredSourceFilter(): SourceFilter {
  if (typeof window === "undefined") return "all";
  try {
    const value = window.localStorage.getItem("gymwiki:zoeken:source-filter");
    return value === "gymwiki" || value === "public" || value === "all" ? value : "all";
  } catch {
    return "all";
  }
}

// Module-level store (niet React state) voor de onthouden bron-tab-keuze —
// useSyncExternalStore i.p.v. "lees localStorage in een useEffect en zet
// state" voorkomt de cascading-render die de laatste aanpak zou geven
// (dezelfde reden waarom useIsDesktop hieronder ook dit patroon gebruikt).
const sourceFilterListeners = new Set<() => void>();
let cachedSourceFilter: SourceFilter | null = null;

function getSourceFilterSnapshot(): SourceFilter {
  if (cachedSourceFilter === null) {
    cachedSourceFilter = readStoredSourceFilter();
  }
  return cachedSourceFilter;
}

function getSourceFilterServerSnapshot(): SourceFilter {
  return "all";
}

function subscribeSourceFilter(listener: () => void) {
  sourceFilterListeners.add(listener);
  return () => sourceFilterListeners.delete(listener);
}

function writeSourceFilter(value: SourceFilter) {
  cachedSourceFilter = value;
  try {
    window.localStorage.setItem("gymwiki:zoeken:source-filter", value);
  } catch {
    // Best-effort — een voorkeur die niet onthouden wordt is geen ramp.
  }
  sourceFilterListeners.forEach((listener) => listener());
}

function useStoredSourceFilter(): [SourceFilter, (value: SourceFilter) => void] {
  const value = useSyncExternalStore(
    subscribeSourceFilter,
    getSourceFilterSnapshot,
    getSourceFilterServerSnapshot,
  );
  return [value, writeSourceFilter];
}

// Zoekterm + categorie/leerlijn/doelgroep/materiaal-filters — samen
// persisted onder één sleutel, zelfde useSyncExternalStore-patroon als de
// bron-tab hierboven. Nodig omdat /activiteit/[id] en /les/[id] losse
// route-segmenten zijn: terugnavigeren daarvandaan unmount deze pagina
// écht, dus gewone useState zou de opgebouwde zoekopdracht kwijtraken.
type PersistedSearchState = {
  query: string;
  categorie: string[];
  leerlijn: string[];
  doelgroep: number[];
  weinigMateriaal: boolean;
  sort: SortOption;
};

const EMPTY_PERSISTED_STATE: PersistedSearchState = {
  query: "",
  categorie: [],
  leerlijn: [],
  doelgroep: [],
  weinigMateriaal: false,
  sort: "standaard",
};

function readStoredSearchState(): PersistedSearchState {
  if (typeof window === "undefined") return EMPTY_PERSISTED_STATE;
  try {
    const raw = window.localStorage.getItem("gymwiki:zoeken:filters");
    if (!raw) return EMPTY_PERSISTED_STATE;
    const parsed = JSON.parse(raw) as Partial<PersistedSearchState>;
    return {
      query: typeof parsed.query === "string" ? parsed.query : "",
      categorie: Array.isArray(parsed.categorie) ? parsed.categorie : [],
      leerlijn: Array.isArray(parsed.leerlijn) ? parsed.leerlijn : [],
      doelgroep: Array.isArray(parsed.doelgroep) ? parsed.doelgroep : [],
      weinigMateriaal: parsed.weinigMateriaal === true,
      sort: parsed.sort === "meest_gewaardeerd" ? "meest_gewaardeerd" : "standaard",
    };
  } catch {
    return EMPTY_PERSISTED_STATE;
  }
}

const searchStateListeners = new Set<() => void>();
let cachedSearchState: PersistedSearchState | null = null;

function getSearchStateSnapshot(): PersistedSearchState {
  if (cachedSearchState === null) {
    cachedSearchState = readStoredSearchState();
  }
  return cachedSearchState;
}

function getSearchStateServerSnapshot(): PersistedSearchState {
  return EMPTY_PERSISTED_STATE;
}

function subscribeSearchState(listener: () => void) {
  searchStateListeners.add(listener);
  return () => searchStateListeners.delete(listener);
}

function writeSearchState(value: PersistedSearchState) {
  cachedSearchState = value;
  try {
    window.localStorage.setItem("gymwiki:zoeken:filters", JSON.stringify(value));
  } catch {
    // Best-effort.
  }
  searchStateListeners.forEach((listener) => listener());
}

function useStoredSearchState(): [PersistedSearchState, (value: PersistedSearchState) => void] {
  const value = useSyncExternalStore(
    subscribeSearchState,
    getSearchStateSnapshot,
    getSearchStateServerSnapshot,
  );
  return [value, writeSearchState];
}

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
        // Zelfde focus-ring/press-feedback als components/ui/button.tsx,
        // zodat deze los-gestylede pil-knoppen (geen shadcn-variant, i.v.m.
        // de rounded-full toggle-vorm) zich hetzelfde gedragen als de rest
        // van de app.
        "shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium outline-none transition-[color,box-shadow,background-color,transform] duration-150 ease-brand focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 active:scale-[0.98]",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-input bg-background text-foreground hover:bg-accent",
      )}
    >
      {children}
    </button>
  );
}

// Vierkant "markeer-pion"-swatch i.p.v. een rond stipje — leunt bewust op
// hetzelfde beeldidioom als --cone (de kegel die een zone op de vloer
// markeert) voor het enige facet waar kleur de primaire betekenisdrager is
// (categorie); andere facetten (leerlijn/doelgroep/materiaal) blijven
// kleurloos zodat categorie herkenbaar blijft als hét kleurvlak.
function CategorySwatch({ category, className }: { category: string; className?: string }) {
  return (
    <span
      className={cn("inline-block size-2.5 shrink-0 rounded-[3px]", getCategoryColor(category).dot, className)}
      aria-hidden="true"
    />
  );
}

// Gedeelde inhoud van het filterpaneel — gebruikt zowel in de mobiele/
// tablet-Sheet (werkt op `draft`, met een expliciete "Toepassen"-stap) als in
// de permanente sidebar op desktop (werkt direct op `filters`, instant
// toegepast — de gangbare desktop-verwachting voor een altijd-zichtbaar
// filterpaneel, in tegenstelling tot een drawer die je moet bevestigen).
function FilterSections({
  state,
  categoryCounts,
  onCategorieAlles,
  onLeerlijnToggle,
  onDoelgroepToggle,
  onWeinigMateriaalToggle,
}: {
  state: FilterState;
  categoryCounts: Map<string, number>;
  onCategorieAlles: (category: string, lines: string[]) => void;
  onLeerlijnToggle: (category: string, line: string) => void;
  onDoelgroepToggle: (waarde: number) => void;
  onWeinigMateriaalToggle: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-5">
        <h3 className="text-sm font-semibold text-foreground">Categorie & Leerlijn</h3>
        {LEARNING_LINE_CATEGORIES.map(({ category, lines }) => (
          <div key={category} className="space-y-2">
            <h4 className="flex items-center gap-1.5 text-sm font-bold text-foreground">
              <CategorySwatch category={category} />
              {category}
              <span className="font-normal text-muted-foreground">
                ({categoryCounts.get(category) ?? 0})
              </span>
            </h4>
            <div className="flex flex-wrap gap-1.5">
              <FilterChip
                active={state.categorie.has(category)}
                onClick={() => onCategorieAlles(category, lines)}
              >
                <CategorySwatch category={category} className="mr-1.5" />
                Alles ({category})
              </FilterChip>
              {lines.map((line) => (
                <FilterChip
                  key={line}
                  active={state.leerlijn.has(line)}
                  onClick={() => onLeerlijnToggle(category, line)}
                >
                  {line}
                </FilterChip>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Doelgroep & Groep</h3>
        <div className="flex flex-wrap gap-2">
          {DOELGROEP_WAARDEN.map((waarde) => (
            <FilterChip
              key={waarde}
              active={state.doelgroep.has(waarde)}
              onClick={() => onDoelgroepToggle(waarde)}
            >
              {DOELGROEP_LABELS[waarde]}
            </FilterChip>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Materiaal & Extra&apos;s</h3>
        <div className="flex flex-wrap gap-2">
          <FilterChip active={state.weinigMateriaal} onClick={onWeinigMateriaalToggle}>
            Weinig materiaal
          </FilterChip>
        </div>
      </div>
    </div>
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

// Trefwoord-zoekopdracht matcht uitsluitend op titel, beschrijving, leerlijn
// en doelgroep — geen materiaal (zie DOELGROEP_LABELS voor de "target_group"
// tekstvorm). Dit voorkomt dat een activiteit die toevallig een ander stuk
// materiaal noemt (bijv. een rugbybal bij een tikspel) onterecht bovenaan
// een trefwoordzoekopdracht op sportnaam verschijnt.
function matchesActivityQuery(activity: Activity, query: string) {
  const doelgroepLabels = (activity.doelgroep ?? [])
    .map((code) => DOELGROEP_LABELS[code])
    .filter(Boolean);

  const haystack = [
    activity.titel,
    activity.beschrijving,
    activity.leerlijn,
    ...doelgroepLabels,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(query.toLowerCase());
}

// Preview-slot voor free_blocked-gebruikers (zie de brief): previewIdSet ===
// null betekent hasFullLibraryAccess (geen enkele beperking). Anders is een
// item alleen "vrij" als het in de vaste preview-set zit, OF het de eigen
// bijdrage van de kijker is — eigen werk moet altijd toegankelijk blijven,
// ook al zit het toevallig niet in de willekeurig gekozen preview-set (zie
// activiteit/[id]/page.tsx's isOwnActivity-uitzondering, die dit al
// afdwingt bij het daadwerkelijk openen; dit is puur de visuele
// tegenhanger in de kaartenlijst).
function isItemUnlocked(
  item: LibraryListItem,
  previewIdSet: Set<string> | null,
  currentUserId: string | null | undefined,
): boolean {
  if (previewIdSet === null) return true;
  if (previewIdSet.has(item.id)) return true;
  return currentUserId != null && item.activity.author_id === currentUserId;
}

// Normalizes an activity onto the shared categorie/leerlijn/doelgroep/
// materiaal shape the filters operate on — een via de wizard aangemaakte
// activiteit heeft geen eigen `categorie`-kolom, dus die wordt afgeleid uit
// `leerlijn` via de reverse taxonomy lookup, en het materiaal is de
// combinatie van basis- en regelmateriaal.
function toFilterableFields(item: LibraryListItem): {
  categorie: string;
  leerlijn: string;
  doelgroep: number[];
  materiaalCount: number;
} {
  const { activity } = item;
  const leerlijn = activity.leerlijn ?? "";
  const materiaalCount = activity.arrangement !== null
    ? (activity.base_materials?.length ?? 0) + (activity.rule_materials?.length ?? 0)
    : activity.materiaal?.length ?? 0;

  return {
    categorie: activity.categorie ?? getCategoryForLearningLine(leerlijn) ?? "",
    leerlijn,
    doelgroep: activity.doelgroep ?? [],
    materiaalCount,
  };
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

function toFilterState(persisted: PersistedSearchState): FilterState {
  return {
    categorie: new Set(persisted.categorie),
    leerlijn: new Set(persisted.leerlijn),
    doelgroep: new Set(persisted.doelgroep),
    weinigMateriaal: persisted.weinigMateriaal,
  };
}

function countActive(filters: FilterState) {
  return (
    filters.leerlijn.size +
    filters.categorie.size +
    filters.doelgroep.size +
    (filters.weinigMateriaal ? 1 : 0)
  );
}

// "Alles [Categorie]" and a specific leerlijn-chip within that same category
// are mutually exclusive — selecting one clears the other so the combined
// categorie/leerlijn filter (see the OR-group in the `filtered` memo below)
// never ends up in a contradictory state like "Turnen (helemaal)" plus
// "Turnen: Springen" active at once.
function applyCategorieAlles(
  state: FilterState,
  category: string,
  lines: string[],
): FilterState {
  const alreadyActive = state.categorie.has(category);
  const nextCategorie = new Set(state.categorie);
  const nextLeerlijn = new Set(state.leerlijn);

  if (alreadyActive) {
    nextCategorie.delete(category);
  } else {
    nextCategorie.add(category);
    lines.forEach((line) => nextLeerlijn.delete(line));
  }

  return { ...state, categorie: nextCategorie, leerlijn: nextLeerlijn };
}

function applyLeerlijnToggle(
  state: FilterState,
  category: string,
  line: string,
): FilterState {
  const nextLeerlijn = toggle(state.leerlijn, line);
  const nextCategorie = new Set(state.categorie);

  if (nextLeerlijn.has(line)) {
    nextCategorie.delete(category);
  }

  return { ...state, leerlijn: nextLeerlijn, categorie: nextCategorie };
}

type ActiveChip = {
  key: string;
  label: string;
  category?: string;
  onRemove: () => void;
};

export function LibrarySearchClient({
  activities,
  publicActivities,
  previewActivityIds = null,
  currentUserId = null,
}: {
  activities: Activity[];
  publicActivities: Activity[];
  /**
   * Preview-slot voor free_blocked-gebruikers (zie de brief): niet-null is
   * een VASTE set activiteit-ID's (zie getOrCreateLibraryPreviewActivityIds)
   * die ongeacht filter/bron/zoekterm als "vrij" gelden — alle overige
   * gefilterde resultaten worden nog steeds gerenderd, maar dan vervaagd/
   * vergrendeld (zie isItemUnlocked/LibraryItemCard's `locked`-prop) i.p.v.
   * simpelweg niet getoond. null (standaard) is het normale, onbeperkte
   * gedrag.
   */
  previewActivityIds?: string[] | null;
  /** Voor de "eigen bijdrage blijft altijd vrij"-uitzondering, zie isItemUnlocked. */
  currentUserId?: string | null;
}) {
  // Onthoud de laatst gekozen bron-tab per gebruiker (localStorage via de
  // module-level store hierboven) — geen server-round-trip nodig voor een
  // pure weergavevoorkeur. Server-snapshot is altijd "all", dus client- en
  // server-markup blijven identiek bij hydratie.
  const [sourceFilter, setSourceFilter] = useStoredSourceFilter();
  const [persisted, setPersisted] = useStoredSearchState();
  const [draft, setDraft] = useState<FilterState>(EMPTY_FILTERS);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const isDesktop = useIsDesktop();

  const query = persisted.query;
  const filters = useMemo(() => toFilterState(persisted), [persisted]);

  const activeCount = countActive(filters);

  function resetPaging() {
    setVisibleCount(PAGE_SIZE);
  }

  function selectSourceFilter(value: SourceFilter) {
    setSourceFilter(value);
    resetPaging();
  }

  function setQuery(value: string) {
    setPersisted({ ...persisted, query: value });
    resetPaging();
  }

  function setSort(value: SortOption) {
    setPersisted({ ...persisted, sort: value });
    resetPaging();
  }

  function commitFilters(next: FilterState) {
    setPersisted({
      ...persisted,
      categorie: [...next.categorie],
      leerlijn: [...next.leerlijn],
      doelgroep: [...next.doelgroep],
      weinigMateriaal: next.weinigMateriaal,
    });
    resetPaging();
  }

  function openSheet() {
    setDraft(filters); // seed the drawer with whatever is currently committed
    setSheetOpen(true);
  }

  function applyDraft() {
    commitFilters(draft);
    setSheetOpen(false);
  }

  function clearAll() {
    setPersisted(EMPTY_PERSISTED_STATE);
    setDraft(EMPTY_FILTERS);
    resetPaging();
    setSheetOpen(false);
  }

  // Bron + zoekterm toegepast, vóór categorie/leerlijn/doelgroep/materiaal —
  // de basis waartegen "X van Y resultaten" en de per-categorie-tellingen in
  // de sheet worden afgezet.
  const preFilterItems = useMemo(() => {
    const trimmedQuery = query.trim();

    const gymwikiItems: LibraryListItem[] = activities
      .filter((activity) => matchesActivityQuery(activity, trimmedQuery))
      .map((activity) => ({ source: "gymwiki" as const, id: activity.id, activity }));

    const publicItems: LibraryListItem[] = publicActivities
      .filter((activity) => matchesActivityQuery(activity, trimmedQuery))
      .map((activity) => ({ source: "public" as const, id: activity.id, activity }));

    if (sourceFilter === "gymwiki") return gymwikiItems;
    if (sourceFilter === "public") return publicItems;
    return [...gymwikiItems, ...publicItems];
  }, [activities, publicActivities, query, sourceFilter]);

  // Hoeveel resultaten er per categorie in preFilterItems zitten — voedt de
  // tellingen naast elke categorie in de filter-sheet, zodat je vóór het
  // selecteren al ziet wat de moeite waard is.
  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of preFilterItems) {
      const { categorie } = toFilterableFields(item);
      if (!categorie) continue;
      counts.set(categorie, (counts.get(categorie) ?? 0) + 1);
    }
    return counts;
  }, [preFilterItems]);

  // Categorie/leerlijn/doelgroep/materiaal-filters gelden voor beide
  // brontypes: een lesvoorbereiding heeft geen eigen `categorie`-kolom, maar
  // die wordt afgeleid uit `learning_line` (zie getCategoryForLearningLine),
  // en "materiaal" is de som van basis- en regelmateriaal.
  const filteredItems = useMemo(() => {
    return preFilterItems.filter((item) => {
      const { categorie, leerlijn, doelgroep, materiaalCount } = toFilterableFields(item);

      if (filters.categorie.size > 0 || filters.leerlijn.size > 0) {
        const matchesCategorie = filters.categorie.has(categorie);
        const matchesLeerlijn = filters.leerlijn.has(leerlijn);
        if (!matchesCategorie && !matchesLeerlijn) return false;
      }

      if (filters.doelgroep.size > 0 && !doelgroep.some((waarde) => filters.doelgroep.has(waarde))) {
        return false;
      }

      if (filters.weinigMateriaal && materiaalCount > WEINIG_MATERIAAL_MAX) {
        return false;
      }

      return true;
    });
  }, [preFilterItems, filters]);

  // Losse sorteerstap, ná filteren — "Meest gewaardeerd" sorteert op
  // like_count aflopend (het gedenormaliseerde veld op activiteiten, zie
  // supabase/migrations/activity_likes.sql). Nieuwe array (i.p.v. in-place
  // sort) zodat filteredItems zelf niet muteert.
  const sortedItems = useMemo(() => {
    if (persisted.sort !== "meest_gewaardeerd") return filteredItems;
    return [...filteredItems].sort((a, b) => b.activity.like_count - a.activity.like_count);
  }, [filteredItems, persisted.sort]);

  // Eén losstaande, verwijderbare chip per actief filter — categorie draagt
  // z'n kleurmarkering mee, de rest blijft kleurloos (zie CategorySwatch).
  const activeChips = useMemo(() => {
    const chips: ActiveChip[] = [];

    filters.categorie.forEach((categorie) => {
      chips.push({
        key: `categorie:${categorie}`,
        label: categorie,
        category: categorie,
        onRemove: () => commitFilters({ ...filters, categorie: toggle(filters.categorie, categorie) }),
      });
    });

    filters.leerlijn.forEach((line) => {
      chips.push({
        key: `leerlijn:${line}`,
        label: line,
        onRemove: () => commitFilters({ ...filters, leerlijn: toggle(filters.leerlijn, line) }),
      });
    });

    filters.doelgroep.forEach((waarde) => {
      chips.push({
        key: `doelgroep:${waarde}`,
        label: DOELGROEP_LABELS[waarde],
        onRemove: () => commitFilters({ ...filters, doelgroep: toggle(filters.doelgroep, waarde) }),
      });
    });

    if (filters.weinigMateriaal) {
      chips.push({
        key: "weinigMateriaal",
        label: "Weinig materiaal",
        onRemove: () => commitFilters({ ...filters, weinigMateriaal: false }),
      });
    }

    return chips;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- commitFilters closes over `persisted`/`filters` fresh each render; only `filters` itself should retrigger this list.
  }, [filters]);

  const previewIdSet = useMemo(
    () => (previewActivityIds === null ? null : new Set(previewActivityIds)),
    [previewActivityIds],
  );

  // Render ALLE gefilterde resultaten (vervaagd/vergrendeld voorbij de
  // preview-set) i.p.v. de vroegere harde afkap na N kaarten — dezelfde
  // PAGE_SIZE-paginering als voor onbeperkte gebruikers houdt dit ook bij
  // een grote resultatenlijst (bijv. 340 activiteiten) licht: nooit meer
  // dan 24 kaarten (waarvan hooguit een paar los-vervaagd) tegelijk in de
  // DOM, i.p.v. alles in één keer met blur() te renderen.
  const visible = sortedItems.slice(0, visibleCount);
  const hasActiveFilters = query.trim() !== "" || activeCount > 0;
  const unlockedInFilterCount = useMemo(
    () => filteredItems.filter((item) => isItemUnlocked(item, previewIdSet, currentUserId)).length,
    [filteredItems, previewIdSet, currentUserId],
  );
  const hasLockedItems = previewIdSet !== null && unlockedInFilterCount < filteredItems.length;

  return (
    <div className="lg:grid lg:grid-cols-[17rem_1fr] lg:items-start lg:gap-6">
      {/* Permanente filter-sidebar — alleen vanaf lg. Onder lg blijft de
          Sheet-drawer (zie return verder naar onder) de enige weergave; een
          altijd-open paneel zou daar te veel ruimte inpikken naast de
          resultaten. Werkt direct op `filters` (instant toepassen, geen
          "Toepassen"-stap) — dat is wat je van een permanent zichtbaar
          desktop-paneel verwacht. */}
      <aside className="hidden lg:sticky lg:top-6 lg:block lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto lg:rounded-2xl lg:border lg:bg-card lg:p-5">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-foreground">Filters</h2>
          {activeCount > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              Wis alles
            </button>
          )}
        </div>
        <FilterSections
          state={filters}
          categoryCounts={categoryCounts}
          onCategorieAlles={(category, lines) =>
            commitFilters(applyCategorieAlles(filters, category, lines))
          }
          onLeerlijnToggle={(category, line) =>
            commitFilters(applyLeerlijnToggle(filters, category, line))
          }
          onDoelgroepToggle={(waarde) =>
            commitFilters({ ...filters, doelgroep: toggle(filters.doelgroep, waarde) })
          }
          onWeinigMateriaalToggle={() =>
            commitFilters({ ...filters, weinigMateriaal: !filters.weinigMateriaal })
          }
        />
      </aside>

      <div className="min-w-0 space-y-4">
        <div className="flex overflow-hidden rounded-md border w-fit max-w-full">
          {SOURCE_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => selectSourceFilter(tab.value)}
              className={cn(
                "min-h-9 px-3.5 py-2 text-xs font-medium whitespace-nowrap transition-colors duration-150 ease-brand first:border-l-0 border-l",
                sourceFilter === tab.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-background hover:bg-accent",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Zoek op trefwoord, bijv. trefbal, keeperspelen, groep 7…"
              className="h-12 pl-10 text-base"
              aria-label="Zoek in de bibliotheek"
            />
          </div>
          <Button
            variant="outline"
            className="relative h-12 shrink-0 px-3 lg:hidden"
            onClick={openSheet}
            aria-label={activeCount > 0 ? `Filters, ${activeCount} actief` : "Filters"}
          >
            <SlidersHorizontal className="size-4" />
            Filters
            {activeCount > 0 && (
              <Badge className="absolute -top-2 -right-2 size-5 justify-center rounded-full p-0">
                {activeCount}
              </Badge>
            )}
          </Button>
        </div>

        {activeChips.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {activeChips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={chip.onRemove}
                aria-label={`Verwijder filter ${chip.label}`}
                className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 py-1 pr-1.5 pl-2.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                {chip.category && <CategorySwatch category={chip.category} />}
                {chip.label}
                <X className="size-3.5" aria-hidden="true" />
              </button>
            ))}
            {activeChips.length > 1 && (
              <button
                type="button"
                onClick={clearAll}
                className="text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline lg:hidden"
              >
                Wis alles
              </button>
            )}
          </div>
        )}

        {filteredItems.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title={
              activities.length === 0 && publicActivities.length === 0
                ? "Nog geen activiteiten in de bibliotheek"
                : "Niets gevonden"
            }
            description={
              activities.length === 0 && publicActivities.length === 0
                ? "Zodra er activiteiten zijn, kun je ze hier terugvinden."
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
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">
                {preFilterItems.length === filteredItems.length
                  ? `${filteredItems.length} ${filteredItems.length === 1 ? "resultaat" : "resultaten"} gevonden`
                  : `${filteredItems.length} van ${preFilterItems.length} resultaten`}
              </p>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                Sorteer op
                <select
                  value={persisted.sort}
                  onChange={(event) => setSort(event.target.value as SortOption)}
                  aria-label="Sorteer op"
                  className="h-9 rounded-md border border-input bg-transparent px-2 text-sm text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
                >
                  {SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {hasLockedItems && (
              <Card className="border-destructive/40 bg-destructive/5">
                <CardContent className="flex flex-col items-center gap-3 py-4 text-center sm:flex-row sm:items-start sm:justify-between sm:text-left">
                  <div className="flex items-start gap-3">
                    <Lock className="mt-0.5 size-5 shrink-0 text-destructive" />
                    <p className="text-sm">
                      <span className="font-semibold">
                        {unlockedInFilterCount} van {filteredItems.length} activiteiten vrij toegankelijk.
                      </span>{" "}
                      De rest zie je vervaagd — rond je bijdrage af of upgrade voor volledige toegang.
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button asChild size="sm">
                      <Link href="/les-maken">Activiteit toevoegen</Link>
                    </Button>
                    <Button asChild size="sm" variant="outline">
                      <Link href="/pro">Upgraden</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4">
              {visible.map((item, index) => (
                <div
                  key={`${item.source}-${item.id}`}
                  className="animate-fade-up"
                  style={{ animationDelay: `${Math.min(index, 6) * 40}ms` }}
                >
                  <LibraryItemCard item={item} locked={!isItemUnlocked(item, previewIdSet, currentUserId)} />
                </div>
              ))}
            </div>
            {visibleCount < filteredItems.length && (
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

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side={isDesktop ? "right" : "bottom"} className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Filters</SheetTitle>
          </SheetHeader>

          <div className="overflow-y-auto px-4">
            <FilterSections
              state={draft}
              categoryCounts={categoryCounts}
              onCategorieAlles={(category, lines) =>
                setDraft((prev) => applyCategorieAlles(prev, category, lines))
              }
              onLeerlijnToggle={(category, line) =>
                setDraft((prev) => applyLeerlijnToggle(prev, category, line))
              }
              onDoelgroepToggle={(waarde) =>
                setDraft((prev) => ({ ...prev, doelgroep: toggle(prev.doelgroep, waarde) }))
              }
              onWeinigMateriaalToggle={() =>
                setDraft((prev) => ({ ...prev, weinigMateriaal: !prev.weinigMateriaal }))
              }
            />
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
