"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { Box, Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { MaterialModel } from "@/types/materialModel";

function categoryLabel(categorie: string): string {
  if (categorie === "dev-placeholders") return "Dev-tijdelijke modellen";
  return categorie.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

/** Preview-vlak: de PNG's hebben een transparante achtergrond, dus altijd op
 * een vaste lichte ondergrond (ook in dark mode) zodat donkere materialen
 * zichtbaar blijven. `object-contain` + padding: nooit bijsnijden. */
function ModelPreview({ model }: { model: MaterialModel }) {
  const [failed, setFailed] = useState(false);

  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-md bg-slate-50 ring-1 ring-black/5">
      {model.devColor ? (
        <div className="absolute inset-4 rounded-md" style={{ backgroundColor: model.devColor }} aria-hidden="true" />
      ) : !model.preview_url || failed ? (
        <div className="flex size-full items-center justify-center text-slate-400">
          <Box className="size-8" aria-hidden="true" />
        </div>
      ) : (
        <Image
          src={model.preview_url}
          alt=""
          fill
          sizes="(min-width: 1024px) 128px, 33vw"
          className="object-contain p-1.5"
          onError={() => setFailed(true)}
          unoptimized
        />
      )}
    </div>
  );
}

function ModelButton({ model, onSelect }: { model: MaterialModel; onSelect: (model: MaterialModel) => void }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(model)}
      title={model.naam}
      className="flex min-w-0 flex-col gap-1.5 rounded-lg border bg-background p-1.5 text-left transition-colors duration-150 ease-brand hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none active:scale-95"
    >
      <ModelPreview model={model} />
      <span className="line-clamp-2 min-h-[2.2em] w-full px-0.5 text-xs leading-tight font-medium break-words">
        {model.naam}
      </span>
    </button>
  );
}

function ModelGrid({ models, onSelect }: { models: MaterialModel[]; onSelect: (model: MaterialModel) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2 min-[520px]:grid-cols-3 lg:grid-cols-2">
      {models.map((model) => (
        <ModelButton key={model.id} model={model} onSelect={onSelect} />
      ))}
    </div>
  );
}

function CategorySection({
  categorie,
  models,
  open,
  onOpenChange,
  onSelect,
}: {
  categorie: string;
  models: MaterialModel[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (model: MaterialModel) => void;
}) {
  return (
    <div className="border-b pb-3 last:border-b-0">
      <Collapsible open={open} onOpenChange={onOpenChange}>
        <CollapsibleTrigger className="rounded-md py-2 text-sm font-semibold hover:bg-accent">
          <span>
            {categoryLabel(categorie)}{" "}
            <span className="font-normal text-muted-foreground">({models.length})</span>
          </span>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2">
          <ModelGrid models={models} onSelect={onSelect} />
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

/**
 * Materiaalmenu van de 3D-editor — PNG-previews, gegroepeerd per categorie
 * met zoekveld (zelfde structuur als components/canvas/MaterialPicker.tsx,
 * de 2D-tegenhanger). `models` komt server-side al mee (page.tsx), dus hier
 * geen eigen fetch/loading-state nodig — in tegenstelling tot de 2D-picker,
 * die zelf client-side laadt.
 */
export function MaterialModelPicker3D({
  models,
  onSelect,
}: {
  models: MaterialModel[];
  onSelect: (model: MaterialModel) => void;
}) {
  const [query, setQuery] = useState("");
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return models;
    return models.filter((model) => model.naam.toLowerCase().includes(q));
  }, [models, query]);

  const byCategory = useMemo(() => {
    const groups = new Map<string, MaterialModel[]>();
    for (const model of filtered) {
      const list = groups.get(model.categorie) ?? [];
      list.push(model);
      groups.set(model.categorie, list);
    }
    return [...groups.entries()]
      .sort(([a], [b]) => categoryLabel(a).localeCompare(categoryLabel(b)))
      .map(([categorie, categoryModels]) => ({ categorie, models: categoryModels }));
  }, [filtered]);

  function toggleCategory(categorie: string, open: boolean) {
    setOpenCategories((prev) => ({ ...prev, [categorie]: open }));
  }

  if (models.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Nog geen 3D-materiaal beschikbaar — zie README.md &quot;3D-materiaal toevoegen&quot;.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Zoek een materiaal..."
          className="pl-9"
        />
      </div>

      {query.trim() ? (
        filtered.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Geen materiaal gevonden voor &quot;{query}&quot;.
          </p>
        ) : (
          <ModelGrid models={filtered} onSelect={onSelect} />
        )
      ) : (
        byCategory.map(({ categorie, models: categoryModels }) => (
          <CategorySection
            key={categorie}
            categorie={categorie}
            models={categoryModels}
            open={openCategories[categorie] ?? false}
            onOpenChange={(open) => toggleCategory(categorie, open)}
            onSelect={onSelect}
          />
        ))
      )}
    </div>
  );
}
