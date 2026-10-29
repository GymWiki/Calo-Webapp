"use client";

import { useState } from "react";

import { FloorplanThumbnailCapture } from "@/components/canvas-3d/FloorplanThumbnailCapture";
import type { Floorplan3dData } from "@/types/floorplan3d";
import type { MaterialModel } from "@/types/materialModel";

/** Rendert de preview-opname van de editor en toont het resultaat, zoals de bibliotheekkaart het krijgt (e2e/thumbnail.spec.ts). */
export function ThumbnailHarness({ data, models }: { data: Floorplan3dData; models: MaterialModel[] }) {
  const [shot, setShot] = useState<{ url: string; width: number; height: number } | null>(null);
  return (
    <main className="mx-auto w-full max-w-4xl space-y-3 p-4">
      <h1 className="text-base font-semibold">Preview-opname (test)</h1>
      <FloorplanThumbnailCapture
        room={data.room}
        items={data.items}
        fields={data.coneFields}
        models={models}
        onCapture={(url) => {
          const image = new window.Image();
          image.onload = () => setShot({ url, width: image.naturalWidth, height: image.naturalHeight });
          image.src = url;
        }}
      />
      {shot && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={shot.url} alt="Opgenomen preview" data-testid="opname" data-width={shot.width} data-height={shot.height} data-bytes={Math.round((shot.url.length * 3) / 4)} className="w-full rounded border" />
      )}
    </main>
  );
}
