"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Lock, Search } from "lucide-react";
import { toast } from "sonner";

import { addActivitiesToLesson } from "@/actions/planning";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { DOELGROEP_LABELS, DOELGROEP_WAARDEN, type Activity } from "@/types/activity";
import type { ClassLessonEntry } from "@/types/planning";

const RESULT_LIMIT = 50;

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium outline-none transition-[color,box-shadow,background-color,transform] duration-150 ease-brand focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 active:scale-[0.98]",
        active ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background text-foreground hover:bg-accent",
      )}
    >
      {children}
    </button>
  );
}

function matchesQuery(activity: Activity, query: string): boolean {
  if (!query) return true;
  const haystack = [activity.titel, activity.leerlijn, activity.beschrijving].filter(Boolean).join(" ").toLowerCase();
  return haystack.includes(query);
}

function ActivityRow({
  activity,
  selected,
  locked,
  onToggle,
}: {
  activity: Activity;
  selected: boolean;
  locked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={locked}
      onClick={onToggle}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors duration-150 ease-brand",
        locked
          ? "cursor-not-allowed border-dashed bg-muted/40 opacity-70"
          : selected
            ? "border-primary bg-primary/5 hover:bg-primary/10"
            : "border-input bg-background hover:bg-accent active:scale-[0.99]",
      )}
    >
      <span
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-full border",
          selected ? "border-primary bg-primary text-primary-foreground" : "border-input",
        )}
        aria-hidden="true"
      >
        {locked ? <Lock className="size-3" /> : selected ? <Check className="size-3" /> : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{activity.titel}</span>
        <span className="block truncate text-xs text-muted-foreground">{activity.leerlijn ?? "Geen leerlijn"}</span>
      </span>
    </button>
  );
}

/**
 * Multi-select-body — apart van AddActivitiesToLessonSheet en geremount bij
 * elke open-toggle (zie de `key` op de aanroep hieronder), zodat filters/
 * selectie altijd vers beginnen (zelfde afweging als elders in deze feature,
 * bijv. ClassFormDialog.tsx).
 */
