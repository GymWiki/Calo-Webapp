"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { FileEdit, ListPlus, Search, SearchX } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { MyActivityCard } from "@/components/my-activity-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Activity } from "@/types/activity";

function matchesQuery(activity: Activity, query: string): boolean {
  const haystack = [activity.titel, activity.leerlijn]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(query.toLowerCase());
}

function ActivitySearchBar({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-11 pl-10"
        aria-label={placeholder}
      />
    </div>
  );
}

function ActivityGrid({
  activities,
  query,
  emptyState,
}: {
  activities: Activity[];
  query: string;
  emptyState: ReactNode;
}) {
  const filtered = useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed) return activities;
    return activities.filter((activity) => matchesQuery(activity, trimmed));
  }, [activities, query]);

  if (activities.length === 0) {
    return emptyState;
  }

  if (filtered.length === 0) {
    return (
      <EmptyState
        icon={SearchX}
        title="Niets gevonden"
        description="Niets gevonden voor deze zoekterm."
        className="mt-4"
      />
    );
  }

  return (
    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {filtered.map((activity) => (
        <MyActivityCard key={activity.id} activity={activity} />
      ))}
    </div>
  );
}

/**
 * "Mijn activiteiten": twee tabbladen — Concepten (status 'draft', nog niet
 * op "Activiteit opslaan" geklikt) en Activiteiten (daadwerkelijk opgeslagen,
 * pending/approved/rejected, zowel privé als gedeeld) — consistent met het
 * "Eigen documenten"/"Standaardbibliotheek"-tabbladpatroon op /kennisbank.
 * Kaarten delen dezelfde bibliotheek-tegelstijl als /zoeken (zie
 * MyActivityCard/TILE_CLASS), met status- en privé/gedeeld-badges i.p.v. een
 * bron-badge.
 */
export function OwnActivitiesSection({
  drafts,
  submissions,
  defaultTab = "concepten",
}: {
  drafts: Activity[];
  submissions: Activity[];
  /** Welk tabblad standaard open staat — bijv. vanuit de dashboard-
   * statistiekkaart "Activiteiten gemaakt" (?tab=activiteiten), die
   * specifiek naar het "Activiteiten"-tabblad wil linken, niet "Concepten". */
  defaultTab?: "concepten" | "activiteiten";
}) {
  const [draftQuery, setDraftQuery] = useState("");
  const [submissionQuery, setSubmissionQuery] = useState("");

  return (
    <Tabs defaultValue={defaultTab}>
      <TabsList>
        <TabsTrigger value="concepten">Concepten ({drafts.length})</TabsTrigger>
        <TabsTrigger value="activiteiten">Activiteiten ({submissions.length})</TabsTrigger>
      </TabsList>

      <TabsContent value="concepten" className="space-y-4">
        {drafts.length > 0 && (
          <ActivitySearchBar
            value={draftQuery}
            onChange={setDraftQuery}
            placeholder="Zoek in je concepten..."
          />
        )}
        <ActivityGrid
          activities={drafts}
          query={draftQuery}
          emptyState={
            <EmptyState
              icon={FileEdit}
              title="Nog geen concepten"
              description="Begin een nieuwe activiteit — tussentijdse wijzigingen worden automatisch als concept opgeslagen."
              className="mt-4"
              action={
                <Button asChild>
                  <Link href="/les-maken">Nieuwe activiteit</Link>
                </Button>
              }
            />
          }
        />
      </TabsContent>

      <TabsContent value="activiteiten" className="space-y-4">
        {submissions.length > 0 && (
          <ActivitySearchBar
            value={submissionQuery}
            onChange={setSubmissionQuery}
            placeholder="Zoek in je activiteiten..."
          />
        )}
        <ActivityGrid
          activities={submissions}
          query={submissionQuery}
          emptyState={
            <EmptyState
              icon={ListPlus}
              title="Nog geen activiteiten opgeslagen"
              description="Rond een concept af via 'Activiteit opslaan' om 'm hier terug te vinden."
              className="mt-4"
              action={
                <Button asChild>
                  <Link href="/les-maken">Naar de activiteit-maken wizard</Link>
                </Button>
              }
            />
          }
        />
      </TabsContent>
    </Tabs>
  );
}
