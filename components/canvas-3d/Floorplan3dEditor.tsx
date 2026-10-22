"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ThreeEvent } from "@react-three/fiber";
import {
  Copy,
  Loader2,
  Redo2,
  RotateCw,
  Save,
  Trash2,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";

import { deleteFloorplan3d, renameFloorplan3d, saveFloorplan3d } from "@/actions/floorplans3d";
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
  type Floorplan3dData,
  type Floorplan3dItem,
  type Floorplan3dRoom,
  type Floorplan3dSummary,
} from "@/types/floorplan3d";
import type { MaterialModel } from "@/types/materialModel";
import { type CameraMode } from "@/components/canvas-3d/CameraRig";
import { GymEnvironmentPanel } from "@/components/canvas-3d/GymEnvironmentPanel";
import {
  createGymEnvironment,
  DEFAULT_GYM_LAYOUT,
  GYM_LAYOUTS,
  roomForGymLayout,
  type GymLayoutId,
} from "@/components/canvas-3d/environments";
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
  debug = false,
}: {
  models: MaterialModel[];
  initialFloorplans: Floorplan3dSummary[];
  /** Al geopend vanuit "Mijn 3D-plattegronden" (server-side via ?open=<id>) — anders start de editor met een nieuwe, nog niet opgeslagen plattegrond. */
  initialFloorplan: { id: string; naam: string; data: Floorplan3dData } | null;
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
  const [floorplanId, setFloorplanId] = useState<string | null>(initialFloorplan?.id ?? null);
  const [floorplanName, setFloorplanName] = useState(initialFloorplan?.naam ?? "Nieuwe plattegrond");
  const [floorplans, setFloorplans] = useState<Floorplan3dSummary[]>(initialFloorplans);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sideTab, setSideTab] = useState<"item" | "omgeving">("omgeving");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [cameraMode, setCameraMode] = useState<CameraMode>("angled");
  const [debugGuides, setDebugGuides] = useState<SnapGuide[]>([]);
  const [snapGrid, setSnapGrid] = useState<SnapGridSize>(0.1);
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const history = useFloorplan3dHistory();
  const dragStartSnapshotRef = useRef<Floorplan3dSnapshot | null>(null);
  const dragStartItemRef = useRef<Floorplan3dItem | null>(null);
  const dragRestingIdsRef = useRef<Set<string>>(new Set());
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const floorplanIdRef = useRef(floorplanId);
  useEffect(() => {
    floorplanIdRef.current = floorplanId;
  }, [floorplanId]);

  const selectedItem = items.find((item) => item.id === selectedId) ?? null;

  // ---------------------------------------------------------------------
  // Opslaan (automatisch, gedebounced 2s, en de expliciete knop) — zie
  // Stap 4.9. Gebruikt altijd de MEEST RECENTE room/items via refs i.p.v.
  // de closure-waarden op het moment van plannen, want de debounce-timer
  // kan ruim na een volgende wijziging afgaan. De ref wordt in een effect
  // bijgewerkt (niet inline tijdens render) — react-hooks/refs staat geen
  // ref-mutatie tijdens render toe.
  // ---------------------------------------------------------------------
  const latestStateRef = useRef({ room, items, naam: floorplanName });
  useEffect(() => {
    latestStateRef.current = { room, items, naam: floorplanName };
  }, [room, items, floorplanName]);

  const performSave = useCallback(async () => {
    setSaveStatus("saving");
    const { room: currentRoom, items: currentItems, naam } = latestStateRef.current;
    const result = await saveFloorplan3d({
      id: floorplanIdRef.current ?? undefined,
      naam,
      data: { version: 1, room: currentRoom, items: currentItems },
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
  }, []);

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
    history.push({ room, items });
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
    setSelectedId(null);
  }

  function handleItemPointerDown(id: string) {
    dragStartSnapshotRef.current = { room, items };
    dragStartItemRef.current = items.find((item) => item.id === id) ?? null;
    // Items die op het gesleepte item rusten reizen mee: ze tellen niet als
    // "andere" items, anders stapelt het onderste item op zijn eigen stapel
    // en schuift de hele stapel omhoog (ook bij een gewone klik).
    dragRestingIdsRef.current = new Set(findItemsResting(id, items, lookup));
    setDraggingId(id);
  }

  function handleFloorPointerMove(event: ThreeEvent<PointerEvent>) {
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
  function applyGymLayout(layoutId: GymLayoutId) {
    pushHistory();
    const layout = GYM_LAYOUTS[layoutId];
    const nextRoom: Floorplan3dRoom = { ...roomForGymLayout(layout), environment: createGymEnvironment(layoutId) };
    const fitted = clampItemsToRoom(items, nextRoom, lookup);
    setRoom(nextRoom);
    setItems(fitted.items);
    if (fitted.moved > 0) {
      toast.info(`${fitted.moved} ${fitted.moved === 1 ? "item" : "items"} verplaatst om in de nieuwe zaal te passen.`);
    }
    scheduleAutosave();
  }

  function changeRoomKind(kind: "leeg" | "gymzaal") {
    if (kind === "gymzaal") {
      if (!room.environment) applyGymLayout(DEFAULT_GYM_LAYOUT);
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
    if (!selectedItem) return;
    pushHistory();
    const newRot = normalizeRotationDeg(selectedItem.rot_y_deg + deltaDeg);
    setItems((prev) => prev.map((item) => (item.id === selectedItem.id ? { ...item, rot_y_deg: newRot } : item)));
    scheduleAutosave();
  }

  function deleteSelected() {
    if (!selectedItem) return;
    pushHistory();
    setItems((prev) => prev.filter((item) => item.id !== selectedItem.id));
    setSelectedId(null);
    scheduleAutosave();
  }

  function duplicateSelected() {
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
    if (!snapshot.items.some((item) => item.id === selectedId)) {
      setSelectedId(null);
    }
    scheduleAutosave();
  }

  function handleUndo() {
    const previous = history.undo({ room, items });
    if (previous) applyHistorySnapshot(previous);
  }

  function handleRedo() {
    const next = history.redo({ room, items });
    if (next) applyHistorySnapshot(next);
  }

  // ---------------------------------------------------------------------
  // Sneltoetsen — Stap 4.4 (R) + 4.8 (Delete, Ctrl+D, Ctrl+Z, Ctrl+Shift+Z).
  // ---------------------------------------------------------------------
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;

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
  }, [selectedId, selectedItem, items, room]);

  // ---------------------------------------------------------------------
  // "Mijn 3D-plattegronden" — openen/hernoemen/verwijderen.
  // ---------------------------------------------------------------------
  function startNewFloorplan() {
    pushHistory();
    setRoom(NEW_ROOM);
    setItems([]);
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

  const itemPanel = (
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
        <p className="text-sm text-muted-foreground">Selecteer een item om te draaien, dupliceren of verwijderen.</p>
      )}
    </div>
  );

  const roomPanel = (
    <div className="space-y-5">
      <div>
        <p className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Omgeving</p>
        <div className="grid grid-cols-2 gap-1.5">
          <Button
            type="button"
            variant={room.environment ? "default" : "outline"}
            aria-pressed={!!room.environment}
            onClick={() => changeRoomKind("gymzaal")}
          >
            Gymzaal
          </Button>
          <Button
            type="button"
            variant={room.environment ? "outline" : "default"}
            aria-pressed={!room.environment}
            onClick={() => changeRoomKind("leeg")}
          >
            Lege ruimte
          </Button>
          {["Sportveld", "Atletiekbaan", "Zwembad"].map((label) => (
            <Button key={label} type="button" variant="outline" disabled title="Komt binnenkort">
              {label}
            </Button>
          ))}
        </div>
      </div>

      {room.environment ? (
        <GymEnvironmentPanel
          environment={room.environment}
          onLayoutChange={applyGymLayout}
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
              onChange={(event) => {
                pushHistory();
                setRoom((prev) => ({ ...prev, width_m: Number(event.target.value) || prev.width_m }));
                scheduleAutosave();
              }}
            />
          </label>
          <label className="space-y-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Lengte (m)
            <Input
              type="number"
              min={1}
              step={0.5}
              value={room.length_m}
              onChange={(event) => {
                pushHistory();
                setRoom((prev) => ({ ...prev, length_m: Number(event.target.value) || prev.length_m }));
                scheduleAutosave();
              }}
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
    </div>
  );

  return (
    <div className="flex h-[100dvh] flex-col overscroll-none">
      <div className="flex shrink-0 items-center gap-2 border-b bg-card px-3 py-2">
        <BackButton fallbackHref="/dashboard" fallbackLabel="Terug" className="-ml-2" />
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
          <MaterialModelPicker3D models={models} onSelect={handleAddModel} />
        </aside>

        <div className="relative min-w-0 flex-1">
          <Scene3D
            room={room}
            items={items}
            modelBySlug={modelBySlug}
            selectedId={selectedId}
            isDragging={draggingId !== null}
            cameraMode={cameraMode}
            onItemPointerDown={handleItemPointerDown}
            onFloorPointerMove={handleFloorPointerMove}
            onFloorPointerUp={handleFloorPointerUp}
            onSelect={handleSelect}
            onBackgroundClick={handleBackgroundClick}
            debug={debug}
            debugGuides={debugGuides}
            lookup={lookup}
          />

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

        <aside className="hidden w-80 shrink-0 overflow-y-auto border-l bg-card p-3 lg:block">
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
