"use client";

import { Search, X } from "lucide-react";
import Image from "next/image";
import { useMemo, useState } from "react";

import {
  DEFAULT_POSE_ID,
  STUDENT_CATEGORIES,
  STUDENT_POSES,
  filterPoses,
  studentCategoriesInUse,
  studentSportLabel,
  studentSportsOf,
  type StudentCategoryId,
  type StudentPose,
} from "@/lib/students/catalog";
import { cn } from "@/lib/utils";

/** Minimaal 44 px op touch (pointer-coarse), 36 px met de muis. */
const TAP = "min-h-9 pointer-coarse:min-h-11";
const CHIP = "shrink-0 rounded-full border px-3 text-sm font-medium whitespace-nowrap focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none";

function Chip({ active, onClick, testId, children }: { active: boolean; onClick: () => void; testId?: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      data-testid={testId}
      className={cn(CHIP, TAP, active ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-accent")}
    >
      {children}
    </button>
  );
}

/**
 * Keuze van de pose van een leerling: zoeken, filteren op beweegcategorie (standaard, spel, atletiek, turnen, zelfverdediging, …)
 * en op sport binnen die categorie, en een raster met voorbeeldplaatjes. Zonder categoriekeuze staan de resultaten gegroepeerd per
 * categorie. De categorieën en sporten volgen vanzelf uit lib/students/poses.json: een nieuwe pose of categorie vraagt geen code.
 */
export function PosePicker({
  currentSlug,
  previewBySlug,
  disabled,
  onSelect,
}: {
  currentSlug: string;
  previewBySlug: ReadonlyMap<string, string | null | undefined>;
  disabled: boolean;
  onSelect: (pose: StudentPose) => void;
}) {
  const [query, setQuery] = useState("");
  const [categorie, setCategorie] = useState<StudentCategoryId | null>(null);
  const [sport, setSport] = useState<string | null>(null);

  const categories = useMemo(() => studentCategoriesInUse(), []);
  const sportsInScope = useMemo(
    () => studentSportsOf(categorie ? STUDENT_POSES.filter((pose) => pose.categorie === categorie) : STUDENT_POSES),
    [categorie],
  );
  const poses = useMemo(() => filterPoses(STUDENT_POSES, { query, sport, categorie }), [query, sport, categorie]);
  const groups = useMemo(
    () =>
      (categorie ? [{ id: categorie, label: "", poses }] : STUDENT_CATEGORIES.map((category) => ({ ...category, poses: poses.filter((pose) => pose.categorie === category.id) }))).filter(
        (group) => group.poses.length > 0,
      ),
    [categorie, poses],
  );
  const filtered = Boolean(query.trim() || categorie || sport);

  function chooseCategory(next: StudentCategoryId | null) {
    setCategorie(next);
    // Een sport die niet in de nieuwe categorie voorkomt, zou niets meer opleveren.
    if (sport && next && !STUDENT_POSES.some((pose) => pose.categorie === next && pose.sporten.includes(sport))) setSport(null);
  }

  function clearFilters() {
    setQuery("");
    setCategorie(null);
    setSport(null);
  }

  return (
    <div data-testid="poseskeuze">
      <div className="relative mb-2">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Zoek pose, sport of beweging..."
          aria-label="Zoek pose"
          className={cn("w-full rounded-md border bg-background pr-8 pl-9 text-sm focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none [&::-webkit-search-cancel-button]:hidden", TAP)}
        />
        {query && (
          <button type="button" aria-label="Zoekopdracht wissen" onClick={() => setQuery("")} className="absolute top-1/2 right-2 flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:text-foreground">
            <X className="size-3.5" aria-hidden="true" />
          </button>
        )}
      </div>

      <div role="group" aria-label="Beweegcategorie" className="mb-2 flex flex-wrap gap-1.5">
        <Chip active={categorie === null} onClick={() => chooseCategory(null)} testId="categorie-alle">
          Alle <span className="text-xs font-normal opacity-70">{STUDENT_POSES.length}</span>
        </Chip>
        {categories.map((category) => (
          <Chip key={category.id} active={categorie === category.id} onClick={() => chooseCategory(category.id)} testId={`categorie-${category.id}`}>
            {category.label} <span className="text-xs font-normal opacity-70">{category.count}</span>
          </Chip>
        ))}
      </div>

      {sportsInScope.length > 1 && (
        <div className="mb-2 flex items-center gap-2">
          <label htmlFor="pose-sport" className="shrink-0 text-sm text-muted-foreground">
            Sport
          </label>
          <select
            id="pose-sport"
            value={sport ?? ""}
            onChange={(event) => setSport(event.target.value || null)}
            data-testid="sport-keuze"
            className={cn("min-w-0 flex-1 rounded-md border bg-background px-2 text-sm focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none", TAP)}
          >
            <option value="">Alle sporten</option>
            {sportsInScope.map((id) => (
              <option key={id} value={id}>
                {studentSportLabel(id)}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="mb-1.5 flex items-center justify-between gap-2 text-xs text-muted-foreground" aria-live="polite">
        <span data-testid="aantal-poses">{poses.length === 1 ? "1 pose" : `${poses.length} poses`}</span>
        {filtered && (
          <button type="button" onClick={clearFilters} data-testid="filters-wissen" className="rounded px-1 font-medium text-primary underline-offset-2 hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none">
            Filters wissen
          </button>
        )}
      </div>

      {poses.length === 0 ? (
        <p className="py-3 text-center text-sm text-muted-foreground">Geen poses gevonden. Probeer een andere zoekterm of wis de filters.</p>
      ) : (
        <div className="space-y-3" role="group" aria-label="Poses">
          {groups.map((group) => (
            <div key={group.id}>
              {group.label && <p className="mb-1 text-xs font-semibold text-muted-foreground">{group.label}</p>}
              <div className="grid grid-cols-3 gap-1.5 lg:grid-cols-2">
                {group.poses.map((pose) => {
                  const active = currentSlug === pose.slug;
                  const preview = previewBySlug.get(pose.slug);
                  return (
                    <button
                      key={pose.id}
                      type="button"
                      disabled={disabled}
                      aria-pressed={active}
                      aria-label={`Pose ${pose.label}`}
                      data-testid={`pose-${pose.id}`}
                      onClick={() => onSelect(pose)}
                      className={cn(
                        "flex min-h-11 flex-col overflow-hidden rounded-lg border bg-background text-left focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-50",
                        active ? "border-primary ring-2 ring-primary/40" : "hover:bg-accent",
                      )}
                    >
                      <span className="relative block h-16 w-full bg-muted/40 pointer-coarse:h-20">
                        {preview && <Image src={preview} alt="" fill sizes="(min-width: 1024px) 120px, 33vw" className="object-contain" />}
                      </span>
                      <span className="flex items-center justify-between gap-1 px-1.5 py-1 text-xs leading-tight font-medium">
                        {pose.label}
                        {pose.id === DEFAULT_POSE_ID && (
                          <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary" data-testid="pose-standaard-badge">
                            Start
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
