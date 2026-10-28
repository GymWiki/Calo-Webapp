"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Loader2, Play } from "lucide-react";

import { Button } from "@/components/ui/button";
import { draftStorageKey } from "@/components/canvas-3d/mobile/mobile-logic";
import { GUEST_BACKUP_KEY } from "@/lib/guest/constants";
import { GUEST_EXAMPLES, buildExamplePlan, type GuestExampleId } from "@/lib/guest/examples";
import { decodeFloorplan, readShareToken } from "@/lib/guest/share-codec";
import type { Floorplan3dData } from "@/types/floorplan3d";
import type { MaterialModel } from "@/types/materialModel";

// three/R3F komen pas binnen na een klik (of een #p=/#start-link): de tekstpagina blijft licht voor Lighthouse.
const Floorplan3dEditor = dynamic(() => import("@/components/canvas-3d/Floorplan3dEditor").then((mod) => mod.Floorplan3dEditor), {
  ssr: false,
});

type GuestPlan = { naam?: string; data: Floorplan3dData } | null;
type Phase = "idle" | "loading" | "open" | "error";

/** Bewaart de eigen kladversie voordat een gedeelde plattegrond of voorbeeld die zou overschrijven. */
function backupOwnDraft() {
  try {
    const raw = window.localStorage.getItem(draftStorageKey(null));
    if (raw) window.localStorage.setItem(GUEST_BACKUP_KEY, raw);
  } catch {
    // geen localStorage: niets te bewaren
  }
}

function hasStoredDraft(): boolean {
  try {
    return Boolean(window.localStorage.getItem(draftStorageKey(null)));
  } catch {
    return false;
  }
}

/**
 * Poster + start-knop van de gratis tool. De editor opent als schermvullende dialoog (dezelfde editor als voor ingelogde
 * gebruikers, in gastmodus). Het catalogusverzoek en de editor-chunk starten pas bij de eerste interactie.
 */
