"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ThreeEvent } from "@react-three/fiber";
import {
  Cone,
  Copy,
  Loader2,
  Redo2,
  RotateCw,
  Save,
  Trash2,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";

import { deleteFloorplan3d, renameFloorplan3d, saveFloorplan3d, saveFloorplanPreview } from "@/actions/floorplans3d";
import { BackButton } from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  type ConeField,
  type Floorplan3dData,
  type Floorplan3dItem,
  type Floorplan3dRoom,
  type Floorplan3dSummary,
} from "@/types/floorplan3d";
import type { MaterialModel } from "@/types/materialModel";
import { type CameraMode } from "@/components/canvas-3d/CameraRig";
import { ConeFieldOverview, ConeFieldPanel } from "@/components/canvas-3d/ConeFieldPanel";
import { FloorplanThumbnailCapture } from "@/components/canvas-3d/FloorplanThumbnailCapture";
import { GymEnvironmentPanel } from "@/components/canvas-3d/GymEnvironmentPanel";
import {
  clampFieldToRoom,
  createFieldFromCorners,
  isUsableField,
  MIN_FIELD_SIZE_M,
  normalizeFieldRotation,
  resizeFieldFromCorner,
  snapFieldMove,
  snapFieldPoint,
  type Vec2,
} from "@/components/canvas-3d/cone-field";
import {
  createGymEnvironment,
  DEFAULT_GYM_LAYOUT,
  GYM_LAYOUTS,
  roomForGymLayout,
  type GymLayoutId,
} from "@/components/canvas-3d/environments";
import {
  createEnvironment,
  defaultLayoutId,
  ENVIRONMENT_KIND_ORDER,
  roomForEnvironment,
  type EnvironmentKind,
} from "@/components/canvas-3d/environment-kinds";
import { EnvironmentPanel } from "@/components/canvas-3d/EnvironmentPanel";
import { MaterialModelPicker3D } from "@/components/canvas-3d/MaterialModelPicker3D";
import { MyFloorplans3dList } from "@/components/canvas-3d/MyFloorplans3dList";
import { Scene3D } from "@/components/canvas-3d/Scene3D";
import {
  clampItemsToRoom,
  dimsLookupFromModels,
  findItemsResting,
  findNearestFreeSpot,
  normalizeRotationDeg,
  recomputeStackedYs,
  ROTATION_STEP_LARGE_DEG,
  ROTATION_STEP_SMALL_DEG,
  type SnapGridSize,
} from "@/components/canvas-3d/floorplan3d-geometry";
import { resolvePlacement, type SnapGuide } from "@/components/canvas-3d/resolvePlacement";
import { useFloorplan3dHistory, type Floorplan3dSnapshot } from "@/components/canvas-3d/useFloorplan3dHistory";

const AUTOSAVE_DEBOUNCE_MS = 2000;
/** Thumbnail pas een tijdje NA de laatste geslaagde save: zo renderen we niet bij elke tik. */
const THUMBNAIL_DELAY_MS = 4000;

function createItemId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

type MobilePanel = "materiaal" | "item" | "kamer" | "lijst" | null;

// Nieuwe plattegronden starten in de gymzaal; DEFAULT_ROOM blijft de lege ruimte.
const NEW_ROOM: Floorplan3dRoom = {
  ...roomForGymLayout(GYM_LAYOUTS[DEFAULT_GYM_LAYOUT]),
  environment: createGymEnvironment(DEFAULT_GYM_LAYOUT),
};