function AddActivitiesToLessonSheetBody({
  entry,
  classId,
  doelgroep,
  savedActivities,
  libraryActivities,
  hasFullLibraryAccess,
  currentUserId,
  onOpenChange,
}: {
  entry: ClassLessonEntry;
  classId: string;
  doelgroep: number;
  savedActivities: Activity[];
  libraryActivities: Activity[];
  hasFullLibraryAccess: boolean;
  currentUserId: string;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"opgeslagen" | "bibliotheek">("opgeslagen");
  const [query, setQuery] = useState("");
  const [doelgroepFilter, setDoelgroepFilter] = useState<number | null>(doelgroep);
  const [leerlijnFilter, setLeerlijnFilter] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSubmitting, startTransition] = useTransition();

  const savedIds = useMemo(() => new Set(savedActivities.map((activity) => activity.id)), [savedActivities]);
  const activeList = tab === "opgeslagen" ? savedActivities : libraryActivities;

  const leerlijnen = useMemo(
    () => [...new Set(activeList.map((activity) => activity.leerlijn).filter((value): value is string => Boolean(value)))].sort(),
    [activeList],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return activeList.filter((activity) => {
      if (doelgroepFilter !== null && !(activity.doelgroep ?? []).includes(doelgroepFilter)) return false;
      if (leerlijnFilter.size > 0 && !(activity.leerlijn && leerlijnFilter.has(activity.leerlijn))) return false;
      return matchesQuery(activity, q);
    });
  }, [activeList, query, doelgroepFilter, leerlijnFilter]);

  function toggleLeerlijn(line: string) {
    setLeerlijnFilter((current) => {
      const next = new Set(current);
      if (next.has(line)) next.delete(line);
      else next.add(line);
      return next;
    });
  }

  function toggleSelected(activityId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(activityId)) next.delete(activityId);
      else next.add(activityId);
      return next;
    });
  }

  function isLocked(activity: Activity): boolean {
    if (tab !== "bibliotheek") return false;
    if (hasFullLibraryAccess) return false;
    return activity.author_id !== currentUserId && !savedIds.has(activity.id);
  }

  function handleConfirm() {
    if (selectedIds.size === 0) return;
    startTransition(async () => {
      const result = await addActivitiesToLesson({
        classId,
        lessonDate: entry.date,
        startTime: entry.startTime,
        activityIds: [...selectedIds],
      });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(selectedIds.size === 1 ? "Activiteit toegevoegd." : `${selectedIds.size} activiteiten toegevoegd.`);
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <>
      <SheetHeader>
        <SheetTitle>Activiteit toevoegen</SheetTitle>
        <SheetDescription>Kies één of meerdere activiteiten voor dit lesmoment.</SheetDescription>
      </SheetHeader>

      <Tabs value={tab} onValueChange={(value) => setTab(value as "opgeslagen" | "bibliotheek")} className="flex min-h-0 flex-1 flex-col">
        <div className="px-4">
          <TabsList className="w-full">
            <TabsTrigger value="opgeslagen" className="flex-1">
              Opgeslagen
            </TabsTrigger>
            <TabsTrigger value="bibliotheek" className="flex-1">
              Bibliotheek
            </TabsTrigger>
          </TabsList>
        </div>

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

          <div className="flex flex-wrap gap-1.5">
            {DOELGROEP_WAARDEN.map((waarde) => (
              <FilterChip
                key={waarde}
                active={doelgroepFilter === waarde}
                onClick={() => setDoelgroepFilter((current) => (current === waarde ? null : waarde))}
              >
                {DOELGROEP_LABELS[waarde]}
              </FilterChip>
            ))}
          </div>

          {leerlijnen.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {leerlijnen.map((line) => (
                <FilterChip key={line} active={leerlijnFilter.has(line)} onClick={() => toggleLeerlijn(line)}>
                  {line}
                </FilterChip>
              ))}
            </div>
          )}

          {tab === "bibliotheek" && !hasFullLibraryAccess && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm">
              <span>Activiteiten van anderen zijn alleen met een betaald abonnement toe te voegen.</span>
              <Button asChild size="sm" variant="outline" className="shrink-0">
                <Link href="/pro">Upgrade</Link>
              </Button>
            </div>
          )}

          <TabsContent value={tab} className="mt-0 space-y-1.5">
            {filtered.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Geen activiteiten gevonden.</p>
            ) : (
              filtered
                .slice(0, RESULT_LIMIT)
                .map((activity) => (
                  <ActivityRow
                    key={activity.id}
                    activity={activity}
                    selected={selectedIds.has(activity.id)}
                    locked={isLocked(activity)}
                    onToggle={() => toggleSelected(activity.id)}
                  />
                ))
            )}
          </TabsContent>
        </div>
      </Tabs>

      <SheetFooter>
        <Button type="button" disabled={selectedIds.size === 0 || isSubmitting} onClick={handleConfirm}>
          {isSubmitting ? "Toevoegen…" : `Toevoegen (${selectedIds.size})`}
        </Button>
      </SheetFooter>
    </>
  );
}

/**
 * Multi-select bottom sheet voor "+ Activiteit toevoegen" in LessonContainer
 * — tabs Opgeslagen/Bibliotheek, doelgroep/leerlijn-filters, meerdere
 * activiteiten tegelijk selecteren. Betaalmuur wordt hier alleen VISUEEL
 * afgedwongen (vergrendelde rijen); de daadwerkelijke handhaving gebeurt
 * server-side in actions/planning.ts's addActivitiesToLesson.
 */
export function AddActivitiesToLessonSheet({
  open,
  onOpenChange,
  classId,
  doelgroep,
  entry,
  savedActivities,
  libraryActivities,
  hasFullLibraryAccess,
  currentUserId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classId: string;
  doelgroep: number;
  entry: ClassLessonEntry | null;
  savedActivities: Activity[];
  libraryActivities: Activity[];
  hasFullLibraryAccess: boolean;
  currentUserId: string;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85vh]">
        {entry && (
          <AddActivitiesToLessonSheetBody
            key="open"
            entry={entry}
            classId={classId}
            doelgroep={doelgroep}
            savedActivities={savedActivities}
            libraryActivities={libraryActivities}
            hasFullLibraryAccess={hasFullLibraryAccess}
            currentUserId={currentUserId}
            onOpenChange={onOpenChange}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}
