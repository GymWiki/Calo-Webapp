"use client";

import { useEffect, useMemo, useState } from "react";
import { Package, Search, Star } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { createClient } from "@/utils/supabase/client";
import { getAllMaterials } from "@/lib/services/materials";
import {
  MATERIAL_CATEGORY_ORDER,
  getMaterialCategoryLabel,
  type Material,
} from "@/types/material";

const MOST_USED_LIMIT = 8;

function MaterialImage({ material }: { material: Material }) {
  const [failed, setFailed] = useState(false);

  if (!material.image_url || failed) {
    return (
      <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <Package className="size-5" aria-hidden="true" />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={material.image_url}
      alt=""
      className="size-10 shrink-0 rounded-md border object-contain"
      onError={() => setFailed(true)}
    />
  );
}

function MaterialButton({
  material,
  onSelect,
}: {
  material: Material;
  onSelect: (material: Material) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(material)}
      className="flex min-h-16 flex-col items-center justify-center gap-1.5 rounded-lg border bg-background p-2 text-center transition-colors duration-150 ease-brand hover:bg-accent active:scale-95"
    >
      <MaterialImage material={material} />
      <span className="text-[11px] leading-tight font-medium">{material.name}</span>
    </button>
  );
}

function MaterialGrid({
  materials,
  onSelect,
}: {
  materials: Material[];
  onSelect: (material: Material) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {materials.map((material) => (
        <MaterialButton key={material.id} material={material} onSelect={onSelect} />
      ))}
    </div>
  );
}

function CategorySection({
  category,
  materials,
  open,
  onOpenChange,
  onSelect,
}: {
  category: string;
  materials: Material[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (material: Material) => void;
}) {
  return (
    <div className="border-b pb-3 last:border-b-0">
      <Collapsible open={open} onOpenChange={onOpenChange}>
        <CollapsibleTrigger className="rounded-md py-2 text-sm font-semibold hover:bg-accent">
          <span>
            {getMaterialCategoryLabel(category)}{" "}
            <span className="font-normal text-muted-foreground">
              ({materials.length})
            </span>
          </span>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2">
          <MaterialGrid materials={materials} onSelect={onSelect} />
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

/**
 * Materialenbibliotheek voor de canvas-editor — laadt de volledige lijst
 * dynamisch uit Supabase (public.materials), doorzoekbaar en gegroepeerd in
 * inklapbare categorieën, met een "meest gebruikt"-sectie bovenaan. Nieuwe
 * materialen (nieuwe rij + foto in Storage) verschijnen hier zonder
 * codewijziging.
 */
export function MaterialPicker({
  onSelect,
}: {
  onSelect: (material: Material) => void;
}) {
  const [materials, setMaterials] = useState<Material[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    getAllMaterials(supabase)
      .then((data) => {
        if (!cancelled) setMaterials(data);
      })
      .catch((cause) => {
        if (!cancelled) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Materialen laden is mislukt. Probeer het opnieuw.",
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!materials) return [];
    const q = query.trim().toLowerCase();
    if (!q) return materials;
    return materials.filter((material) => material.name.toLowerCase().includes(q));
  }, [materials, query]);

  const mostUsed = useMemo(() => {
    if (!materials || query.trim()) return [];
    return [...materials]
      .filter((material) => material.usage_count > 0)
      .sort((a, b) => b.usage_count - a.usage_count)
      .slice(0, MOST_USED_LIMIT);
  }, [materials, query]);

  const byCategory = useMemo(() => {
    const groups = new Map<string, Material[]>();
    for (const material of filtered) {
      const list = groups.get(material.category) ?? [];
      list.push(material);
      groups.set(material.category, list);
    }

    const orderedKeys = [
      ...MATERIAL_CATEGORY_ORDER.filter((category) => groups.has(category)),
      ...[...groups.keys()]
        .filter((category) => !(MATERIAL_CATEGORY_ORDER as readonly string[]).includes(category))
        .sort((a, b) => getMaterialCategoryLabel(a).localeCompare(getMaterialCategoryLabel(b))),
    ];

    return orderedKeys.map((category) => ({
      category,
      materials: groups.get(category) ?? [],
    }));
  }, [filtered]);

  function toggleCategory(category: string, open: boolean) {
    setOpenCategories((prev) => ({ ...prev, [category]: open }));
  }

  if (error) {
    return (
      <p className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        {error}
      </p>
    );
  }

  if (!materials) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full rounded-md" />
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  const searching = query.trim().length > 0;

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

      {searching ? (
        filtered.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Geen materiaal gevonden voor &quot;{query}&quot;.
          </p>
        ) : (
          <MaterialGrid materials={filtered} onSelect={onSelect} />
        )
      ) : (
        <>
          {mostUsed.length > 0 && (
            <div className="border-b pb-3">
              <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                <Star className="size-4 text-cone" aria-hidden="true" />
                Meest gebruikt
              </p>
              <MaterialGrid materials={mostUsed} onSelect={onSelect} />
            </div>
          )}
          {byCategory.map(({ category, materials: categoryMaterials }) => (
            <CategorySection
              key={category}
              category={category}
              materials={categoryMaterials}
              open={openCategories[category] ?? false}
              onOpenChange={(open) => toggleCategory(category, open)}
              onSelect={onSelect}
            />
          ))}
        </>
      )}
    </div>
  );
}