export function Floorplan3dEditor({
  models,
  initialFloorplans,
  initialFloorplan,
  activiteitId,
  debug = false,
}: {
  models: MaterialModel[];
  initialFloorplans: Floorplan3dSummary[];
  /** Al geopend vanuit "Mijn 3D-plattegronden" (server-side via ?open=<id>) — anders start de editor met een nieuwe, nog niet opgeslagen plattegrond. */
  initialFloorplan: { id: string; naam: string; data: Floorplan3dData } | null;
  /** Koppelt de plattegrond bij het opslaan aan deze (eigen) activiteit. */
  activiteitId?: string;
  /** `?debug=1`: voetafdrukken, snaplijnen en een log per drop. */
  debug?: boolean;
}) {
  const router = useRouter();
  const lookup = useMemo(() => dimsLookupFromModels(models), [models]);
  const modelBySlug = useCallback(
    (slug: string) => models.find((model) => model.slug === slug),
    [models],
  );

  const [room, setRoom] = useState<Floorplan3dRoom>(initialFloorplan?.data.room ?? NEW_ROOM);
  const [items, setItems] = useState<Floorplan3dItem[]>(() =>
    initialFloorplan ? recomputeStackedYs(initialFloorplan.data.items, lookup) : [],
  );
  // Oudere plattegronden hebben geen `coneFields` (de server geeft de jsonb ongeparsed terug).
  const [coneFields, setConeFields] = useState<ConeField[]>(initialFloorplan?.data.coneFields ?? []);
  const [floorplanId, setFloorplanId] = useState<string | null>(initialFloorplan?.id ?? null);
  const [floorplanName, setFloorplanName] = useState(initialFloorplan?.naam ?? "Nieuwe plattegrond");
  const [floorplans, setFloorplans] = useState<Floorplan3dSummary[]>(initialFloorplans);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sideTab, setSideTab] = useState<"item" | "omgeving">("omgeving");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  // "Veld afzetten": tool aan/uit, het veld dat nu getekend wordt, en het
  // slepen/vergroten van een bestaand veld.
  const [drawMode, setDrawMode] = useState(false);
  const [draft, setDraft] = useState<{ a: Vec2; c: Vec2; phase: "dragging" | "waiting" } | null>(null);
  const [fieldDragActive, setFieldDragActive] = useState(false);
  const [cameraMode, setCameraMode] = useState<CameraMode>("free");
  const [debugGuides, setDebugGuides] = useState<SnapGuide[]>([]);
  const [snapGrid, setSnapGrid] = useState<SnapGridSize>(0.1);
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const history = useFloorplan3dHistory();
  const dragStartSnapshotRef = useRef<Floorplan3dSnapshot | null>(null);
  const dragStartItemRef = useRef<Floorplan3dItem | null>(null);
  const dragRestingIdsRef = useRef<Set<string>>(new Set());
  const sidePanelRef = useRef<HTMLElement>(null);
  const fieldDragRef = useRef<{
    kind: "move" | "resize";
    id: string;
    corner: number;
    offset: Vec2;
    snapshot: Floorplan3dSnapshot;
    moved: boolean;
  } | null>(null);
  const fieldEditRef = useRef<{ key: string; at: number } | null>(null);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const thumbnailTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Tijdelijke offscreen render voor de statische preview (zie FloorplanThumbnailCapture).
  const [thumbnailJob, setThumbnailJob] = useState<{
    floorplanId: string;
    room: Floorplan3dRoom;
    items: Floorplan3dItem[];
    coneFields: ConeField[];
  } | null>(null);
  const thumbnailFloorplanIdRef = useRef<string | null>(null);
  const floorplanIdRef = useRef(floorplanId);
  useEffect(() => {
    floorplanIdRef.current = floorplanId;
  }, [floorplanId]);

  const selectedItem = items.find((item) => item.id === selectedId) ?? null;
  const selectedField = coneFields.find((field) => field.id === selectedId) ?? null;

  // Het (hoge) velden-paneel begint bovenaan als je een ander item/veld kiest.
  useEffect(() => {
    sidePanelRef.current?.scrollTo({ top: 0 });
  }, [selectedId, sideTab]);

  // ---------------------------------------------------------------------
  // Opslaan (automatisch, gedebounced 2s, en de expliciete knop) — zie
  // Stap 4.9. Gebruikt altijd de MEEST RECENTE room/items via refs i.p.v.
  // de closure-waarden op het moment van plannen, want de debounce-timer
  // kan ruim na een volgende wijziging afgaan. De ref wordt in een effect
  // bijgewerkt (niet inline tijdens render) — react-hooks/refs staat geen
  // ref-mutatie tijdens render toe.
  // ---------------------------------------------------------------------
  const latestStateRef = useRef({ room, items, coneFields, naam: floorplanName });
  useEffect(() => {
    latestStateRef.current = { room, items, coneFields, naam: floorplanName };
  }, [room, items, coneFields, floorplanName]);

  const scheduleThumbnail = useCallback(() => {
    if (thumbnailTimerRef.current) clearTimeout(thumbnailTimerRef.current);
    thumbnailTimerRef.current = setTimeout(() => {
      thumbnailTimerRef.current = null;
      const id = floorplanIdRef.current;
      const { room: currentRoom, items: currentItems, coneFields: currentFields } = latestStateRef.current;
      // Een lege plattegrond heeft geen preview nodig (de activiteitpagina toont hem niet).
      if (!id || (currentItems.length === 0 && currentFields.length === 0)) return;
      thumbnailFloorplanIdRef.current = id;
      setThumbnailJob({ floorplanId: id, room: currentRoom, items: currentItems, coneFields: currentFields });
    }, THUMBNAIL_DELAY_MS);
  }, []);

  const handleThumbnailCaptured = useCallback((dataUrl: string) => {
    const id = thumbnailFloorplanIdRef.current;
    setThumbnailJob(null);
    // Best-effort: een mislukte preview mag het werken in de editor nooit storen.
    if (id) void saveFloorplanPreview(id, dataUrl).catch(() => undefined);
  }, []);

  const performSave = useCallback(async () => {
    setSaveStatus("saving");
    const { room: currentRoom, items: currentItems, coneFields: currentFields, naam } = latestStateRef.current;
    const result = await saveFloorplan3d({
      id: floorplanIdRef.current ?? undefined,
      naam,
      activiteitId,
      data: { version: 1, room: currentRoom, items: currentItems, coneFields: currentFields },
    });

    if ("error" in result) {
      setSaveStatus("error");
      toast.error(result.error);
      return;
    }

    if (!floorplanIdRef.current) {
      setFloorplanId(result.id);
      floorplanIdRef.current = result.id;
    }
    setSaveStatus("saved");
    scheduleThumbnail();
  }, [activiteitId, scheduleThumbnail]);

  const scheduleAutosave = useCallback(() => {
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => {
      autosaveTimerRef.current = null;
      void performSave();
    }, AUTOSAVE_DEBOUNCE_MS);
  }, [performSave]);

  useEffect(() => {
    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
      if (thumbnailTimerRef.current) clearTimeout(thumbnailTimerRef.current);
    };
  }, []);

  async function handleSaveNow() {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    await performSave();
  }

  function pushHistory() {
    history.push({ room, items, coneFields });
  }

  // ---------------------------------------------------------------------
  // Items toevoegen — zie Stap 4.1.
  // ---------------------------------------------------------------------
  function handleAddModel(model: MaterialModel) {
    pushHistory();
    const dims = { length_m: model.length_m, width_m: model.width_m, height_m: model.height_m, stackable: model.stackable };
    const spot = findNearestFreeSpot(0, 0, dims, 0, items, room, lookup);
    const newItem: Floorplan3dItem = {
      id: createItemId(),
      slug: model.slug,
      x: spot.x,
      y: 0,
      z: spot.z,
      rot_y_deg: 0,
    };
    setItems((prev) => [...prev, newItem]);
    setSelectedId(newItem.id);
    setMobilePanel(null);
    scheduleAutosave();
  }

  // ---------------------------------------------------------------------
  // Selecteren / slepen — zie Stap 4.2-4.5.
  // ---------------------------------------------------------------------
  function handleSelect(id: string) {
    setSelectedId(id);
    setSideTab("item");
  }

  function handleBackgroundClick() {
    if (drawMode) return;
    setSelectedId(null);
  }

  // ---------------------------------------------------------------------
  // Veld afzetten — tekenen, verplaatsen, vergroten en aanpassen.
  // ---------------------------------------------------------------------
  const fieldSnapContext = (excludeId?: string, fields: ConeField[] = coneFields) => ({
    grid: snapGrid,
    room,
    others: fields.filter((field) => field.id !== excludeId),
  });

  function startDrawing() {
    setDrawMode(true);
    setDraft(null);
    setSelectedId(null);
    setMobilePanel(null);
    toast.info("Klik en sleep op de vloer (of tik twee hoeken). Esc = stoppen.");
  }

  function stopDrawing() {
    setDrawMode(false);
    setDraft(null);
  }

  function confirmDraft(a: Vec2, c: Vec2) {
    const field = createFieldFromCorners(createItemId(), a, c);
    if (!isUsableField(field)) {
      toast.error(`Het veld is te klein (minimaal ${MIN_FIELD_SIZE_M.toLocaleString("nl-NL")} × ${MIN_FIELD_SIZE_M.toLocaleString("nl-NL")} m).`);
      setDraft(null);
      return;
    }
    pushHistory();
    setConeFields((prev) => [...prev, field]);
    setSelectedId(field.id);
    setSideTab("item");
    stopDrawing();
    scheduleAutosave();
  }

  function handleFloorPointerDown(event: ThreeEvent<PointerEvent>) {
    if (!drawMode) return;
    event.stopPropagation();
    const point = snapFieldPoint({ x: event.point.x, z: event.point.z }, fieldSnapContext());
    if (!draft) setDraft({ a: point, c: point, phase: "dragging" });
    else if (draft.phase === "waiting") confirmDraft(draft.a, point);
  }

  function handleFieldPointerDown(id: string, event: ThreeEvent<PointerEvent>) {
    const field = coneFields.find((candidate) => candidate.id === id);
    if (!field) return;
    fieldDragRef.current = {
      kind: "move",
      id,
      corner: 0,
      offset: { x: event.point.x - field.x, z: event.point.z - field.z },
      snapshot: { room, items, coneFields },
      moved: false,
    };
    setFieldDragActive(true);
  }

  function handleFieldHandlePointerDown(id: string, cornerIndex: number) {
    fieldDragRef.current = {
      kind: "resize",
      id,
      corner: cornerIndex,
      offset: { x: 0, z: 0 },
      snapshot: { room, items, coneFields },
      moved: false,
    };
    setFieldDragActive(true);
  }

  function dragFieldTo(point: Vec2) {
    const drag = fieldDragRef.current;
    if (!drag) return;
    drag.moved = true;
    setConeFields((prev) =>
      prev.map((field) => {
        if (field.id !== drag.id) return field;
        const context = fieldSnapContext(field.id, prev);
        if (drag.kind === "move") {
          return snapFieldMove(field, { x: point.x - drag.offset.x, z: point.z - drag.offset.z }, context);
        }
        return clampFieldToRoom(resizeFieldFromCorner(field, drag.corner, snapFieldPoint(point, context)), room).field;
      }),
    );
  }

  function finishFieldDrag() {
    const drag = fieldDragRef.current;
    fieldDragRef.current = null;
    setFieldDragActive(false);
    if (drag?.moved) {
      history.push(drag.snapshot);
      scheduleAutosave();
    }
  }

  /** Past velden aan na een wijziging van de zaal; waarschuwt als ze moesten krimpen. */
  function fitFieldsToRoom(fields: ConeField[], nextRoom: Pick<Floorplan3dRoom, "width_m" | "length_m">): ConeField[] {
    let shrunk = 0;
    let moved = 0;
    const fitted = fields.map((field) => {
      const result = clampFieldToRoom(field, nextRoom);
      if (result.shrunk) shrunk += 1;
      else if (result.changed) moved += 1;
      return result.field;
    });
    if (shrunk > 0) {
      toast.warning(`${shrunk === 1 ? "Een veld paste" : `${shrunk} velden pasten`} niet in de zaal en ${shrunk === 1 ? "is" : "zijn"} verkleind.`);
    } else if (moved > 0) {
      toast.info(`${moved === 1 ? "Een veld is" : `${moved} velden zijn`} verschoven om binnen de zaal te blijven.`);
    }
    return fitted;
  }

  /** Wijziging vanuit het paneel. Opeenvolgende wijzigingen met dezelfde `key`
   * (typen, slider) binnen 1 s worden één undo-stap. */
  function updateSelectedField(patch: Partial<ConeField>, key: string) {
    if (!selectedField) return;
    const now = Date.now();
    const last = fieldEditRef.current;
    if (!last || last.key !== `${selectedField.id}:${key}` || now - last.at > 1000) pushHistory();
    fieldEditRef.current = { key: `${selectedField.id}:${key}`, at: now };

    const merged = { ...selectedField, ...patch };
    const result = clampFieldToRoom(merged, room);
    if (result.shrunk) toast.warning("Het veld paste niet in de zaal en is verkleind.");
    setConeFields((prev) => prev.map((field) => (field.id === selectedField.id ? result.field : field)));
    scheduleAutosave();
  }

  function handleItemPointerDown(id: string) {
    dragStartSnapshotRef.current = { room, items, coneFields };
    dragStartItemRef.current = items.find((item) => item.id === id) ?? null;
    // Items die op het gesleepte item rusten reizen mee: ze tellen niet als
    // "andere" items, anders stapelt het onderste item op zijn eigen stapel
    // en schuift de hele stapel omhoog (ook bij een gewone klik).
    dragRestingIdsRef.current = new Set(findItemsResting(id, items, lookup));
    setDraggingId(id);
  }

  function handleFloorPointerMove(event: ThreeEvent<PointerEvent>) {
    if (drawMode) {
      if (draft) {
        const point = snapFieldPoint({ x: event.point.x, z: event.point.z }, fieldSnapContext());
        setDraft({ ...draft, c: point });
      }
      return;
    }
    if (fieldDragRef.current) {
      dragFieldTo({ x: event.point.x, z: event.point.z });
      return;
    }
    if (!draggingId) return;
    const dragged = items.find((item) => item.id === draggingId);
    if (!dragged) return;

    const placement = resolvePlacement({
      pointer: { x: event.point.x, z: event.point.z },
      dragged: { slug: dragged.slug, rot_y_deg: dragged.rot_y_deg },
      others: items.filter((item) => item.id !== draggingId && !dragRestingIdsRef.current.has(item.id)),
      room,
      grid: snapGrid,
      lookup,
    });
    if (debug) setDebugGuides(placement.guides);

    setItems((prev) =>
      prev.map((item) =>
        item.id === draggingId ? { ...item, x: placement.x, y: placement.y, z: placement.z } : item,
      ),
    );
  }

  function handleFloorPointerUp() {
    if (drawMode) {
      if (draft?.phase === "dragging") {
        const width = Math.abs(draft.c.x - draft.a.x);
        const length = Math.abs(draft.c.z - draft.a.z);
        if (width >= MIN_FIELD_SIZE_M && length >= MIN_FIELD_SIZE_M) confirmDraft(draft.a, draft.c);
        else if (width < 0.3 && length < 0.3) setDraft({ ...draft, phase: "waiting" }); // tik-tik: wacht op de tweede hoek
        else {
          toast.error("Het veld is te klein. Sleep een grotere rechthoek.");
          setDraft(null);
        }
      }
      return;
    }
    if (fieldDragRef.current) {
      finishFieldDrag();
      return;
    }
    if (!draggingId) return;
    const id = draggingId;
    setDraggingId(null);
    setDebugGuides([]);

    const startItem = dragStartItemRef.current;
    const startSnapshot = dragStartSnapshotRef.current;
    dragStartItemRef.current = null;
    dragStartSnapshotRef.current = null;
    if (!startItem || !startSnapshot) return;

    const restingIds = dragRestingIdsRef.current;
    dragRestingIdsRef.current = new Set();

    setItems((prev) => {
      const dragged = prev.find((item) => item.id === id);
      if (!dragged) return prev;

      const placement = resolvePlacement({
        pointer: { x: dragged.x, z: dragged.z },
        dragged: { slug: dragged.slug, rot_y_deg: dragged.rot_y_deg },
        others: prev.filter((item) => item.id !== id && !restingIds.has(item.id)),
        room,
        grid: snapGrid,
        lookup,
        final: true,
      });
      if (debug) {
        console.info(`[3D-plaatsing] ${dragged.slug}: ${placement.log}`, placement);
      }

      const finalX = placement.x;
      const finalY = placement.y;
      const finalZ = placement.z;

      const dx = finalX - startItem.x;
      const dy = finalY - startItem.y;
      const dz = finalZ - startItem.z;

      // Geschiedenis vastleggen VOORDAT deze definitieve drop-update wordt
      // toegepast: één undo-stap per volledige sleepbeweging, niet per
      // pointermove.
      history.push(startSnapshot);

      return prev.map((item) => {
        if (item.id === id) return { ...item, x: finalX, y: finalY, z: finalZ };
        if (restingIds.has(item.id)) return { ...item, x: item.x + dx, y: item.y + dy, z: item.z + dz };
        return item;
      });
    });

    scheduleAutosave();
  }

  // ---------------------------------------------------------------------
  // Ruimte: lege ruimte of gymzaal (indeling, muren, gordijnen, extra's).
  // ---------------------------------------------------------------------
  /** Zet een omgeving (gymzaal, sportveld, ...) met een bepaalde indeling neer. */
  function applyEnvironment(kind: EnvironmentKind, layoutId: string) {
    pushHistory();
    const environment = createEnvironment(kind, layoutId);
    const nextRoom: Floorplan3dRoom = { ...roomForEnvironment(environment), environment };
    const fitted = clampItemsToRoom(items, nextRoom, lookup);
    setRoom(nextRoom);
    setItems(fitted.items);
    setConeFields((prev) => fitFieldsToRoom(prev, nextRoom));
    if (fitted.moved > 0) {
      toast.info(`${fitted.moved} ${fitted.moved === 1 ? "item" : "items"} verplaatst om in de nieuwe omgeving te passen.`);
    }
    scheduleAutosave();
  }

  function applyGymLayout(layoutId: GymLayoutId) {
    applyEnvironment("gymzaal", layoutId);
  }

  function resizeEmptyRoom(patch: Partial<Pick<Floorplan3dRoom, "width_m" | "length_m">>) {
    pushHistory();
    const nextRoom = { ...room, ...patch };
    setRoom(nextRoom);
    setConeFields((prev) => fitFieldsToRoom(prev, nextRoom));
    scheduleAutosave();
  }

  function changeRoomKind(kind: EnvironmentKind | "leeg") {
    if (kind !== "leeg") {
      if (room.environment?.type !== kind) applyEnvironment(kind, defaultLayoutId(kind));
      return;
    }
    if (!room.environment) return;
    pushHistory();
    setRoom({ width_m: room.width_m, length_m: room.length_m });
    scheduleAutosave();
  }

  function setEnvironmentHidden(hidden: string[]) {
    if (!room.environment) return;
    pushHistory();
    setRoom({ ...room, environment: { ...room.environment, hidden } });
    scheduleAutosave();
  }

  // ---------------------------------------------------------------------
  // Draaien / verwijderen / dupliceren — Stap 4.4 + 4.8.
  // ---------------------------------------------------------------------
  function rotateSelected(deltaDeg: number) {
    if (selectedField) {
      updateSelectedField({ rot_y_deg: normalizeFieldRotation(selectedField.rot_y_deg + deltaDeg) }, `rotatie-${Date.now()}`);
      return;
    }
    if (!selectedItem) return;
    pushHistory();
    const newRot = normalizeRotationDeg(selectedItem.rot_y_deg + deltaDeg);
    setItems((prev) => prev.map((item) => (item.id === selectedItem.id ? { ...item, rot_y_deg: newRot } : item)));
    scheduleAutosave();
  }

  function deleteSelected() {
    if (selectedField) {
      pushHistory();
      setConeFields((prev) => prev.filter((field) => field.id !== selectedField.id));
      setSelectedId(null);
      scheduleAutosave();
      return;
    }
    if (!selectedItem) return;
    pushHistory();
    setItems((prev) => prev.filter((item) => item.id !== selectedItem.id));
    setSelectedId(null);
    scheduleAutosave();
  }

  function duplicateSelected() {
    if (selectedField) {
      pushHistory();
      const copy = clampFieldToRoom({ ...selectedField, id: createItemId(), x: selectedField.x + 1, z: selectedField.z + 1 }, room).field;
      setConeFields((prev) => [...prev, copy]);
      setSelectedId(copy.id);
      scheduleAutosave();
      return;
    }
    if (!selectedItem) return;
    pushHistory();
    const dims = lookup(selectedItem.slug) ?? { length_m: 0.5, width_m: 0.5, height_m: 0.5, stackable: true };
    const spot = findNearestFreeSpot(
      selectedItem.x + 0.2,
      selectedItem.z + 0.2,
      dims,
      selectedItem.rot_y_deg,
      items,
      room,
      lookup,
    );
    const copy: Floorplan3dItem = {
      id: createItemId(),
      slug: selectedItem.slug,
      x: spot.x,
      y: 0,
      z: spot.z,
      rot_y_deg: selectedItem.rot_y_deg,
    };
    setItems((prev) => [...prev, copy]);
    setSelectedId(copy.id);
    scheduleAutosave();
  }

  function applyHistorySnapshot(snapshot: Floorplan3dSnapshot) {
    setRoom(snapshot.room);
    setItems(snapshot.items);
    setConeFields(snapshot.coneFields);
    if (
      !snapshot.items.some((item) => item.id === selectedId) &&
      !snapshot.coneFields.some((field) => field.id === selectedId)
    ) {
      setSelectedId(null);
    }
    scheduleAutosave();
  }

  function handleUndo() {
    const previous = history.undo({ room, items, coneFields });
    if (previous) applyHistorySnapshot(previous);
  }

  function handleRedo() {
    const next = history.redo({ room, items, coneFields });
    if (next) applyHistorySnapshot(next);
  }

  // ---------------------------------------------------------------------
  // Sneltoetsen — Stap 4.4 (R) + 4.8 (Delete, Ctrl+D, Ctrl+Z, Ctrl+Shift+Z).
  // ---------------------------------------------------------------------
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;

      if (event.key === "Escape" && drawMode) {
        event.preventDefault();
        if (draft) setDraft(null);
        else stopDrawing();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) handleRedo();
        else handleUndo();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") {
        event.preventDefault();
        handleRedo();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d") {
        event.preventDefault();
        duplicateSelected();
        return;
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        if (selectedId) {
          event.preventDefault();
          deleteSelected();
        }
        return;
      }
      if (event.key.toLowerCase() === "r" && selectedId) {
        event.preventDefault();
        rotateSelected(ROTATION_STEP_SMALL_DEG);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, selectedItem, selectedField, items, coneFields, room, drawMode, draft]);

  // ---------------------------------------------------------------------
  // "Mijn 3D-plattegronden" — openen/hernoemen/verwijderen.
  // ---------------------------------------------------------------------
  function startNewFloorplan() {
    pushHistory();
    setRoom(NEW_ROOM);
    setItems([]);
    setConeFields([]);
    setFloorplanId(null);
    setFloorplanName("Nieuwe plattegrond");
    setSelectedId(null);
    setMobilePanel(null);
  }

  async function handleRename(id: string, naam: string) {
    const result = await renameFloorplan3d(id, naam);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    setFloorplans((prev) => prev.map((fp) => (fp.id === id ? { ...fp, naam } : fp)));
    if (id === floorplanId) setFloorplanName(naam);
  }

  async function handleDelete(id: string) {
    const result = await deleteFloorplan3d(id);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    setFloorplans((prev) => prev.filter((fp) => fp.id !== id));
    if (id === floorplanId) startNewFloorplan();
  }

  function handleOpen(id: string) {
    setMobilePanel(null);
    router.push(`/plattegrond-3d?open=${id}`);
  }

  const saveStatusLabel: Record<typeof saveStatus, string> = {
    idle: "",
    saving: "Bezig met opslaan...",
    saved: "Opgeslagen",
    error: "Opslaan mislukt",
  };

  const draftField = draft ? createFieldFromCorners("draft", draft.a, draft.c) : null;

  const fieldOverview = (
    <ConeFieldOverview fields={coneFields} selectedId={selectedId} onSelect={handleSelect} />
  );

  const itemPanel = selectedField ? (
    <ConeFieldPanel
      field={selectedField}
      onChange={updateSelectedField}
      onRotate={rotateSelected}
      onDuplicate={duplicateSelected}
      onDelete={deleteSelected}
    />
  ) : (
    <div className="space-y-3">
      {selectedItem ? (
        <>
          <p className="text-sm font-medium">{modelBySlug(selectedItem.slug)?.naam ?? "Onbekend item"}</p>
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" onClick={() => rotateSelected(-ROTATION_STEP_SMALL_DEG)}>
              <RotateCw className="size-4 -scale-x-100" /> -15°
            </Button>
            <Button type="button" variant="outline" onClick={() => rotateSelected(ROTATION_STEP_SMALL_DEG)}>
              <RotateCw className="size-4" /> +15°
            </Button>
            <Button type="button" variant="outline" onClick={() => rotateSelected(-ROTATION_STEP_LARGE_DEG)}>
              <RotateCw className="size-4 -scale-x-100" /> -90°
            </Button>
            <Button type="button" variant="outline" onClick={() => rotateSelected(ROTATION_STEP_LARGE_DEG)}>
              <RotateCw className="size-4" /> +90°
            </Button>
          </div>
          <Button type="button" variant="outline" className="w-full" onClick={duplicateSelected}>
            <Copy className="size-4" /> Dupliceren (Ctrl+D)
          </Button>
          <Button type="button" variant="outline" className="w-full text-destructive" onClick={deleteSelected}>
            <Trash2 className="size-4" /> Verwijderen (Delete)
          </Button>
        </>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">Selecteer een item of veld om te draaien, dupliceren of verwijderen.</p>
          {fieldOverview}
        </>
      )}
    </div>
  );

  const roomPanel = (
    <div className="space-y-5">
      <div>
        <p className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Omgeving</p>
        <div className="grid grid-cols-2 gap-1.5">
          {ENVIRONMENT_KIND_ORDER.map(({ id, label }) => {
            const active = room.environment?.type === id;
            return (
              <Button
                key={id}
                type="button"
                variant={active ? "default" : "outline"}
                aria-pressed={active}
                onClick={() => changeRoomKind(id)}
              >
                {label}
              </Button>
            );
          })}
          <Button
            type="button"
            variant={room.environment ? "outline" : "default"}
            aria-pressed={!room.environment}
            onClick={() => changeRoomKind("leeg")}
          >
            Lege ruimte
          </Button>
        </div>
      </div>

      {room.environment?.type === "gymzaal" ? (
        <GymEnvironmentPanel
          environment={room.environment}
          onLayoutChange={applyGymLayout}
          onHiddenChange={setEnvironmentHidden}
        />
      ) : room.environment ? (
        <EnvironmentPanel
          environment={room.environment}
          onLayoutChange={(layoutId) => applyEnvironment(room.environment!.type, layoutId)}
          onHiddenChange={setEnvironmentHidden}
        />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Breedte (m)
            <Input
              type="number"
              min={1}
              step={0.5}
              value={room.width_m}
              onChange={(event) => resizeEmptyRoom({ width_m: Number(event.target.value) || room.width_m })}
            />
          </label>
          <label className="space-y-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Lengte (m)
            <Input
              type="number"
              min={1}
              step={0.5}
              value={room.length_m}
              onChange={(event) => resizeEmptyRoom({ length_m: Number(event.target.value) || room.length_m })}
            />
          </label>
        </div>
      )}

      <div>
        <p className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Raster</p>
        <div className="grid grid-cols-3 gap-1.5">
          {([0, 0.1, 0.5] as SnapGridSize[]).map((size) => (
            <Button
              key={size}
              type="button"
              size="sm"
              variant={snapGrid === size ? "default" : "outline"}
              onClick={() => setSnapGrid(size)}
            >
              {size === 0 ? "Uit" : `${size} m`}
            </Button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Camera</p>
        <div className="grid grid-cols-3 gap-1.5">
          <Button type="button" size="sm" variant={cameraMode === "angled" ? "default" : "outline"} onClick={() => setCameraMode("angled")}>
            Standaard
          </Button>
          <Button type="button" size="sm" variant={cameraMode === "top" ? "default" : "outline"} onClick={() => setCameraMode("top")}>
            Bovenaanzicht
          </Button>
          <Button type="button" size="sm" variant={cameraMode === "free" ? "default" : "outline"} onClick={() => setCameraMode("free")}>
            Vrij draaien
          </Button>
        </div>
      </div>

      {fieldOverview}
    </div>
  );

  return (
    <div className="flex h-[100dvh] flex-col overscroll-none">
      <div className="flex shrink-0 items-center gap-2 border-b bg-card px-3 py-2">
        <BackButton fallbackHref={activiteitId ? `/activiteit/${activiteitId}` : "/dashboard"} fallbackLabel="Terug" className="-ml-2" />
        <Input
          value={floorplanName}
          onChange={(event) => {
            setFloorplanName(event.target.value);
            scheduleAutosave();
          }}
          className="h-9 max-w-56 border-none bg-transparent text-sm font-semibold shadow-none focus-visible:ring-1"
        />
        <span className="hidden text-xs text-muted-foreground sm:inline" aria-live="polite">
          {saveStatusLabel[saveStatus]}
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <Button
            type="button"
            variant={drawMode ? "default" : "outline"}
            size="sm"
            aria-pressed={drawMode}
            onClick={() => (drawMode ? stopDrawing() : startDrawing())}
            title="Veld afzetten met pionnen of dopjes"
          >
            <Cone className="size-4" />
            <span className="hidden sm:inline">Veld afzetten</span>
          </Button>
          <Button type="button" variant="ghost" size="icon" disabled={!history.canUndo} onClick={handleUndo} title="Ongedaan maken (Ctrl+Z)">
            <Undo2 className="size-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon" disabled={!history.canRedo} onClick={handleRedo} title="Opnieuw (Ctrl+Shift+Z)">
            <Redo2 className="size-4" />
          </Button>
          <Button type="button" variant="outline" size="sm" className="hidden sm:inline-flex" onClick={() => setMobilePanel("lijst")}>
            Mijn plattegronden
          </Button>
          <Button type="button" size="sm" onClick={() => void handleSaveNow()} disabled={saveStatus === "saving"}>
            {saveStatus === "saving" ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Opslaan
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside className="hidden w-72 shrink-0 overflow-y-auto border-r bg-card p-3 lg:block">
          <Button
            type="button"
            variant={drawMode ? "default" : "outline"}
            className="mb-3 w-full"
            aria-pressed={drawMode}
            onClick={() => (drawMode ? stopDrawing() : startDrawing())}
          >
            <Cone className="size-4" /> Veld afzetten
          </Button>
          <MaterialModelPicker3D models={models} onSelect={handleAddModel} />
        </aside>

        <div className="relative min-w-0 flex-1">
          <Scene3D
            room={room}
            items={items}
            modelBySlug={modelBySlug}
            selectedId={selectedId}
            isDragging={draggingId !== null || fieldDragActive}
            cameraMode={cameraMode}
            onItemPointerDown={handleItemPointerDown}
            fields={coneFields}
            draftField={draftField}
            drawMode={drawMode}
            onFieldPointerDown={handleFieldPointerDown}
            onFieldHandlePointerDown={handleFieldHandlePointerDown}
            onFloorPointerDown={handleFloorPointerDown}
            onFloorPointerMove={handleFloorPointerMove}
            onFloorPointerUp={handleFloorPointerUp}
            onSelect={handleSelect}
            onBackgroundClick={handleBackgroundClick}
            debug={debug}
            debugGuides={debugGuides}
            lookup={lookup}
          />

          {drawMode && (
            <div className="pointer-events-none absolute inset-x-0 top-2 flex justify-center px-2">
              <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-slate-900/90 px-3 py-1.5 text-xs text-white shadow">
                <Cone className="size-3.5" aria-hidden="true" />
                {draft?.phase === "waiting"
                  ? "Tik op de tegenoverliggende hoek"
                  : "Sleep een rechthoek op de vloer, of tik twee hoeken"}
                <button type="button" onClick={stopDrawing} className="rounded-full bg-white/15 px-2 py-0.5 font-medium hover:bg-white/25">
                  Stoppen (Esc)
                </button>
              </div>
            </div>
          )}

          <div className="absolute inset-x-0 bottom-0 flex gap-2 p-2 lg:hidden">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setMobilePanel("materiaal")}>
              Materiaal
            </Button>
            <Button type="button" variant="secondary" className="flex-1" disabled={!selectedId} onClick={() => setMobilePanel("item")}>
              Item
            </Button>
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setMobilePanel("kamer")}>
              Omgeving
            </Button>
          </div>
        </div>

        <aside ref={sidePanelRef} className="hidden w-80 shrink-0 overflow-y-auto border-l bg-card p-3 lg:block">
          <Tabs value={sideTab} onValueChange={(value) => setSideTab(value as "item" | "omgeving")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="item">Item</TabsTrigger>
              <TabsTrigger value="omgeving">Omgeving</TabsTrigger>
            </TabsList>
            <TabsContent value="item" className="pt-3">
              {itemPanel}
            </TabsContent>
            <TabsContent value="omgeving" className="pt-3">
              {roomPanel}
            </TabsContent>
          </Tabs>
        </aside>
      </div>

      {thumbnailJob && (
        <FloorplanThumbnailCapture
          room={thumbnailJob.room}
          items={thumbnailJob.items}
          fields={thumbnailJob.coneFields}
          models={models}
          onCapture={handleThumbnailCaptured}
        />
      )}

      <Sheet open={mobilePanel !== null} onOpenChange={(open) => !open && setMobilePanel(null)}>
        <SheetContent side="bottom" className="h-[70vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {mobilePanel === "materiaal" && "Materiaal"}
              {mobilePanel === "item" && "Item"}
              {mobilePanel === "kamer" && "Omgeving"}
              {mobilePanel === "lijst" && "Mijn 3D-plattegronden"}
            </SheetTitle>
          </SheetHeader>
          <div className={cn("px-4 pb-6")}>
            {mobilePanel === "materiaal" && <MaterialModelPicker3D models={models} onSelect={handleAddModel} />}
            {mobilePanel === "item" && itemPanel}
            {mobilePanel === "kamer" && roomPanel}
            {mobilePanel === "lijst" && (
              <MyFloorplans3dList
                floorplans={floorplans}
                activeId={floorplanId}
                onOpen={handleOpen}
                onRename={handleRename}
                onDelete={handleDelete}
                onCreateNew={startNewFloorplan}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
