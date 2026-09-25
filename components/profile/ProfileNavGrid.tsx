import Link from "next/link";
import { Bookmark, CalendarRange, ListChecks, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

const ACCENTS = {
  cone: "bg-primary/10 text-primary",
  blue: "bg-line-blue/10 text-line-blue",
  green: "bg-emerald-500/10 text-emerald-600",
} as const;

type NavCard = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  accent: keyof typeof ACCENTS;
  count: number;
};

// Voorheen vier losse blokken (activiteiten/lessen/opgeslagen/concepten) —
// "lessen" en "activiteiten" zijn nu hetzelfde concept (zie
// supabase/migrations/consolidate_lessons_into_activiteiten.sql), en de
// status van een concept staat gewoon per item in "Mijn activiteiten"
// zichtbaar, dus die twee blokken zijn niet langer apart nodig. "Planning"
// (klassenbeheer + maandkalender) is een nieuw, apart concept — geen
// overlap met "Mijn activiteiten" — en telt daarom als vierde kaart.
export function ProfileNavGrid({
  activitiesCount,
  savedCount,
  classesCount,
}: {
  activitiesCount: number;
  savedCount: number;
  classesCount: number;
}) {
  const cards: NavCard[] = [
    {
      href: "/profiel/activiteiten",
      label: "Mijn activiteiten",
      description: "Al je activiteiten — inclusief concepten, met status per item.",
      icon: ListChecks,
      accent: "cone",
      count: activitiesCount,
    },
    {
      href: "/profiel/opgeslagen",
      label: "Opgeslagen activiteiten",
      description: "Je favoriete activiteiten uit de bibliotheek.",
      icon: Bookmark,
      accent: "blue",
      count: savedCount,
    },
    {
      href: "/profiel/planning",
      label: "Planning",
      description: "Klassen en een maandkalender met geplande lesmomenten.",
      icon: CalendarRange,
      accent: "green",
      count: classesCount,
    },
  ];

  return (
    <div>
      <h2 className="text-lg font-semibold">Overzicht</h2>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.href}
              href={card.href}
              className="group flex flex-col gap-3 rounded-2xl border bg-card p-5 shadow-brand-sm transition-transform duration-200 ease-brand hover:-translate-y-0.5 hover:shadow-brand-md"
            >
              <div className="flex items-center justify-between">
                <div
                  className={cn(
                    "flex size-10 items-center justify-center rounded-full",
                    ACCENTS[card.accent],
                  )}
                >
                  <Icon className="size-5" aria-hidden="true" />
                </div>
                <span className="font-mono text-xs font-semibold text-muted-foreground">
                  {card.count}
                </span>
              </div>
              <div>
                <p className="font-semibold">{card.label}</p>
                <p className="mt-1 text-sm text-muted-foreground">{card.description}</p>
              </div>
              <span className="mt-auto text-sm font-medium text-primary group-hover:underline">
                Bekijken →
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
