import Link from "next/link";
import { Bookmark, FileEdit, ListChecks, NotebookPen, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

const ACCENTS = {
  cone: "bg-primary/10 text-primary",
  blue: "bg-line-blue/10 text-line-blue",
  yellow: "bg-court-yellow/20 text-court-yellow",
} as const;

type NavCard = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  accent: keyof typeof ACCENTS;
  count: number;
};

export function ProfileNavGrid({
  activitiesCount,
  savedCount,
  lessonsCount,
  draftsCount,
}: {
  activitiesCount: number;
  savedCount: number;
  lessonsCount: number;
  draftsCount: number;
}) {
  const cards: NavCard[] = [
    {
      href: "/profiel/activiteiten",
      label: "Mijn activiteiten",
      description: "Eigen ingediende activiteiten met status.",
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
      href: "/profiel/lessen",
      label: "Mijn lessen",
      description: "Lesvoorbereidingen uit de canvas-editor.",
      icon: NotebookPen,
      accent: "yellow",
      count: lessonsCount,
    },
    {
      href: "/profiel/concepten",
      label: "Concepten",
      description: "Nog niet ingediende activiteiten.",
      icon: FileEdit,
      accent: "cone",
      count: draftsCount,
    },
  ];

  return (
    <div>
      <h2 className="text-lg font-semibold">Overzicht</h2>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
