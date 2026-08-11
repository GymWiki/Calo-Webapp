import Link from "next/link";
import { LayoutTemplate, SquarePen, Trophy, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

const ACCENTS = {
  cone: "bg-primary/10 text-primary",
  blue: "bg-line-blue/10 text-line-blue",
  yellow: "bg-court-yellow/20 text-court-yellow",
} as const;

type QuickAction = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  accent: keyof typeof ACCENTS;
  primary?: boolean;
};

const ACTIONS: QuickAction[] = [
  {
    href: "/les-maken",
    label: "Nieuwe les maken",
    description: "Bouw een volledige lesvoorbereiding stap voor stap op.",
    icon: SquarePen,
    accent: "cone",
    primary: true,
  },
  {
    href: "/toernooi",
    label: "Toernooi Generator",
    description: "Genereer binnen een minuut een eerlijk wedstrijdschema.",
    icon: Trophy,
    accent: "yellow",
  },
  {
    href: "/les-maken?tab=voorbereiding",
    label: "Zaal-Plattegrond Tekenen",
    description: "Spring direct naar de canvas en bouw de opstelling.",
    icon: LayoutTemplate,
    accent: "blue",
  },
];

export function QuickActionGrid() {
  return (
    <div>
      <h2 className="text-lg font-semibold">Snelle acties</h2>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.href}
              href={action.href}
              className={cn(
                "group flex flex-col gap-3 rounded-2xl border p-5 shadow-brand-sm transition-transform duration-200 ease-brand hover:-translate-y-0.5 hover:shadow-brand-md",
                action.primary ? "border-primary/40 bg-primary/5" : "bg-card",
              )}
            >
              <div
                className={cn(
                  "flex size-10 items-center justify-center rounded-full",
                  ACCENTS[action.accent],
                )}
              >
                <Icon className="size-5" aria-hidden="true" />
              </div>
              <div>
                <p className="font-semibold">{action.label}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {action.description}
                </p>
              </div>
              <span className="mt-auto text-sm font-medium text-primary group-hover:underline">
                {action.primary ? "Beginnen →" : "Openen →"}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