export function GuestToolLauncher() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [models, setModels] = useState<MaterialModel[]>([]);
  const [plan, setPlan] = useState<GuestPlan>(null);
  const [message, setMessage] = useState<string | null>(null);
  // Server/hydratie: false; daarna de echte waarde (leest localStorage bij elke render, goedkoop).
  const resumeAvailable = useSyncExternalStore(
    () => () => {},
    hasStoredDraft,
    () => false,
  );
  const catalogRef = useRef<Promise<MaterialModel[]> | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  const loadCatalog = useCallback((): Promise<MaterialModel[]> => {
    if (!catalogRef.current) {
      catalogRef.current = fetch("/api/gratis-tool/catalogus")
        .then(async (response) => {
          if (!response.ok) throw new Error(String(response.status));
          const body = (await response.json()) as { models: MaterialModel[] };
          return body.models;
        })
        .catch((error) => {
          catalogRef.current = null;
          throw error;
        });
    }
    return catalogRef.current;
  }, []);

  const start = useCallback(
    async (next: GuestPlan, options: { backup?: boolean } = {}) => {
      openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setMessage(null);
      setPhase("loading");
      try {
        const catalog = await loadCatalog();
        if (options.backup && hasStoredDraft()) {
          backupOwnDraft();
          setMessage("Je eigen kladversie is apart bewaard; de nieuwe plattegrond is een kopie.");
        }
        setModels(catalog);
        setPlan(next);
        setPhase("open");
      } catch {
        setPhase("error");
      }
    },
    [loadCatalog],
  );

  const startExample = useCallback(
    async (id: GuestExampleId) => {
      try {
        const catalog = await loadCatalog();
        await start(buildExamplePlan(id, catalog), { backup: true });
      } catch {
        setPhase("error");
      }
    },
    [loadCatalog, start],
  );

  const close = useCallback(() => {
    setPhase("idle");
    setPlan(null);
    if (window.location.hash) window.history.replaceState(null, "", window.location.pathname);
    openerRef.current?.focus();
  }, []);

  // Deellink (#p=…) of "Start gratis"-link (#start) vanaf de landingspagina.
  useEffect(() => {
    let cancelled = false;
    // Uitgesteld: de editor start vanuit een extern signaal (de URL-hash), niet synchroon binnen de effect.
    const timer = window.setTimeout(() => {
      const token = readShareToken(window.location.hash);
      if (token) {
        void decodeFloorplan(token).then((data) => {
          if (cancelled) return;
          if (data) void start({ naam: "Gedeelde plattegrond", data }, { backup: true });
          else setMessage("Deze deellink is ongeldig of beschadigd. Je kunt gewoon een nieuwe plattegrond maken.");
        });
      } else if (window.location.hash === "#start") {
        void start(null);
      } else {
        const example = /^#voorbeeld=([a-z-]+)$/.exec(window.location.hash)?.[1];
        if (example && GUEST_EXAMPLES.some((e) => e.id === example)) void startExample(example as GuestExampleId);
      }
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [start, startExample]);

  useEffect(() => {
    if (phase !== "open" && phase !== "loading") return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [phase]);

  return (
    <div>
      <div
        className="relative aspect-[16/10] w-full overflow-hidden rounded-2xl border bg-gradient-to-b from-orange-50 to-orange-100 shadow-sm dark:from-zinc-900 dark:to-zinc-800"
        style={{ minHeight: 220 }}
      >
        <svg viewBox="0 0 640 400" className="absolute inset-0 size-full" role="img" aria-label="Voorbeeld van een gymzaal in 3D met matten, banken en pionnen">
          <polygon points="320,60 600,200 320,340 40,200" className="fill-amber-200 stroke-amber-500 dark:fill-amber-900 dark:stroke-amber-600" strokeWidth="3" />
          <polygon points="320,100 520,200 320,300 120,200" fill="none" className="stroke-white/80" strokeWidth="2" strokeDasharray="6 6" />
          <polygon points="250,170 330,130 390,160 310,200" className="fill-sky-400 stroke-sky-600" strokeWidth="2" />
          <polygon points="360,215 430,180 470,200 400,235" className="fill-orange-500 stroke-orange-700" strokeWidth="2" />
          <polygon points="210,225 270,195 290,205 230,235" className="fill-emerald-500 stroke-emerald-700" strokeWidth="2" />
          {[[160, 200], [320, 120], [480, 200], [320, 280]].map(([cx, cy]) => (
            <polygon key={`${cx}-${cy}`} points={`${cx},${cy - 14} ${cx + 8},${cy + 4} ${cx - 8},${cy + 4}`} className="fill-orange-500 stroke-orange-700" strokeWidth="1.5" />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-end gap-3 bg-gradient-to-t from-black/25 to-transparent p-4 pb-6 text-center">
          <Button size="lg" className="h-12 px-6 text-base shadow-lg" onClick={() => void start(null)} disabled={phase === "loading"} data-testid="start-editor">
            {phase === "loading" ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : <Play className="size-5" aria-hidden="true" />}
            {resumeAvailable ? "Ga verder met je plattegrond" : "Start de editor"}
          </Button>
          <p className="text-xs font-medium text-white drop-shadow">Gratis · zonder account · werkt op telefoon, tablet en computer</p>
        </div>
      </div>

      {message && phase !== "open" && (
        <p role="status" className="mt-3 rounded-lg bg-muted px-3 py-2 text-sm">
          {message}
        </p>
      )}
      {phase === "error" && (
        <p role="alert" className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          De editor kon niet worden geladen. Controleer je verbinding en probeer het opnieuw.
        </p>
      )}

      <ul className="mt-4 grid gap-2 sm:grid-cols-2" aria-label="Voorbeeldplattegronden">
        {GUEST_EXAMPLES.map((example) => (
          <li key={example.id}>
            <button
              type="button"
              onClick={() => void startExample(example.id)}
              className="h-full w-full rounded-xl border bg-card p-3 text-left transition-colors hover:border-primary/60 hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <span className="block text-sm font-semibold">{example.titel}</span>
              <span className="block text-xs text-muted-foreground">{example.omschrijving}</span>
            </button>
          </li>
        ))}
      </ul>

      {phase === "open" && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="3D-plattegrondeditor"
          className="fixed inset-0 z-[100] bg-background"
          data-testid="gast-editor"
        >
          {message && (
            <p role="status" className="absolute inset-x-0 top-0 z-[110] bg-primary px-3 py-1 text-center text-xs text-primary-foreground">
              {message}
            </p>
          )}
          <Floorplan3dEditor models={models} initialFloorplans={[]} initialFloorplan={null} guest guestPlan={plan} onGuestClose={close} />
        </div>
      )}
    </div>
  );
}
