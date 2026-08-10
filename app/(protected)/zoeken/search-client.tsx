"use client";

import { useMemo, useState } from "react";
import { Search, SearchX } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { LessonCard } from "@/components/lesson-card";
import { Input } from "@/components/ui/input";
import type { LessonWithDetails } from "@/types/lesson";

function matches(lesson: LessonWithDetails, query: string) {
  const haystack = [
    lesson.title,
    lesson.group_name,
    lesson.learning_line,
    lesson.movement_theme,
    lesson.movement_problem,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(query.toLowerCase());
}

export function SearchClient({ lessons }: { lessons: LessonWithDetails[] }) {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    if (!query.trim()) return lessons;
    return lessons.filter((lesson) => matches(lesson, query.trim()));
  }, [lessons, query]);

  return (
    <div className="space-y-6">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Zoek op titel, groep, leerlijn of thema…"
          className="h-11 pl-10"
          aria-label="Zoek lesvoorbereidingen"
        />
      </div>

      {results.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title={
            lessons.length === 0
              ? "Nog geen openbare lessen om te doorzoeken"
              : "Geen lessen gevonden"
          }
          description={
            lessons.length === 0
              ? "Zodra er lesvoorbereidingen openbaar gedeeld worden, kun je ze hier terugvinden."
              : `Niets gevonden voor "${query}". Probeer een andere zoekterm.`
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((lesson, index) => (
            <div
              key={lesson.id}
              className="animate-fade-up"
              style={{ animationDelay: `${Math.min(index, 6) * 40}ms` }}
            >
              <LessonCard lesson={lesson} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
