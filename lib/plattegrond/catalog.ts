// Itemcatalogus voor AI-generatie van 3D-plattegronden. Bron van waarheid is
// public.material_models (zie supabase/migrations/material_models_3d.sql);
// dit bestand zet die rijen om naar docs/ai-item-catalog.json en de compacte
// variant. Alleen velden die echt in de bron bestaan worden gevuld — niets
// verzonnen (front-richting e.d. is ONBEKEND en staat dan ook zo in _meta).

import type { DimsLookup } from "@/components/canvas-3d/floorplan3d-geometry";

export type CatalogSourceRow = {
  slug: string;
  naam: string;
  categorie: string;
  length_m: number;
  width_m: number;
  height_m: number;
  stackable: boolean;
  bron: string;
};

export type CatalogItem = {
  id: string;
  naam: string;
  categorie: string;
  afmetingen: { length_m: number; width_m: number; height_m: number };
  pivot: "onderkant-midden";
  front: "ONBEKEND";
  allowTilt: false;
  defaultRotatie: { rot_y_deg: 0 };
  collision: "voetafdruk-rechthoek-xz";
  stapelbaar: boolean;
  bron: string;
};

export type Catalog = {
  _meta: Record<string, unknown>;
  items: CatalogItem[];
};

export type CompactCatalogItem = {
  id: string;
  naam: string;
  l: number;
  b: number;
  h: number;
  categorie: string;
  stapelbaar: boolean;
};

const META_NOTES = {
  eenheid: "meter",
  afmetingen:
    "length_m = uitgestrekt langs X bij rot_y_deg 0; width_m = langs Z bij rot_y_deg 0; height_m = langs Y (omhoog). Dit zijn de kolomnamen uit material_models.",
  pivot:
    "onderkant-midden: item.x/item.z = midden van de voetafdruk, item.y = onderkant (bron: components/canvas-3d/ItemMesh.tsx, scripts/import-materials.mts)",
  allowTilt: "false voor alle items: het opslagformaat kent alleen rot_y_deg (draaien om de verticale as).",
  nietInBron:
    "subgroep, sporten, tags, varianten/kleuren, front-richting en defaultRotatie bestaan niet in material_models; ONBEKEND/afwezig.",
};

export function buildCatalog(rows: CatalogSourceRow[], meta: Record<string, unknown>): Catalog {
  return {
    _meta: { ...META_NOTES, ...meta },
    items: rows.map((row) => ({
      id: row.slug,
      naam: row.naam,
      categorie: row.categorie,
      afmetingen: { length_m: row.length_m, width_m: row.width_m, height_m: row.height_m },
      pivot: "onderkant-midden",
      front: "ONBEKEND",
      allowTilt: false,
      defaultRotatie: { rot_y_deg: 0 },
      collision: "voetafdruk-rechthoek-xz",
      stapelbaar: row.stackable,
      bron: row.bron,
    })),
  };
}

export function compactCatalog(catalog: Catalog): CompactCatalogItem[] {
  return catalog.items.map((item) => ({
    id: item.id,
    naam: item.naam,
    l: item.afmetingen.length_m,
    b: item.afmetingen.width_m,
    h: item.afmetingen.height_m,
    categorie: item.categorie,
    stapelbaar: item.stapelbaar,
  }));
}

export function catalogLookup(catalog: Catalog): DimsLookup {
  const byId = new Map(catalog.items.map((item) => [item.id, item]));
  return (slug) => {
    const item = byId.get(slug);
    if (!item) return undefined;
    return { ...item.afmetingen, stackable: item.stapelbaar };
  };
}

/** Grove tokenschatting (~4 tekens per token) — geen echte tokenizer. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
