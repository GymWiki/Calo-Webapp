"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight } from "lucide-react";

import { IsoScene, type IsoBlock, type IsoCone } from "@/components/landing/IsoScene";
import { GUEST_TOOL_PATH } from "@/lib/guest/constants";
import { cn } from "@/lib/utils";

type Scene = { id: string; label: string; uitleg: string; voorbeeld: string; blocks: IsoBlock[]; cones: IsoCone[] };

const SCENES: Scene[] = [
  {
    id: "turnen",
    label: "Turncircuit",
    uitleg: "Matten, een bank en een kast als circuit: drie stations in één zaal.",
    voorbeeld: "opstelling-turnen",
    blocks: [
      { x: 1.5, y: 1.5, w: 3.5, d: 2, h: 0.35, color: "#7c5cff" },
      { x: 6.5, y: 1.5, w: 3, d: 1, h: 0.5, color: "#16a34a" },
      { x: 2, y: 5, w: 1.8, d: 1.8, h: 1.1, color: "#f59e0b" },
      { x: 6.5, y: 4.8, w: 3.5, d: 2, h: 0.35, color: "#7c5cff" },
    ],
    cones: [],
  },
  {
    id: "volleybal",
    label: "Volleybal",
    uitleg: "Een veld van 9 × 18 m met een net in het midden van de zaal.",
    voorbeeld: "volleybal",
    blocks: [{ x: 5.8, y: 0.8, w: 0.4, d: 6.4, h: 1.7, color: "#e5e7eb" }],
    cones: [
      { x: 1.5, y: 1 }, { x: 10.5, y: 1 }, { x: 10.5, y: 7 }, { x: 1.5, y: 7 },
    ],
  },
  {
    id: "pionnen",
    label: "Veld afzetten",
    uitleg: "Kies de afmetingen en de pionnen worden gelijkmatig verdeeld en geteld.",
    voorbeeld: "veld-afzetten",
    blocks: [],
    cones: [
      { x: 2, y: 1.5 }, { x: 4, y: 1.5 }, { x: 6, y: 1.5 }, { x: 8, y: 1.5 }, { x: 10, y: 1.5 },
      { x: 10, y: 3.5 }, { x: 10, y: 5.5 }, { x: 2, y: 3.5 }, { x: 2, y: 5.5 },
      { x: 2, y: 6.5 }, { x: 4, y: 6.5 }, { x: 6, y: 6.5 }, { x: 8, y: 6.5 }, { x: 10, y: 6.5 },
    ],
  },
  {
    id: "stations",
    label: "Vier stations",
    uitleg: "Elke hoek een activiteit: overzichtelijk voor jezelf en voor de leerlingen.",
    voorbeeld: "circuit",
    blocks: [
      { x: 1, y: 1, w: 2.5, d: 2, h: 0.35, color: "#2454ff" },
      { x: 8.5, y: 1, w: 2.5, d: 2, h: 0.8, color: "#ef4444" },
      { x: 1, y: 5.2, w: 2.5, d: 2, h: 0.5, color: "#16a34a" },
      { x: 8.5, y: 5.2, w: 2.5, d: 2, h: 1.1, color: "#f59e0b" },
    ],
    cones: [{ x: 6, y: 4 }],
  },
];

/** Vier knoppen die de schets wisselen; elk scenario linkt door naar hetzelfde voorbeeld in de echte editor. */
export function InteractiveTeaser() {
  const [activeId, setActiveId] = useState(SCENES[0].id);
  const scene = SCENES.find((s) => s.id === activeId) ?? SCENES[0];
  return (
    <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <div>
        <div role="group" aria-label="Kies een voorbeeldopstelling" className="flex flex-wrap gap-2">
          {SCENES.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={item.id === activeId}
              onClick={() => setActiveId(item.id)}
              className={cn(
                "min-h-11 rounded-full border px-4 text-sm font-medium transition-all focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none active:scale-95",
                item.id === activeId ? "border-primary bg-primary text-primary-foreground shadow-sm" : "bg-card hover:border-primary/60 hover:bg-accent",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
        <p className="mt-5 min-h-[3.5rem] text-base text-muted-foreground" aria-live="polite">
          {scene.uitleg}
        </p>
        <Link
          href={`${GUEST_TOOL_PATH}#voorbeeld=${scene.voorbeeld}`}
          className="group mt-3 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-primary underline-offset-4 hover:underline"
        >
          Open dit voorbeeld in de echte editor
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </Link>
      </div>
      <div className="overflow-hidden rounded-2xl border bg-gradient-to-b from-orange-50 to-amber-100 p-3 dark:from-zinc-900 dark:to-zinc-800">
        <div key={scene.id} className="animate-fade-up" style={{ minHeight: 220 }}>
          <IsoScene blocks={scene.blocks} cones={scene.cones} className="mx-auto block h-auto w-full max-w-[520px]" />
        </div>
      </div>
    </div>
  );
}
