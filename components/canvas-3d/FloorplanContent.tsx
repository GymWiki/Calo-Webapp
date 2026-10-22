"use client";

import { Suspense } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import { ConeFieldMesh } from "@/components/canvas-3d/ConeFieldMesh";
import { GymEnvironment } from "@/components/canvas-3d/GymEnvironment";
import { ItemMesh } from "@/components/canvas-3d/ItemMesh";
import { RoomFloor } from "@/components/canvas-3d/RoomFloor";
import type { ConeField, Floorplan3dItem, Floorplan3dRoom } from "@/types/floorplan3d";
import type { MaterialModel } from "@/types/materialModel";

/**
 * Alles wat een plattegrond ZIET: de kamer (gymzaal-GLB of lege vloer), de
 * items en de afgezette velden met pionnen. Eén gedeelde implementatie voor
 * de editor (Scene3D, interactief) en de alleen-lezen viewer op de
 * activiteitpagina (components/plattegrond/) — geen camera, licht of
 * canvas: die hoort bij de omgeving eromheen.
 *
 * Zonder handlers is dit volledig alleen-lezen: geen selectie, geen
 * handles en items/velden vangen alleen (optioneel) hover.
 */
export function FloorplanContent({
  room,
  items,
  fields,
  modelBySlug,
  selectedId = null,
  interactive = false,
  onItemPointerDown,
  onSelect,
  onFieldPointerDown,
  onFieldHandlePointerDown,
  onItemHover,
}: {
  room: Floorplan3dRoom;
  items: Floorplan3dItem[];
  fields: ConeField[];
  modelBySlug: (slug: string) => MaterialModel | undefined;
  selectedId?: string | null;
  /** false = alleen-lezen (viewer) of tijdens "Veld afzetten" in de editor. */
  interactive?: boolean;
  onItemPointerDown?: (id: string, event: ThreeEvent<PointerEvent>) => void;
  onSelect?: (id: string) => void;
  onFieldPointerDown?: (id: string, event: ThreeEvent<PointerEvent>) => void;
  onFieldHandlePointerDown?: (id: string, cornerIndex: number, event: ThreeEvent<PointerEvent>) => void;
  /** Alleen-lezen hover/tik op een item: naam voor een tooltip (null = weg). */
  onItemHover?: (item: Floorplan3dItem | null) => void;
}) {
  return (
    <>
      {room.environment ? (
        // Tijdens het laden van de GLB staat de gewone vloer er al; geen leeg scherm.
        <Suspense fallback={<RoomFloor room={room} />}>
          <GymEnvironment environment={room.environment} />
        </Suspense>
      ) : (
        <RoomFloor room={room} />
      )}

      {items.map((item) => (
        <ItemMesh
          key={item.id}
          item={item}
          model={modelBySlug(item.slug)}
          selected={item.id === selectedId}
          interactive={interactive}
          onPointerDownItem={onItemPointerDown}
          onSelect={onSelect}
          onHover={onItemHover}
        />
      ))}
      {fields.map((field) => (
        <ConeFieldMesh
          key={field.id}
          field={field}
          selected={field.id === selectedId}
          interactive={interactive}
          onSelect={onSelect}
          onFieldPointerDown={onFieldPointerDown}
          onHandlePointerDown={onFieldHandlePointerDown}
        />
      ))}
    </>
  );
}
