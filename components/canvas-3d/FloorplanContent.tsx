"use client";

import { Suspense } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import { ConeFieldMesh } from "@/components/canvas-3d/ConeFieldMesh";
import { EnvironmentModel } from "@/components/canvas-3d/EnvironmentModel";
import { ItemMesh } from "@/components/canvas-3d/ItemMesh";
import { RoomFloor } from "@/components/canvas-3d/RoomFloor";
import { ContactShadows } from "@/components/canvas-3d/ContactShadows";
import type { ConeField, Floorplan3dItem, Floorplan3dRoom } from "@/types/floorplan3d";
import type { MaterialModel } from "@/types/materialModel";
import { dimsForSlug, dimsOf, shapeOfDims, type DimsLookup } from "@/components/canvas-3d/floorplan3d-geometry";
import { isOutsideRoom, itemIsTilted, rotationOf } from "@/components/canvas-3d/orientation";

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
  lookup,
  debugCollision = false,
  selectedId = null,
  groupIds,
  hideEnvironmentNodes,
  contactShadows = false,
  interactive = false,
  onItemPointerDown,
  onSelect,
  onFieldPointerDown,
  onFieldHandlePointerDown,
  onItemHover,
  touchUi = false,
  onRotateHandleDown,
  warnOutside = false,
}: {
  /** Editor: gekantelde items die buiten de zaal vallen krijgen een rode outline. */
  warnOutside?: boolean;
  room: Floorplan3dRoom;
  items: Floorplan3dItem[];
  fields: ConeField[];
  modelBySlug: (slug: string) => MaterialModel | undefined;
  /** Collision-vormen per asset (selectie-outline en debug); zonder: de maten uit het model. */
  lookup?: DimsLookup;
  /** `?debug=collision`. */
  debugCollision?: boolean;
  selectedId?: string | null;
  /** GLB-nodes van de omgeving die extra verborgen worden (viewer: muren tussen camera en inhoud). */
  hideEnvironmentNodes?: readonly string[];
  /** Zachte contactschaduw onder de items (alleen-lezen viewer en thumbnails): geeft leerlingen en materiaal houvast op de vloer. */
  contactShadows?: boolean;
  /** Meervoudige selectie: alle geselecteerde ids; de overige leden krijgen een oranje omlijning. */
  groupIds?: ReadonlySet<string>;
  /** false = alleen-lezen (viewer) of tijdens "Veld afzetten" in de editor. */
  interactive?: boolean;
  onItemPointerDown?: (id: string, event: ThreeEvent<PointerEvent>) => void;
  onSelect?: (id: string) => void;
  onFieldPointerDown?: (id: string, event: ThreeEvent<PointerEvent>) => void;
  onFieldHandlePointerDown?: (id: string, cornerIndex: number, event: ThreeEvent<PointerEvent>) => void;
  /** Alleen-lezen hover/tik op een item: naam voor een tooltip (null = weg). */
  onItemHover?: (item: Floorplan3dItem | null) => void;
  /** Touch-bediening: het geselecteerde item krijgt een rotatiehandvat. */
  touchUi?: boolean;
  onRotateHandleDown?: (id: string, event: ThreeEvent<PointerEvent>) => void;
}) {
  return (
    <>
      {room.environment ? (
        // Tijdens het laden van de GLB staat de gewone vloer er al; geen leeg scherm.
        <Suspense fallback={<RoomFloor room={room} />}>
          <EnvironmentModel environment={room.environment} extraHidden={hideEnvironmentNodes} />
        </Suspense>
      ) : (
        <RoomFloor room={room} />
      )}

      {items.map((item) => (
        <ItemMesh
          key={item.id}
          item={item}
          model={modelBySlug(item.slug)}
          dims={lookup ? dimsForSlug(item.slug, item.size, lookup) : undefined}
          debugCollision={debugCollision}
          selected={item.id === selectedId}
          grouped={Boolean(groupIds?.has(item.id)) && item.id !== selectedId}
          interactive={interactive}
          onPointerDownItem={onItemPointerDown}
          onSelect={onSelect}
          onHover={onItemHover}
          touchUi={touchUi}
          onRotateHandleDown={onRotateHandleDown}
          outsideRoom={
            warnOutside && lookup && itemIsTilted(item)
              ? isOutsideRoom(shapeOfDims(dimsOf(item, lookup)), [item.x, item.y, item.z], rotationOf(item), room)
              : false
          }
        />
      ))}
      {contactShadows && lookup && <ContactShadows items={items} lookup={lookup} />}
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
