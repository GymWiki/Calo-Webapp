"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ThreeEvent } from "@react-three/fiber";
import {
  AlertTriangle,
  Check,
  FilePlus2,
  X,
  Cone,
  Copy,
  Loader2,
  Lock,
  LockOpen,
  Redo2,
  Save,
  ClipboardPaste,
  Scissors,
  Trash2,
  Undo2,
} from "lucide-react";
import { toast } from "@/components/canvas-3d/mobile/editor-toast";
import { StudentPanel, type StudentPatch } from "@/components/students/StudentPanel";
import { isStudentSlug, upgradeStudentItem } from "@/lib/students/catalog";
import {
  buildClipboard,
  clipboardCount,
  clipboardMessage,
  parseClipboard,
  pasteClipboard,
  serializeClipboard,
  PASTE_OFFSET_M,
  type ClipboardPayload,
} from "@/lib/plattegrond/clipboard";

import { deleteFloorplan3d, renameFloorplan3d, saveFloorplan3d, saveFloorplanPreview } from "@/actions/floorplans3d";
import { BackButton } from "@/components/BackButton";
import { GuestExportMenu, type GuestExportAction } from "@/components/guest/GuestExportMenu";
import { GuestUpsellBanner } from "@/components/guest/GuestUpsellBanner";
import { trackEvent } from "@/lib/analytics/track";
import { GUEST_TOOL_PATH } from "@/lib/guest/constants";
import { downloadBlob, withWatermark } from "@/lib/guest/export-image";
import { buildShareLink, encodeFloorplan } from "@/lib/guest/share-codec";
import { DEFAULT_VIEW, type ViewState } from "@/components/plattegrond/viewer-camera";
import { summarizeFloorplan } from "@/components/canvas-3d/floorplan-summary";
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
  fieldLabel,
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
import { footprintCenter, isElevated, originForCenter } from "@/components/canvas-3d/collision-shape";
import { normalizeItemRotation, orientationFor, type ResolvedOrientation } from "@/components/canvas-3d/asset-orientation";
import { itemIsTilted, localToWorld, rotationOf, type Rotation3 } from "@/components/canvas-3d/orientation";
import { RotationPanel } from "@/components/canvas-3d/RotationPanel";
import {
  DEFAULT_SNAP_DEG,
  applyPose,
  rotateWithGizmo,
  stepAxis,
  withAxis,
  type PoseId,
  type RotationAxis,
} from "@/components/canvas-3d/rotation-controls";
import { BottomSheet } from "@/components/canvas-3d/mobile/BottomSheet";
import { CameraMenu } from "@/components/canvas-3d/mobile/CameraMenu";
import { GestureOnboarding, hasSeenOnboarding } from "@/components/canvas-3d/mobile/GestureOnboarding";
import { MobileToolbar } from "@/components/canvas-3d/mobile/MobileToolbar";
import { AdminBadge } from "@/components/canvas-3d/AdminBadge";
import type { FloorplanAdminInfo } from "@/lib/services/adminFloorplans";
import { usePlattegrondJson } from "@/components/canvas-3d/usePlattegrondJson";
import { PlattegrondJsonMenu } from "@/components/canvas-3d/PlattegrondJsonMenu";
import type { ImportOk } from "@/lib/plattegrond/validate";
import { OverflowMenu } from "@/components/canvas-3d/mobile/OverflowMenu";
import { SelectionBar } from "@/components/canvas-3d/mobile/SelectionBar";
import { SidePanel } from "@/components/canvas-3d/mobile/SidePanel";
import {
  angleFromCenterDeg,
  draftStorageKey,
  resolveQuality,
  shouldOfferDraft,
  snapRotationDeg,
  type DraftPlan,
  type MobilePanel,
} from "@/components/canvas-3d/mobile/mobile-logic";
import { useCoarsePointer, useEditorLayout, useShortViewport } from "@/components/canvas-3d/mobile/useEditorLayout";
import { useEditorSettings } from "@/components/canvas-3d/mobile/useEditorSettings";
import { releaseAllModels, releaseModel } from "@/components/canvas-3d/model-cache";
import { haptic } from "@/lib/haptics";
import {
  clampItemsToRoom,
  dimsLookupFromModels,
  dimsForSlug,
  dimsOf,
  shapeOfDims,
  findItemsResting,
  findNearestFreeSpot,
  normalizeRotationDeg,
  recomputeStackedYs,
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
  debugCollision = false,
  debugLegacy = false,
  guest = false,
  guestPlan = null,
  onGuestClose,
  adminInfo = null,
}: {
  models: MaterialModel[];
  initialFloorplans: Floorplan3dSummary[];
  /** Al geopend vanuit "Mijn 3D-plattegronden" (server-side via ?open=<id>) — anders start de editor met een nieuwe, nog niet opgeslagen plattegrond. */
  initialFloorplan: { id: string; naam: string; data: Floorplan3dData } | null;
  /** Koppelt de plattegrond bij het opslaan aan deze (eigen) activiteit. */
  activiteitId?: string;
  /** `?debug=1`: voetafdrukken, snaplijnen en een log per drop. */
  debug?: boolean;
  /** `?debug=collision`: collision-vormen (blauw) en mesh-bounds (groen) per item. */
  debugCollision?: boolean;
  /** `?debug=collision-legacy`: de oude gecentreerde box (voor/na-vergelijking). */
  debugLegacy?: boolean;
  /**
   * Gastmodus (gratis tool, zonder account): GEEN server-acties. Opslaan = lokale kladversie (localStorage), delen/exporteren
   * gebeurt volledig in de browser, en "Mijn plattegronden" bestaat niet.
   */
  guest?: boolean;
  /** Gastmodus: een plattegrond uit een gedeelde link of voorbeeld (opent als nieuwe, lokale plattegrond). */
  guestPlan?: { naam?: string; data: Floorplan3dData } | null;
  /** Gastmodus: sluit de editor (terug naar de tekstpagina eromheen). */
  onGuestClose?: () => void;
  /** Beheermodus: alleen gezet voor beheerders die een plattegrond openen (eigenaar, activiteit, versies). */
  adminInfo?: FloorplanAdminInfo | null;
}) {
  const router = useRouter();
  const lookup = useMemo(() => dimsLookupFromModels(models, debugLegacy), [models, debugLegacy]);
  const modelBySlug = useCallback(
    (slug: string) => models.find((model) => model.slug === slug),
    [models],
  );

  /** Kantelregels van een asset (categorie, hangend materiaal, handmatige uitzonderingen). */
  function orientationOfSlug(slug: string): ResolvedOrientation {
    const model = models.find((candidate) => candidate.slug === slug);
    const dims = lookup(slug);
    return orientationFor({ slug, categorie: model?.categorie, subgroep: model?.subgroep }, dims ? isElevated(shapeOfDims(dims)) : false);
  }

  // Beginstand: een geopende plattegrond (ingelogd), of in gastmodus een gedeelde link/voorbeeld, of anders de lokale kladversie
  // van de vorige keer (stil hersteld: gasten hebben geen "Mijn plattegronden").
  const [seed] = useState<{ id: string | null; naam: string; data: Floorplan3dData } | null>(() => {
    if (initialFloorplan) return initialFloorplan;
    if (!guest) return null;
    if (guestPlan) return { id: null, naam: guestPlan.naam ?? "Gedeelde plattegrond", data: guestPlan.data };
    try {
      const raw = window.localStorage.getItem(draftStorageKey(null));
      const stored = raw ? (JSON.parse(raw) as DraftPlan) : null;
      if (stored && (stored.items.length > 0 || stored.coneFields.length > 0)) {
        return {
          id: null,
          naam: stored.naam || "Nieuwe plattegrond",
          data: { version: 1, room: stored.room as Floorplan3dRoom, items: stored.items as Floorplan3dItem[], coneFields: stored.coneFields as ConeField[] },
        };
      }
    } catch {
      // geen localStorage of kapotte kladversie: begin leeg
    }
    return null;
  });

  const [room, setRoom] = useState<Floorplan3dRoom>(seed?.data.room ?? NEW_ROOM);
  const [items, setItems] = useState<Floorplan3dItem[]>(() =>
    seed
      ? recomputeStackedYs(
          // Kantelhoeken binnen de limieten van het asset (oude plattegronden hebben er geen: ongewijzigd).
          seed.data.items.map(upgradeStudentItem).map((item) => normalizeItemRotation(item, orientationOfSlug(item.slug))),
          lookup,
        )
      : [],
  );
  // Oudere plattegronden hebben geen `coneFields` (de server geeft de jsonb ongeparsed terug).
  const [coneFields, setConeFields] = useState<ConeField[]>(seed?.data.coneFields ?? []);
  const [floorplanId, setFloorplanId] = useState<string | null>(seed?.id ?? null);
  const [floorplanName, setFloorplanName] = useState(seed?.naam ?? "Nieuwe plattegrond");
  const [floorplans, setFloorplans] = useState<Floorplan3dSummary[]>(initialFloorplans);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Meervoudige selectie: `primary` is het object met het paneel (= selectedId), `extras` de overige geselecteerde objecten.
  // Verandert selectedId op een andere manier (plaatsen, ongedaan maken, …), dan vervalt de groep vanzelf (primary klopt niet meer).
  const [group, setGroup] = useState<{ primary: string; extras: string[] } | null>(null);
  // Klembord (intern; óók als JSON in het systeemklembord) en plak-/aanwijzerstatus.
  const clipboardRef = useRef<ClipboardPayload | null>(null);
  const [hasClipboard, setHasClipboard] = useState(false);
  const pasteCountRef = useRef(0);
  const floorPointRef = useRef<{ x: number; z: number } | null>(null);
  const overCanvasRef = useRef(false);
  const modifierRef = useRef(false);
  const pendingCopyRef = useRef<string | null>(null);
  const pendingPasteRef = useRef(false);
  const clipboardActionsRef = useRef<{ pasteText: (text: string | null) => void }>({ pasteText: () => undefined });
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
  // Mobiel/tablet: layout per schermbreedte, touch per invoerapparaat, instellingen in localStorage.
  const layout = useEditorLayout();
  const coarsePointer = useCoarsePointer();
  const shortViewport = useShortViewport();
  const { settings, update: updateSettings } = useEditorSettings();
  const [autoFactor, setAutoFactor] = useState(1);
  const [cameraMenuOpen, setCameraMenuOpen] = useState(false);
  const [cameraResetKey, setCameraResetKey] = useState(0);
  const [onboarding, setOnboarding] = useState(() => window.matchMedia("(pointer: coarse)").matches && !hasSeenOnboarding());
  const [rotatingId, setRotatingId] = useState<string | null>(null);
  // Rotatie over alle assen: snapping, wereld/lokale assen en de 3D-ringen (desktop).
  const [snapDeg, setSnapDeg] = useState(DEFAULT_SNAP_DEG);
  const [localAxes, setLocalAxes] = useState(false);
  const [gizmoActive, setGizmoActive] = useState(false);
  const gizmoRef = useRef<{ id: string; start: Rotation3 } | null>(null);
  const viewCenterRef = useRef({ x: 0, z: 0 });
  const handleViewCenter = useCallback((center: { x: number; z: number }) => {
    viewCenterRef.current = center;
  }, []);
  const lastSnappedRef = useRef(false);
  const dirtyRef = useRef(false);
  const lowEndDevice = useMemo(() => {
    const nav = navigator as Navigator & { deviceMemory?: number };
    return (nav.hardwareConcurrency ?? 8) <= 4 || (nav.deviceMemory ?? 8) <= 4;
  }, []);
  const quality = useMemo(
    () => resolveQuality({ setting: settings.quality, devicePixelRatio: window.devicePixelRatio || 1, lowEndDevice, autoFactor }),
    [settings.quality, lowEndDevice, autoFactor],
  );
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const history = useFloorplan3dHistory();
  const dragStartSnapshotRef = useRef<Floorplan3dSnapshot | null>(null);
  const dragStartItemRef = useRef<Floorplan3dItem | null>(null);
  const dragRestingIdsRef = useRef<Set<string>>(new Set());
  const dragGroupFieldsRef = useRef<Map<string, { x: number; z: number }>>(new Map());
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
  const itemEditRef = useRef<number | null>(null);
  // Klik op de lege vloer (pointerdown + loslaten zonder te slepen) = selectie opheffen.
  const backgroundDownRef = useRef<{ x: number; y: number } | null>(null);
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
  // Alle geselecteerde objecten (primair + extra), alleen bestaande ids.
  const groupIds = useMemo(() => {
    if (!selectedId) return [] as string[];
    const extras = group && group.primary === selectedId ? group.extras.filter((id) => id !== selectedId) : [];
    return [selectedId, ...extras];
  }, [selectedId, group]);
  const groupIdSet = useMemo(() => new Set(groupIds), [groupIds]);
  const groupItems = useMemo(() => items.filter((item) => groupIdSet.has(item.id)), [items, groupIdSet]);
  const groupFields = useMemo(() => coneFields.filter((field) => groupIdSet.has(field.id)), [coneFields, groupIdSet]);
  const selectionCount = groupItems.length + groupFields.length;
  const isMultiSelection = selectionCount > 1;

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

  const performSaveRef = useRef<() => Promise<void>>(async () => {});
  const performSave = useCallback(async () => {
    // Gastmodus: niets naar de server. De lokale kladversie (zie het draft-effect hieronder) is de opslag.
    if (guest) {
      setSaveStatus("saved");
      return;
    }
    setSaveStatus("saving");
    const { room: currentRoom, items: currentItems, coneFields: currentFields, naam } = latestStateRef.current;
    let result: Awaited<ReturnType<typeof saveFloorplan3d>>;
    try {
      result = await saveFloorplan3d({
        id: floorplanIdRef.current ?? undefined,
        naam,
        activiteitId,
        data: { version: 1, room: currentRoom, items: currentItems, coneFields: currentFields },
      });
    } catch {
      result = { error: "Geen verbinding met de server." };
    }

    if ("error" in result) {
      setSaveStatus("error");
      // Je werk staat in de lokale kladversie (zie draft-effect): niets gaat verloren.
      const offline = typeof navigator !== "undefined" && !navigator.onLine;
      toast.error(offline ? "Je bent offline. Je wijzigingen zijn lokaal bewaard en worden opgeslagen zodra je weer online bent." : result.error, {
        id: "save-error",
        action: { label: "Opnieuw proberen", onClick: () => void performSaveRef.current() },
      });
      return;
    }

    toast.dismiss("save-error");
    dirtyRef.current = false;
    try {
      window.localStorage.removeItem(draftStorageKey(floorplanIdRef.current));
      window.localStorage.removeItem(draftStorageKey(null));
    } catch {
      // geen localStorage: niets op te ruimen
    }
    if (!floorplanIdRef.current) {
      setFloorplanId(result.id);
      floorplanIdRef.current = result.id;
    }
    setSaveStatus("saved");
    scheduleThumbnail();
  }, [activiteitId, scheduleThumbnail, guest]);

  useEffect(() => {
    performSaveRef.current = performSave;
  }, [performSave]);

  const scheduleAutosave = useCallback(() => {
    dirtyRef.current = true;
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

  // GPU-geheugen: een model dat niet meer op de plattegrond staat, wordt na 30 s opgeruimd (zodat
  // "ongedaan maken" nog snel kan); bij het sluiten van de editor gaat alles weg.
  const usedModelUrlsRef = useRef(new Set<string>());
  const releaseTimersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  useEffect(() => {
    const inUse = new Set(items.map((item) => modelBySlug(item.slug)?.model_url).filter((url): url is string => Boolean(url)));
    for (const url of inUse) {
      usedModelUrlsRef.current.add(url);
      const pending = releaseTimersRef.current.get(url);
      if (pending) {
        clearTimeout(pending);
        releaseTimersRef.current.delete(url);
      }
    }
    for (const url of usedModelUrlsRef.current) {
      if (inUse.has(url) || releaseTimersRef.current.has(url)) continue;
      releaseTimersRef.current.set(
        url,
        setTimeout(() => {
          releaseTimersRef.current.delete(url);
          usedModelUrlsRef.current.delete(url);
          releaseModel(url);
        }, 30_000),
      );
    }
  }, [items, modelBySlug]);
  useEffect(() => {
    const timers = releaseTimersRef.current;
    return () => {
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
      releaseAllModels();
    };
  }, []);

  // Lokale kladversie: elke wijziging (die nog niet is opgeslagen) wordt kort daarna in
  // localStorage bewaard, zodat een crash, per ongeluk sluiten of slechte verbinding niets kost.
  useEffect(() => {
    if (!dirtyRef.current) return;
    const timer = setTimeout(() => {
      try {
        const draft: DraftPlan = { savedAt: Date.now(), naam: floorplanName, room, items, coneFields };
        window.localStorage.setItem(draftStorageKey(floorplanId), JSON.stringify(draft));
      } catch {
        // vol of geblokkeerd: de serverautosave blijft werken
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [room, items, coneFields, floorplanName, floorplanId]);

  // Bij openen: staat er een nieuwere, niet-opgeslagen kladversie, bied herstel aan.
  useEffect(() => {
    if (guest) return; // gastmodus herstelt stil via `seed`
    let draft: DraftPlan | null = null;
    const key = draftStorageKey(initialFloorplan?.id ?? null);
    try {
      const raw = window.localStorage.getItem(key);
      draft = raw ? (JSON.parse(raw) as DraftPlan) : null;
    } catch {
      draft = null;
    }
    const loaded = {
      naam: initialFloorplan?.naam ?? "Nieuwe plattegrond",
      room: initialFloorplan?.data.room ?? NEW_ROOM,
      items: initialFloorplan?.data.items ?? [],
      coneFields: initialFloorplan?.data.coneFields ?? [],
    };
    if (!draft || !shouldOfferDraft(draft, loaded)) return;
    const found = draft;
    toast("Niet-opgeslagen wijzigingen gevonden", {
      id: "draft-restore",
      description: "Van een eerdere sessie of uit de gratis tool. Herstel hem om hem in je account te bewaren.",
      duration: Infinity,
      action: {
        label: "Herstellen",
        onClick: () => {
          setRoom(found.room as Floorplan3dRoom);
          setItems(found.items as Floorplan3dItem[]);
          setConeFields(found.coneFields as ConeField[]);
          setFloorplanName(found.naam);
          dirtyRef.current = true;
          scheduleAutosave();
        },
      },
      cancel: {
        label: "Negeren",
        onClick: () => {
          try {
            window.localStorage.removeItem(key);
          } catch {
            // niet erg
          }
        },
      },
    });
    // alleen bij het openen
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Waarschuwing bij verlaten met onopgeslagen wijzigingen; opnieuw proberen zodra de verbinding terug is.
  useEffect(() => {
    function onBeforeUnload(event: BeforeUnloadEvent) {
      if (guest || !dirtyRef.current) return; // gasten bewaren lokaal: geen waarschuwing nodig
      event.preventDefault();
      event.returnValue = "";
    }
    function onOnline() {
      if (!guest && dirtyRef.current) void performSaveRef.current();
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("online", onOnline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // Collision-vorm uit de lookup (offset/onderkant/draaiing); start zo dat het MIDDEN van de
    // voetafdruk in het midden van de kamer ligt, niet de pivot van het model.
    const dims = dimsForSlug(model.slug, undefined, lookup) ?? { length_m: model.length_m, width_m: model.width_m, height_m: model.height_m, stackable: model.stackable };
    // Midden van het zichtbare vlak (waar de camera naar kijkt); zonder pannen is dat het midden van de kamer.
    const center = viewCenterRef.current;
    const start = originForCenter(shapeOfDims(dims), center.x, center.z, 0);
    const orientation = orientationOfSlug(model.slug);
    const defaults = orientation.defaultRotation;
    const rotated = normalizeItemRotation(
      {
        rot_y_deg: defaults?.y ?? 0,
        ...(defaults?.x ? { rot_x_deg: defaults.x } : {}),
        ...(defaults?.z ? { rot_z_deg: defaults.z } : {}),
      },
      orientation,
    );
    const spot = findNearestFreeSpot(start.x, start.z, dims, rotated.rot_y_deg, items, room, lookup, { x: rotated.rot_x_deg, z: rotated.rot_z_deg });
    const newItem: Floorplan3dItem = {
      id: createItemId(),
      slug: model.slug,
      x: spot.x,
      y: 0,
      z: spot.z,
      ...rotated,
    };
    setItems((prev) => (itemIsTilted(newItem) ? recomputeStackedYs([...prev, newItem], lookup) : [...prev, newItem]));
    setSelectedId(newItem.id);
    if (isStudentSlug(model.slug)) {
      // Een leerling kies je eerst en plaats je; pose, kleur en grootte stel je daarna in het itempaneel in.
      setSideTab("item");
      if (layout !== "desktop") setMobilePanel("item");
    } else if (settings.closeLibraryAfterPlace) setMobilePanel(null);
    haptic(12);
    scheduleAutosave();
  }

  // ---------------------------------------------------------------------
  // Selecteren / slepen — zie Stap 4.2-4.5.
  // ---------------------------------------------------------------------
  function handleSelect(id: string) {
    if (modifierRef.current) {
      // Shift/Ctrl/Cmd+klik: object toevoegen aan of weghalen uit de selectie.
      if (groupIdSet.has(id)) {
        const rest = groupIds.filter((groupId) => groupId !== id);
        setSelectedId(rest[0] ?? null);
        setGroup(rest.length > 1 ? { primary: rest[0], extras: rest.slice(1) } : null);
      } else if (selectedId) {
        setGroup({ primary: selectedId, extras: [...groupIds.slice(1), id] });
      } else {
        setSelectedId(id);
      }
      setSideTab("item");
      return;
    }
    if (groupIds.length > 1 && groupIdSet.has(id)) {
      // Klik op een lid van de groep: de groep blijft (en schuift mee bij slepen).
      setSelectedId(id);
      setGroup({ primary: id, extras: groupIds.filter((groupId) => groupId !== id) });
      setSideTab("item");
      return;
    }
    setGroup(null);
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
    if (!drawMode) {
      // Items en velden stoppen de event zelf; alleen een klik op de lege vloer komt hier.
      backgroundDownRef.current = { x: event.nativeEvent.clientX, y: event.nativeEvent.clientY };
      return;
    }
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

  /** De velden van een item die plaatsing nodig heeft: model, draaiing, kanteling en hoogte. */
  function draggedFields(item: Floorplan3dItem) {
    return { slug: item.slug, rot_y_deg: item.rot_y_deg, rot_x_deg: item.rot_x_deg, rot_z_deg: item.rot_z_deg, lift_m: item.lift_m, size: item.size };
  }

  function handleItemPointerDown(id: string) {
    // Shift/Ctrl/Cmd+klik is alleen selecteren, geen slepen.
    if (modifierRef.current) return;
    dragStartSnapshotRef.current = { room, items, coneFields };
    dragStartItemRef.current = items.find((item) => item.id === id) ?? null;
    // Items die op het gesleepte item rusten reizen mee: ze tellen niet als
    // "andere" items, anders stapelt het onderste item op zijn eigen stapel
    // en schuift de hele stapel omhoog (ook bij een gewone klik).
    // Bij een meervoudige selectie reist de hele groep (ontgrendelde leden en afgezette velden) mee.
    const travelers = new Set(findItemsResting(id, items, lookup));
    const fieldStarts = new Map<string, { x: number; z: number }>();
    if (groupIds.length > 1 && groupIdSet.has(id)) {
      for (const member of items) {
        if (member.id === id || !groupIdSet.has(member.id) || member.locked) continue;
        travelers.add(member.id);
        findItemsResting(member.id, items, lookup).forEach((restingId) => travelers.add(restingId));
      }
      for (const field of coneFields) if (groupIdSet.has(field.id)) fieldStarts.set(field.id, { x: field.x, z: field.z });
    }
    dragRestingIdsRef.current = travelers;
    dragGroupFieldsRef.current = fieldStarts;
    setDraggingId(id);
  }

  function handleRotateHandleDown(id: string) {
    const item = items.find((candidate) => candidate.id === id);
    if (!item || item.locked) return;
    pushHistory();
    lastSnappedRef.current = false;
    setRotatingId(id);
  }

  /** Draait het item zo dat zijn voorkant naar de vinger wijst (per 15°), met het midden van de voetafdruk op zijn plek. */
  function rotateByHandle(point: { x: number; z: number }) {
    const item = items.find((candidate) => candidate.id === rotatingId);
    if (!item) return;
    const shape = shapeOfDims(dimsOf(item, lookup));
    const center = footprintCenter(shape, item.x, item.z, item.rot_y_deg);
    const target = normalizeRotationDeg(snapRotationDeg(angleFromCenterDeg(center.x, center.z, point.x, point.z)));
    if (target === normalizeRotationDeg(item.rot_y_deg)) return;
    const origin = originForCenter(shape, center.x, center.z, target);
    haptic(6);
    setItems((prev) => prev.map((candidate) => (candidate.id === item.id ? { ...candidate, rot_y_deg: target, x: origin.x, z: origin.z } : candidate)));
  }

  function handleFloorPointerMove(event: ThreeEvent<PointerEvent>) {
    floorPointRef.current = { x: event.point.x, z: event.point.z };
    if (rotatingId) {
      rotateByHandle({ x: event.point.x, z: event.point.z });
      return;
    }
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

    // De cursor houdt het MIDDEN van de voetafdruk vast (niet de pivot van het model).
    const origin = originForCenter(shapeOfDims(dimsOf(dragged, lookup)), event.point.x, event.point.z, dragged.rot_y_deg);
    const placement = resolvePlacement({
      pointer: origin,
      dragged: draggedFields(dragged),
      others: items.filter((item) => item.id !== draggingId && !dragRestingIdsRef.current.has(item.id)),
      room,
      grid: snapGrid,
      lookup,
    });
    if (debug) setDebugGuides(placement.guides);
    // Subtiele trilling zodra het item aan een lijn/ander item vastklikt (waar ondersteund).
    const snapped = placement.guides.length > 0;
    if (snapped && !lastSnappedRef.current) haptic(8);
    lastSnappedRef.current = snapped;

    const startItem = dragStartItemRef.current;
    const startItems = dragStartSnapshotRef.current?.items;
    const travelers = dragRestingIdsRef.current;
    const dx = startItem ? placement.x - startItem.x : 0;
    const dy = startItem ? placement.y - startItem.y : 0;
    const dz = startItem ? placement.z - startItem.z : 0;
    setItems((prev) =>
      prev.map((item) => {
        if (item.id === draggingId) return { ...item, x: placement.x, y: placement.y, z: placement.z };
        if (travelers.has(item.id)) {
          // Meereizende items (stapel of groep) schuiven live mee, vanaf hun beginpositie.
          const origin = startItems?.find((candidate) => candidate.id === item.id);
          return origin ? { ...item, x: origin.x + dx, y: origin.y + dy, z: origin.z + dz } : item;
        }
        return item;
      }),
    );
    if (dragGroupFieldsRef.current.size > 0) {
      setConeFields((prev) =>
        prev.map((field) => {
          const origin = dragGroupFieldsRef.current.get(field.id);
          return origin ? { ...field, x: origin.x + dx, z: origin.z + dz } : field;
        }),
      );
    }
  }

  function handleFloorPointerUp(event: ThreeEvent<PointerEvent>) {
    if (rotatingId) {
      setRotatingId(null);
      scheduleAutosave();
      return;
    }
    const backgroundDown = backgroundDownRef.current;
    backgroundDownRef.current = null;
    if (backgroundDown && !drawMode) {
      const moved = Math.hypot(event.nativeEvent.clientX - backgroundDown.x, event.nativeEvent.clientY - backgroundDown.y);
      if (moved < 5) setSelectedId(null);
    }
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
    lastSnappedRef.current = false;
    haptic(10);

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
        dragged: draggedFields(dragged),
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
        if (restingIds.has(item.id)) {
          const origin = startSnapshot.items.find((candidate) => candidate.id === item.id);
          return origin ? { ...item, x: origin.x + dx, y: origin.y + dy, z: origin.z + dz } : item;
        }
        return item;
      });
    });
    // Meegesleepte velden staan al op hun live-positie; alleen de verwijzing opruimen.
    dragGroupFieldsRef.current = new Map();

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
    if (selectedItem.locked) {
      toast.info("Dit item is vergrendeld.");
      return;
    }
    pushHistory();
    const newRot = normalizeRotationDeg(selectedItem.rot_y_deg + deltaDeg);
    setItems((prev) => prev.map((item) => (item.id === selectedItem.id ? { ...item, rot_y_deg: newRot } : item)));
    scheduleAutosave();
  }

  function deleteSelected() {
    // Geen bevestigingsdialoog maar een toast met "Ongedaan maken": sneller en minder foutgevoelig op touch.
    const undoAction = { label: "Ongedaan maken", onClick: () => handleUndoRef.current() };
    if (selectionCount === 0) return;
    const removableItems = groupItems.filter((item) => !item.locked);
    if (removableItems.length === 0 && groupFields.length === 0) {
      toast.info("Dit item is vergrendeld. Ontgrendel het eerst om te verwijderen.");
      return;
    }
    pushHistory();
    const removedItemIds = new Set(removableItems.map((item) => item.id));
    const removedFieldIds = new Set(groupFields.map((field) => field.id));
    if (removedItemIds.size > 0) setItems((prev) => prev.filter((item) => !removedItemIds.has(item.id)));
    if (removedFieldIds.size > 0) setConeFields((prev) => prev.filter((field) => !removedFieldIds.has(field.id)));
    setSelectedId(null);
    setGroup(null);
    scheduleAutosave();
    const removed = removedItemIds.size + removedFieldIds.size;
    const message = removed > 1 ? `${removed} objecten verwijderd` : removedFieldIds.size === 1 ? "Veld verwijderd" : "Item verwijderd";
    toast(message, { action: undoAction, duration: 6000 });
  }

  function toggleLockSelected() {
    if (!selectedItem) return;
    pushHistory();
    setItems((prev) => prev.map((item) => (item.id === selectedItem.id ? { ...item, locked: item.locked ? undefined : true } : item)));
    scheduleAutosave();
  }

  // ---------------------------------------------------------------------
  // Rotatie over alle assen: draaien (Y), kantelen voor/achter (X) en zijwaarts (Z), plus hoogte.
  // ---------------------------------------------------------------------
  /** Schrijft rotatie en/of hoogte naar één item; herberekent daarna de hoogtes (laagste punt op de vloer). */
  function commitOrientation(id: string, patch: { rot?: Rotation3; lift?: number | null }) {
    setItems((prev) => {
      const target = prev.find((item) => item.id === id);
      if (!target) return prev;
      let next: Floorplan3dItem = { ...target };
      if (patch.rot) {
        next.rot_y_deg = normalizeRotationDeg(patch.rot.y);
        next.rot_x_deg = patch.rot.x;
        next.rot_z_deg = patch.rot.z;
      }
      if (patch.lift !== undefined) {
        if (patch.lift === null) delete next.lift_m;
        else next.lift_m = patch.lift;
      }
      next = normalizeItemRotation(next, orientationOfSlug(next.slug));
      return recomputeStackedYs(prev.map((item) => (item.id === id ? next : item)), lookup);
    });
  }

  /**
   * Eén bewerking op het geselecteerde item. `coalesce` (schuifregelaar, invoerveld): opeenvolgende
   * wijzigingen binnen 1 s tellen als één undo-stap; knoppen en sneltoetsen zijn elk een eigen stap.
   */
  function editSelectedOrientation(patch: { rot?: Rotation3; lift?: number | null }, coalesce: boolean) {
    if (!selectedItem) return;
    if (selectedItem.locked) {
      toast.info("Dit item is vergrendeld.");
      return;
    }
    const now = Date.now();
    if (!coalesce || !itemEditRef.current || now - itemEditRef.current > 1000) pushHistory();
    itemEditRef.current = coalesce ? now : null;
    commitOrientation(selectedItem.id, patch);
    scheduleAutosave();
  }

  function setSelectedAxis(axis: RotationAxis, deg: number) {
    if (!selectedItem) return;
    editSelectedOrientation({ rot: withAxis(rotationOf(selectedItem), axis, deg, orientationOfSlug(selectedItem.slug)) }, true);
  }

  function stepSelectedAxis(axis: RotationAxis, deltaDeg: number) {
    if (!selectedItem) return;
    editSelectedOrientation({ rot: stepAxis(rotationOf(selectedItem), axis, deltaDeg, orientationOfSlug(selectedItem.slug)) }, false);
  }

  function applySelectedPose(pose: PoseId) {
    if (!selectedItem) return;
    editSelectedOrientation({ rot: applyPose(pose, rotationOf(selectedItem), orientationOfSlug(selectedItem.slug), dimsOf(selectedItem, lookup)) }, false);
  }

  function setSelectedLift(meters: number | null) {
    editSelectedOrientation({ lift: meters }, true);
  }

  // 3D-ringen (desktop): één undo-stap per sleepbeweging, rotatie berekend uit de startstand.
  function handleGizmoStart() {
    if (!selectedItem || selectedItem.locked) return;
    pushHistory();
    gizmoRef.current = { id: selectedItem.id, start: rotationOf(selectedItem) };
    setGizmoActive(true);
  }

  function handleGizmoDrag(axis: RotationAxis, deltaDeg: number, free: boolean) {
    const drag = gizmoRef.current;
    if (!drag) return;
    const target = items.find((item) => item.id === drag.id);
    if (!target) return;
    const next = rotateWithGizmo(drag.start, axis, deltaDeg, {
      local: localAxes,
      snapDeg: free ? 0 : snapDeg,
      config: orientationOfSlug(target.slug),
    });
    commitOrientation(drag.id, { rot: next });
  }

  function handleGizmoEnd() {
    gizmoRef.current = null;
    setGizmoActive(false);
    scheduleAutosave();
  }

  // ---------------------------------------------------------------------
  // Kopiëren, knippen, plakken en dupliceren (alle objecten, ook meerdere tegelijk) — lib/plattegrond/clipboard.ts.
  // ---------------------------------------------------------------------
  function selectObjects(ids: string[]) {
    setSelectedId(ids[0] ?? null);
    setGroup(ids.length > 1 ? { primary: ids[0], extras: ids.slice(1) } : null);
    if (ids.length > 0) setSideTab("item");
  }

  /** Alles selecteren (Ctrl+A): alle items en afgezette velden. */
  function selectAll() {
    const ids = [...items.map((item) => item.id), ...coneFields.map((field) => field.id)];
    if (ids.length === 0) {
      toast.info("Er is niets om te selecteren.");
      return;
    }
    selectObjects(ids);
    toast(`${ids.length} ${ids.length === 1 ? "object" : "objecten"} geselecteerd`, { duration: 2000 });
  }

  /** Zet de selectie op het interne klembord en (zodra de browser het toestaat) als JSON in het systeemklembord. */
  function copySelection(cut = false): boolean {
    if (selectionCount === 0) return false;
    const payload = buildClipboard(groupItems, groupFields);
    clipboardRef.current = payload;
    pasteCountRef.current = 0;
    setHasClipboard(true);
    // Het native "copy"-event schrijft de tekst synchroon; blijft dat uit (Safari zonder selectie), dan schrijven we hem hier.
    pendingCopyRef.current = serializeClipboard(payload);
    window.setTimeout(() => {
      const text = pendingCopyRef.current;
      if (text === null) return;
      pendingCopyRef.current = null;
      navigator.clipboard?.writeText(text).catch(() => undefined);
    }, 60);
    const count = clipboardCount(payload);
    if (!cut) {
      toast(clipboardMessage(count, "gekopieerd"), { duration: 2000 });
      return true;
    }
    const removableItems = groupItems.filter((item) => !item.locked);
    pushHistory();
    const removedItemIds = new Set(removableItems.map((item) => item.id));
    const removedFieldIds = new Set(groupFields.map((field) => field.id));
    if (removedItemIds.size > 0) setItems((prev) => prev.filter((item) => !removedItemIds.has(item.id)));
    if (removedFieldIds.size > 0) setConeFields((prev) => prev.filter((field) => !removedFieldIds.has(field.id)));
    setSelectedId(null);
    setGroup(null);
    scheduleAutosave();
    const lockedLeft = groupItems.length - removableItems.length;
    toast(clipboardMessage(count, "geknipt") + (lockedLeft > 0 ? ` (${lockedLeft} vergrendeld: blijft staan)` : ""), {
      duration: 4000,
      action: { label: "Ongedaan maken", onClick: () => handleUndoRef.current() },
    });
    return true;
  }

  /** Plakt `payload`: kopieën met nieuwe id's, gesnapt en binnen de zaal; één undo-stap; de kopieën worden geselecteerd. */
  function pasteObjects(payload: ClipboardPayload, mode: "plak" | "dupliceer" = "plak") {
    const index = mode === "plak" ? ++pasteCountRef.current : 1;
    const point = floorPointRef.current;
    const target = mode === "plak" && overCanvasRef.current && point ? { x: point.x + PASTE_OFFSET_M * (index - 1), z: point.z + PASTE_OFFSET_M * (index - 1) } : null;
    const result = pasteClipboard(payload, {
      room,
      lookup,
      grid: typeof snapGrid === "number" ? snapGrid : 0,
      target,
      pasteIndex: index,
      offset: mode === "dupliceer" ? { x: PASTE_OFFSET_M, z: PASTE_OFFSET_M } : undefined,
      createId: createItemId,
    });
    pushHistory();
    // Hoogtes opnieuw berekenen: een kopie die op een ander item valt, stapelt erop.
    setItems((prev) => recomputeStackedYs([...prev, ...result.items], lookup));
    setConeFields((prev) => [...prev, ...result.coneFields]);
    selectObjects([...result.items, ...result.coneFields].map((object) => object.id));
    scheduleAutosave();
    haptic(12);
    const count = result.items.length + result.coneFields.length;
    toast(mode === "dupliceer" ? `${count === 1 ? "1 object" : `${count} objecten`} gedupliceerd` : clipboardMessage(count, "geplakt"), { duration: 2000 });
  }

  /** Plakken met tekst uit het systeemklembord (event) of, zonder tekst, het interne klembord. */
  function pasteFromText(text: string | null) {
    if (text && text.trim()) {
      const parsed = parseClipboard(text);
      if (parsed.ok) pasteObjects(parsed.payload);
      else toast.error(parsed.error);
      return;
    }
    if (clipboardRef.current) pasteObjects(clipboardRef.current);
    else toast.info("Er staat niets in het klembord.");
  }

  function duplicateSelected() {
    if (selectionCount === 0) return;
    pasteObjects(buildClipboard(groupItems, groupFields), "dupliceer");
  }

  /** Pose, kleur of grootte van de geselecteerde leerling. Kleurkiezer-sleepbewegingen binnen 1 s tellen als één undo-stap. */
  function editSelectedStudent(patch: StudentPatch) {
    if (!selectedItem || !isStudentSlug(selectedItem.slug)) return;
    if (selectedItem.locked) {
      toast.info("Dit item is vergrendeld.");
      return;
    }
    const coalesce = patch.color !== undefined;
    const now = Date.now();
    if (!coalesce || !itemEditRef.current || now - itemEditRef.current > 1000) pushHistory();
    itemEditRef.current = coalesce ? now : null;
    const id = selectedItem.id;
    setItems((prev) =>
      recomputeStackedYs(
        prev.map((item) => {
          if (item.id !== id) return item;
          const next = { ...item };
          if (patch.slug) next.slug = patch.slug;
          if (patch.color !== undefined) {
            if (patch.color) next.color = patch.color;
            else delete next.color;
          }
          if (patch.size) {
            if (patch.size === "middel") delete next.size;
            else next.size = patch.size;
          }
          return next;
        }),
        lookup,
      ),
    );
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

  const handleUndoRef = useRef(handleUndo);
  useEffect(() => {
    handleUndoRef.current = handleUndo;
  });

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
      if ((event.ctrlKey || event.metaKey) && !event.altKey && !drawMode) {
        const lower = event.key.toLowerCase();
        const hasTextSelection = Boolean(window.getSelection()?.toString());
        if (lower === "a" && !event.shiftKey) {
          // Ctrl/Cmd+A: alle objecten selecteren (de browser selecteert dan geen paginatekst).
          event.preventDefault();
          selectAll();
          return;
        }
        if (lower === "c" && !hasTextSelection) {
          // Geen preventDefault: het native "copy"-event schrijft de JSON synchroon naar het systeemklembord.
          if (selectionCount > 0) copySelection(false);
          return;
        }
        if (lower === "x" && !hasTextSelection) {
          if (selectionCount > 0) {
            event.preventDefault();
            copySelection(true);
          }
          return;
        }
        if (lower === "v" && !hasTextSelection) {
          // Het native "paste"-event levert de tekst uit het systeemklembord (zonder toestemmingsvraag); blijft dat uit, dan het interne klembord.
          pendingPasteRef.current = true;
          window.setTimeout(() => {
            if (!pendingPasteRef.current) return;
            pendingPasteRef.current = false;
            clipboardActionsRef.current.pasteText(null);
          }, 80);
          return;
        }
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
      if (event.ctrlKey || event.metaKey || event.altKey || !selectedId) return;
      const key = event.key.toLowerCase();
      const direction = event.shiftKey ? -1 : 1;
      const step = snapDeg > 0 ? snapDeg : ROTATION_STEP_SMALL_DEG;
      if (key === "r") {
        // R = draaien (Y), Shift+R = de andere kant op.
        event.preventDefault();
        if (selectedItem) stepSelectedAxis("y", direction * step);
        else rotateSelected(direction * ROTATION_STEP_SMALL_DEG);
      } else if (key === "t" && selectedItem) {
        // T = kantelen voor/achter (X), G = kantelen zijwaarts (Z); Shift keert om.
        event.preventDefault();
        stepSelectedAxis("x", direction * step);
      } else if (key === "g" && selectedItem) {
        event.preventDefault();
        stepSelectedAxis("z", direction * step);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, selectedItem, selectedField, items, coneFields, room, drawMode, draft, snapDeg, group, snapGrid, hasClipboard]);

  // Klembord-events van de browser, en de aanwijzer: boven het canvas? Shift/Ctrl/Cmd ingedrukt bij een klik?
  useEffect(() => {
    clipboardActionsRef.current = { pasteText: pasteFromText };
  });
  useEffect(() => {
    const isEditable = (target: EventTarget | null) => {
      const element = target as HTMLElement | null;
      return Boolean(element && (element.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(element.tagName)));
    };
    const onCopy = (event: ClipboardEvent) => {
      if (pendingCopyRef.current === null || isEditable(event.target)) return;
      event.clipboardData?.setData("text/plain", pendingCopyRef.current);
      event.preventDefault();
      pendingCopyRef.current = null;
    };
    const onPaste = (event: ClipboardEvent) => {
      if (!pendingPasteRef.current || isEditable(event.target)) return;
      pendingPasteRef.current = false;
      event.preventDefault();
      clipboardActionsRef.current.pasteText(event.clipboardData?.getData("text/plain") ?? "");
    };
    const onPointer = (event: PointerEvent) => {
      modifierRef.current = event.shiftKey || event.ctrlKey || event.metaKey;
      overCanvasRef.current = (event.target as HTMLElement | null)?.tagName === "CANVAS";
    };
    document.addEventListener("copy", onCopy);
    document.addEventListener("cut", onCopy);
    document.addEventListener("paste", onPaste);
    window.addEventListener("pointerdown", onPointer, true);
    window.addEventListener("pointermove", onPointer, true);
    return () => {
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("cut", onCopy);
      document.removeEventListener("paste", onPaste);
      window.removeEventListener("pointerdown", onPointer, true);
      window.removeEventListener("pointermove", onPointer, true);
    };
  }, []);

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
    if (guest) {
      // "Nieuwe plattegrond" wist ook de lokale kladversie, anders komt de oude bij het volgende bezoek terug.
      dirtyRef.current = false;
      try {
        window.localStorage.removeItem(draftStorageKey(null));
      } catch {
        // niets te wissen
      }
    }
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

  // ---------------------------------------------------------------------
  // Gastmodus: delen en exporteren (alles in de browser), analytics-events en de zachte upsell.
  // ---------------------------------------------------------------------
  const [guestBusy, setGuestBusy] = useState<GuestExportAction | null>(null);
  const [upsellVisible, setUpsellVisible] = useState(false);
  const [captureView, setCaptureView] = useState<ViewState | null>(null);
  // Elke opname krijgt een eigen sleutel: twee opnames kort na elkaar (PDF: 3D + bovenaanzicht) mounten zo twee keer opnieuw.
  const [captureSeq, setCaptureSeq] = useState(0);
  const captureResolveRef = useRef<((dataUrl: string) => void) | null>(null);
  const handleCaptured = useCallback((dataUrl: string) => {
    const resolve = captureResolveRef.current;
    captureResolveRef.current = null;
    setCaptureView(null);
    // Een frame wachten zodat de oude opname-component écht unmount vóór een volgende opname start.
    window.requestAnimationFrame(() => resolve?.(dataUrl));
  }, []);
  const [captureFormat, setCaptureFormat] = useState<{ mime: "image/png" | "image/jpeg"; width: number; height: number }>({ mime: "image/png", width: 1600, height: 900 });
  function captureImage(preset: "3d" | "top", format: { mime: "image/png" | "image/jpeg"; width: number; height: number } = { mime: "image/png", width: 1600, height: 900 }): Promise<string> {
    return new Promise((resolve) => {
      setCaptureFormat(format);
      captureResolveRef.current = resolve;
      setCaptureSeq((value) => value + 1);
      setCaptureView({ ...DEFAULT_VIEW, preset });
    });
  }

  useEffect(() => {
    if (guest) trackEvent("editor_gestart", { met_plattegrond: Boolean(seed) });
    // alleen bij het openen
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const firstItemTrackedRef = useRef(false);
  useEffect(() => {
    if (!guest || firstItemTrackedRef.current || items.length === 0) return;
    firstItemTrackedRef.current = true;
    trackEvent("eerste_item_geplaatst");
  }, [guest, items.length]);

  async function runGuestExport(action: GuestExportAction) {
    if (guestBusy) return;
    if (items.length === 0 && coneFields.length === 0) {
      toast.info("Zet eerst iets neer op de plattegrond; dan kun je delen of exporteren.");
      return;
    }
    setGuestBusy(action);
    try {
      const data: Floorplan3dData = { version: 1, room, items, coneFields };
      const baseName = (floorplanName || "plattegrond").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "plattegrond";
      if (action === "link") {
        const link = buildShareLink(`${window.location.origin}${GUEST_TOOL_PATH}`, await encodeFloorplan(data));
        if (link.tooLong) {
          toast.error("Deze plattegrond is te groot voor een link. Download de afbeelding of PDF om hem te delen.");
          return;
        }
        try {
          await navigator.clipboard.writeText(link.url);
          toast.success("Link gekopieerd. Wie hem opent, ziet dezelfde plattegrond, zonder account.");
        } catch {
          window.prompt("Kopieer deze link", link.url);
        }
        trackEvent("deelbare_link", { lengte: link.length });
      } else if (action === "png-3d" || action === "png-top") {
        const blob = await withWatermark(await captureImage(action === "png-3d" ? "3d" : "top"));
        downloadBlob(blob, `gymwiki-${baseName}-${action === "png-3d" ? "3d" : "bovenaanzicht"}.png`);
        trackEvent("export_png", { weergave: action === "png-3d" ? "3d" : "bovenaanzicht" });
      } else {
        // JPEG op 1200 × 675: de PDF-engine decodeert PNG's van 1600 × 900 in de browser traag.
        const pdfFormat = { mime: "image/jpeg", width: 1200, height: 675 } as const;
        const image3d = await captureImage("3d", pdfFormat);
        const imageTop = await captureImage("top", pdfFormat);
        const nameBySlug = new Map(models.map((model) => [model.slug, model.naam]));
        const categoryBySlug = new Map(models.map((model) => [model.slug, model.categorie]));
        const summary = summarizeFloorplan(items, coneFields, (slug) => nameBySlug.get(slug), (slug) => categoryBySlug.get(slug));
        // @react-pdf/renderer (2,8 MB) pas laden op het moment van exporteren, nooit in de statische bundel.
        const [{ pdf }, { FloorplanPdfDocument }, { createElement }] = await Promise.all([
          import("@react-pdf/renderer"),
          import("@/components/guest/FloorplanPdfDocument"),
          import("react"),
        ]);
        const blob = await pdf(createElement(FloorplanPdfDocument, { title: floorplanName || "Plattegrond", summary, image3d, imageTop })).toBlob();
        downloadBlob(blob, `gymwiki-${baseName}.pdf`);
        trackEvent("export_pdf", { items: summary.itemTotal });
      }
      setUpsellVisible(true);
    } catch (error) {
      console.error("Gast-export mislukt:", error);
      toast.error("Exporteren is niet gelukt. Probeer het opnieuw.");
    } finally {
      setGuestBusy(null);
    }
  }

  const captureMount = captureView && (
    <FloorplanThumbnailCapture
      key={captureSeq}
      room={room}
      items={items}
      fields={coneFields}
      models={models}
      view={captureView}
      width={captureFormat.width}
      height={captureFormat.height}
      mime={captureFormat.mime}
      onCapture={handleCaptured}
    />
  );

  // ---------------------------------------------------------------------
  // Plattegrond als JSON: downloaden, kopiëren en openen (lib/plattegrond = dezelfde logica als deellink en CLI).
  // ---------------------------------------------------------------------
  const knownSlugs = useMemo(() => new Set(models.map((model) => model.slug)), [models]);
  const plattegrondJson = usePlattegrondJson({
    getScene: () => {
      const { room: currentRoom, items: currentItems, coneFields: currentFields } = latestStateRef.current;
      return { version: 1, room: currentRoom, items: currentItems, coneFields: currentFields };
    },
    title: floorplanName,
    knownSlugs,
    hasWork: () => (latestStateRef.current.items.length > 0 || latestStateRef.current.coneFields.length > 0) && (guest || dirtyRef.current),
    onApply: applyImportedScene,
  });

  function applyImportedScene(result: ImportOk) {
    pushHistory(); // één undo-stap terug
    const normalized = recomputeStackedYs(
      result.scene.items.map((item) => normalizeItemRotation(item, orientationOfSlug(item.slug))),
      lookup,
    );
    const { items: placed } = clampItemsToRoom(normalized, result.scene.room, lookup);
    setRoom(result.scene.room);
    setItems(placed);
    setConeFields(result.scene.coneFields);
    setFloorplanName(result.title);
    setSelectedId(null);
    setMobilePanel(null);
    dirtyRef.current = true;
    scheduleAutosave();
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

  const rotationPanel = selectedItem ? (
    <RotationPanel
      variant={layout === "desktop" ? "panel" : "drawer"}
      rotation={rotationOf(selectedItem)}
      lift={selectedItem.lift_m}
      orientation={orientationOfSlug(selectedItem.slug)}
      locked={Boolean(selectedItem.locked)}
      snapDeg={snapDeg}
      onSnapChange={setSnapDeg}
      localAxes={localAxes}
      onLocalAxesChange={setLocalAxes}
      onSetAxis={setSelectedAxis}
      onStepAxis={stepSelectedAxis}
      onPose={applySelectedPose}
      onLift={setSelectedLift}
    />
  ) : null;

  const clipboardButtons = (
    <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="Klembord">
      <Button type="button" variant="outline" size="sm" title="Kopiëren (Ctrl+C)" aria-label="Kopiëren" data-testid="knop-kopieren" onClick={() => copySelection(false)}>
        <Copy className="size-4" /> Kopieer
      </Button>
      <Button type="button" variant="outline" size="sm" title="Knippen (Ctrl+X)" aria-label="Knippen" data-testid="knop-knippen" onClick={() => copySelection(true)}>
        <Scissors className="size-4" /> Knip
      </Button>
      <Button type="button" variant="outline" size="sm" title="Plakken (Ctrl+V)" aria-label="Plakken" data-testid="knop-plakken" disabled={!hasClipboard} onClick={() => clipboardRef.current && pasteObjects(clipboardRef.current)}>
        <ClipboardPaste className="size-4" /> Plak
      </Button>
    </div>
  );

  const groupPanel = (
    <div className="space-y-3" data-testid="groep-paneel">
      <p className="text-sm font-medium">{selectionCount} objecten geselecteerd</p>
      <p className="text-xs text-muted-foreground">Sleep één van de objecten om de hele selectie te verplaatsen. Shift/Ctrl/Cmd+klik voegt toe of haalt weg.</p>
      {clipboardButtons}
      <Button type="button" variant="outline" className="w-full" title="Dupliceren (Ctrl+D)" onClick={duplicateSelected}>
        <Copy className="size-4" /> Dupliceren (Ctrl+D)
      </Button>
      <Button type="button" variant="outline" className="w-full text-destructive" onClick={deleteSelected}>
        <Trash2 className="size-4" /> Verwijderen (Delete)
      </Button>
      <Button type="button" variant="ghost" className="w-full" onClick={() => setSelectedId(null)}>
        Selectie opheffen
      </Button>
    </div>
  );

  const itemPanel = isMultiSelection ? groupPanel : selectedField ? (
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
          {isStudentSlug(selectedItem.slug) && (
            <StudentPanel item={selectedItem} models={models} disabled={Boolean(selectedItem.locked)} onChange={editSelectedStudent} />
          )}
          {rotationPanel}
          <Button type="button" variant={selectedItem.locked ? "default" : "outline"} className="w-full" aria-pressed={Boolean(selectedItem.locked)} onClick={toggleLockSelected}>
            {selectedItem.locked ? <LockOpen className="size-4" /> : <Lock className="size-4" />} {selectedItem.locked ? "Ontgrendelen" : "Vergrendelen"}
          </Button>
          {clipboardButtons}
          <Button type="button" variant="outline" className="w-full" title="Dupliceren (Ctrl+D)" onClick={duplicateSelected}>
            <Copy className="size-4" /> Dupliceren (Ctrl+D)
          </Button>
          <Button type="button" variant="outline" className="w-full text-destructive" onClick={deleteSelected}>
            <Trash2 className="size-4" /> Verwijderen (Delete)
          </Button>
        </>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">Selecteer een item of veld om te draaien, dupliceren of verwijderen. Ctrl+A selecteert alles.</p>
          {hasClipboard && (
            <Button type="button" variant="outline" className="w-full" title="Plakken (Ctrl+V)" data-testid="knop-plakken" onClick={() => clipboardRef.current && pasteObjects(clipboardRef.current)}>
              <ClipboardPaste className="size-4" /> Plakken (Ctrl+V)
            </Button>
          )}
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

  // -------------------------------------------------------------------
  // Weergave: desktop (≥ 1024 px) houdt de vaste drie kolommen; telefoon en tablet krijgen
  // een canvas-eerst-indeling met werkbalk onderaan en drawers/zijpaneel.
  // -------------------------------------------------------------------
  const isDesktop = layout === "desktop";
  // De rotatie-drawer hoort bij een geselecteerd item: zonder selectie sluit hij vanzelf.
  const activePanel: MobilePanel = mobilePanel === "rotatie" && !selectedItem ? null : mobilePanel;
  const hasSelection = Boolean(selectedItem || selectedField);
  const selectionTitle = isMultiSelection ? `${selectionCount} objecten` : selectedField ? fieldLabel(selectedField) : selectedItem ? (modelBySlug(selectedItem.slug)?.naam ?? "Onbekend item") : "";

  function resetCamera() {
    viewCenterRef.current = { x: 0, z: 0 };
    setCameraResetKey((key) => key + 1);
  }

  // 3D-ringen: alleen met een muis (desktop), voor een ontgrendeld item dat niet gesleept wordt.
  const gizmoItem = isDesktop && !coarsePointer && !drawMode && !draggingId && !rotatingId && !isMultiSelection && selectedItem && !selectedItem.locked ? selectedItem : null;
  const gizmoProps = (() => {
    if (!gizmoItem) return null;
    const shape = shapeOfDims(dimsOf(gizmoItem, lookup));
    if (shape.kind === "none") return null;
    const rotation = rotationOf(gizmoItem);
    return {
      center: localToWorld(shape, [gizmoItem.x, gizmoItem.y, gizmoItem.z], rotation, [shape.offset_x, shape.base_m + shape.height_m / 2, shape.offset_z]),
      radius: Math.hypot(shape.length_m, shape.width_m, shape.height_m) / 2,
      rotation,
      local: localAxes,
      axes: orientationOfSlug(gizmoItem.slug).allowTilt ? (["y", "x", "z"] as RotationAxis[]) : (["y"] as RotationAxis[]),
      onStart: handleGizmoStart,
      onDrag: handleGizmoDrag,
      onEnd: handleGizmoEnd,
    };
  })();

  const scene = (
    <Scene3D
      room={room}
      items={items}
      modelBySlug={modelBySlug}
      selectedId={selectedId}
      groupIds={isMultiSelection ? groupIdSet : undefined}
      isDragging={draggingId !== null || fieldDragActive || rotatingId !== null || gizmoActive}
      gizmo={gizmoProps}
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
      debugCollision={debugCollision}
      debugGuides={debugGuides}
      lookup={lookup}
      quality={quality}
      onPerformanceChange={settings.quality === "auto" ? setAutoFactor : undefined}
      onViewCenter={handleViewCenter}
      cameraResetKey={cameraResetKey}
      onResetCamera={resetCamera}
      touchUi={coarsePointer}
      onRotateHandleDown={handleRotateHandleDown}
    />
  );

  // Zwevend label tijdens "Veld afzetten": instructie, en zodra er een rechthoek is de afmetingen en het aantal pionnen.
  const drawChip = drawMode && (
    <div className="pointer-events-none absolute inset-x-0 top-2 flex justify-center px-2">
      <div className="pointer-events-auto flex max-w-full flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-2xl bg-slate-900/90 px-3 py-1.5 text-xs text-white shadow">
        <Cone className="size-3.5 shrink-0" aria-hidden="true" />
        <span>
          {draft?.phase === "waiting"
            ? "Tik op de tegenoverliggende hoek"
            : "Sleep een rechthoek op de vloer, of tik twee hoeken"}
        </span>
        {draftField && draft && Math.abs(draft.c.x - draft.a.x) > 0.3 && <strong>{fieldLabel(draftField)}</strong>}
        <button type="button" onClick={stopDrawing} className="min-h-8 rounded-full bg-white/15 px-3 py-0.5 font-medium hover:bg-white/25">
          Stoppen{isDesktop ? " (Esc)" : ""}
        </button>
      </div>
    </div>
  );

  // Na het afzetten blijft het veld geselecteerd (handles om aan te passen): label met afmetingen + "Klaar".
  const fieldHud =
    !isDesktop && !drawMode && selectedField ? (
      <div className="pointer-events-none absolute inset-x-0 top-2 flex justify-center px-2">
        <div className="pointer-events-auto flex max-w-full items-center gap-2 rounded-2xl bg-slate-900/90 py-1 pr-1 pl-3 text-xs text-white shadow">
          <Cone className="size-3.5 shrink-0" aria-hidden="true" />
          <strong className="truncate">{fieldLabel(selectedField)}</strong>
          <button type="button" onClick={() => setSelectedId(null)} className="min-h-9 rounded-xl bg-primary px-4 font-semibold text-primary-foreground">
            Klaar
          </button>
        </div>
      </div>
    ) : null;

  const panelTitle: Record<Exclude<MobilePanel, null>, string> = {
    materiaal: "Bibliotheek",
    item: "Item",
    rotatie: "Rotatie",
    kamer: "Omgeving",
    lijst: "Mijn 3D-plattegronden",
  };

  function panelContent(panel: Exclude<MobilePanel, null>) {
    if (panel === "materiaal") {
      return <MaterialModelPicker3D models={models} syncFavorites={!guest} onSelect={handleAddModel} surfaceClassName={layout === "phone" ? "bg-background" : "bg-card"} />;
    }
    // Op touch: knoppen en velden in de panelen minimaal 44 px hoog (de panelen zelf zijn voor muis ontworpen).
    const touchSizing = "[&_button:not([role=switch])]:pointer-coarse:min-h-11 [&_input]:pointer-coarse:min-h-11";
    if (panel === "item") return <div className={touchSizing}>{itemPanel}</div>;
    if (panel === "rotatie") return <div className={touchSizing}>{rotationPanel}</div>;
    if (panel === "kamer") return <div className={touchSizing}>{roomPanel}</div>;
    return (
      <MyFloorplans3dList
        floorplans={floorplans}
        activeId={floorplanId}
        onOpen={handleOpen}
        onRename={handleRename}
        onDelete={handleDelete}
        onCreateNew={startNewFloorplan}
      />
    );
  }

  const saveIcon =
    saveStatus === "saving" ? (
      <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden="true" />
    ) : saveStatus === "saved" ? (
      <Check className="size-4 text-green-600" aria-hidden="true" />
    ) : saveStatus === "error" ? (
      <AlertTriangle className="size-4 text-destructive" aria-hidden="true" />
    ) : null;

  if (!isDesktop) {
    return (
      <div className="relative flex h-[100dvh] flex-col overscroll-none" {...plattegrondJson.dragProps}>
        {plattegrondJson.elements}
        <header className="flex shrink-0 items-center gap-1 border-b bg-card px-2 pt-[env(safe-area-inset-top)]">
          {guest ? (
            <button
              type="button"
              aria-label="Editor sluiten"
              onClick={onGuestClose}
              className="-ml-1 flex size-11 shrink-0 items-center justify-center rounded-lg hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          ) : (
            <BackButton fallbackHref={activiteitId ? `/activiteit/${activiteitId}` : "/dashboard"} fallbackLabel="Terug" className="-ml-1 h-11" />
          )}
          <input
            value={floorplanName}
            onChange={(event) => {
              setFloorplanName(event.target.value);
              scheduleAutosave();
            }}
            aria-label="Naam van de plattegrond"
            className="h-11 min-w-0 flex-1 truncate rounded-md bg-transparent px-2 text-base font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          />
          <span role="status" aria-label={saveStatusLabel[saveStatus]} className="flex size-6 shrink-0 items-center justify-center">
            {saveIcon}
          </span>
          {adminInfo && <AdminBadge info={adminInfo} onRestored={() => window.location.reload()} />}
          {guest ? (
            <GuestExportMenu compact onAction={(action) => void runGuestExport(action)} busy={guestBusy} />
          ) : (
            <button
              type="button"
              aria-label="Opslaan"
              onClick={() => void handleSaveNow()}
              disabled={saveStatus === "saving"}
              className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none active:scale-95 disabled:opacity-60"
            >
              <Save className="size-5" aria-hidden="true" />
            </button>
          )}
          <OverflowMenu
            settings={settings}
            onSettings={updateSettings}
            onOpenList={guest ? undefined : () => setMobilePanel("lijst")}
            onNewPlan={guest ? startNewFloorplan : undefined}
            onJson={plattegrondJson.run}
            onShowHelp={() => setOnboarding(true)}
          />
        </header>

        <div className="relative min-h-0 flex-1 overflow-hidden" data-testid="editor-canvas-area">
          {scene}
          {guest && upsellVisible && <GuestUpsellBanner onDismiss={() => setUpsellVisible(false)} />}
          {drawChip}
          {fieldHud}
          {cameraMenuOpen && (
            <CameraMenu
              mode={cameraMode}
              onMode={(mode) => {
                setCameraMode(mode);
                resetCamera();
              }}
              onReset={resetCamera}
            />
          )}
          {hasSelection && !drawMode && !(layout === "phone" && activePanel) && (
            <SelectionBar
              title={selectionTitle}
              compact={shortViewport}
              locked={Boolean(selectedItem?.locked)}
              canLock={Boolean(selectedItem)}
              onRotate={rotateSelected}
              onOpenRotation={selectedItem ? () => setMobilePanel("rotatie") : undefined}
              onDuplicate={duplicateSelected}
              onCopy={() => copySelection(false)}
              onPaste={hasClipboard ? () => clipboardRef.current && pasteObjects(clipboardRef.current) : undefined}
              onToggleLock={toggleLockSelected}
              onDelete={deleteSelected}
              onDeselect={() => setSelectedId(null)}
            />
          )}
          {layout === "tablet" && activePanel && (
            <SidePanel side={activePanel === "materiaal" ? "left" : "right"} title={panelTitle[activePanel]} onClose={() => setMobilePanel(null)}>
              {panelContent(activePanel)}
            </SidePanel>
          )}
          {onboarding && <GestureOnboarding onClose={() => setOnboarding(false)} />}
        </div>

        <MobileToolbar
          panel={activePanel}
          onPanel={(panel) => {
            setCameraMenuOpen(false);
            setMobilePanel(panel);
          }}
          hasSelection={hasSelection}
          drawMode={drawMode}
          onToggleDraw={() => (drawMode ? stopDrawing() : startDrawing())}
          cameraMenuOpen={cameraMenuOpen}
          onToggleCameraMenu={() => setCameraMenuOpen((open) => !open)}
          canUndo={history.canUndo}
          canRedo={history.canRedo}
          onUndo={handleUndo}
          onRedo={handleRedo}
          compact={shortViewport}
        />

        {layout === "phone" && activePanel && (
          <BottomSheet key={activePanel} title={panelTitle[activePanel]} onClose={() => setMobilePanel(null)} peek={activePanel === "rotatie"}>
            {panelContent(activePanel)}
          </BottomSheet>
        )}

        {thumbnailJob && (
          <FloorplanThumbnailCapture
            room={thumbnailJob.room}
            items={thumbnailJob.items}
            fields={thumbnailJob.coneFields}
            models={models}
            onCapture={handleThumbnailCaptured}
          />
        )}
        {captureMount}
      </div>
    );
  }

  return (
    <div className="relative flex h-[100dvh] flex-col overscroll-none" {...plattegrondJson.dragProps}>
      {plattegrondJson.elements}
      <div className="flex shrink-0 items-center gap-2 border-b bg-card px-3 py-2">
        {guest ? (
          <Button type="button" variant="ghost" size="sm" className="-ml-2" onClick={onGuestClose}>
            <X className="size-4" aria-hidden="true" /> Sluiten
          </Button>
        ) : (
          <BackButton fallbackHref={activiteitId ? `/activiteit/${activiteitId}` : "/dashboard"} fallbackLabel="Terug" className="-ml-2" />
        )}
        <Input
          value={floorplanName}
          onChange={(event) => {
            setFloorplanName(event.target.value);
            scheduleAutosave();
          }}
          className="h-9 max-w-56 border-none bg-transparent text-sm font-semibold shadow-none focus-visible:ring-1"
        />
        <span className="hidden text-xs text-muted-foreground sm:inline" aria-live="polite">
          {guest ? "Automatisch bewaard op dit apparaat" : saveStatusLabel[saveStatus]}
        </span>
        {adminInfo && <AdminBadge info={adminInfo} onRestored={() => window.location.reload()} />}
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
          <PlattegrondJsonMenu onAction={plattegrondJson.run} />
          {guest ? (
            <>
              <Button type="button" variant="outline" size="sm" onClick={startNewFloorplan} title="Begin opnieuw met een lege plattegrond">
                <FilePlus2 className="size-4" aria-hidden="true" />
                <span className="hidden md:inline">Nieuwe plattegrond</span>
              </Button>
              <GuestExportMenu onAction={(action) => void runGuestExport(action)} busy={guestBusy} />
            </>
          ) : (
            <>
              <Button type="button" variant="outline" size="sm" className="hidden sm:inline-flex" onClick={() => setMobilePanel("lijst")}>
                Mijn plattegronden
              </Button>
              <Button type="button" size="sm" onClick={() => void handleSaveNow()} disabled={saveStatus === "saving"}>
                {saveStatus === "saving" ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Opslaan
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside className="hidden w-64 shrink-0 overflow-y-auto border-r bg-card p-3 lg:block xl:w-72">
          <Button
            type="button"
            variant={drawMode ? "default" : "outline"}
            className="mb-3 w-full"
            aria-pressed={drawMode}
            onClick={() => (drawMode ? stopDrawing() : startDrawing())}
          >
            <Cone className="size-4" /> Veld afzetten
          </Button>
          <MaterialModelPicker3D models={models} syncFavorites={!guest} onSelect={handleAddModel} />
        </aside>

        <div className="relative min-w-0 flex-1">
          {scene}
          {guest && upsellVisible && <GuestUpsellBanner onDismiss={() => setUpsellVisible(false)} />}

          {drawChip}

        </div>

        <aside ref={sidePanelRef} className="hidden w-72 shrink-0 overflow-y-auto border-l bg-card p-3 lg:block xl:w-80">
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
      {captureMount}

      <Sheet open={activePanel !== null} onOpenChange={(open) => !open && setMobilePanel(null)}>
        <SheetContent side="bottom" className="h-[70vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {activePanel === "materiaal" && "Materiaal"}
              {activePanel === "item" && "Item"}
              {activePanel === "rotatie" && "Rotatie"}
              {activePanel === "kamer" && "Omgeving"}
              {activePanel === "lijst" && "Mijn 3D-plattegronden"}
            </SheetTitle>
          </SheetHeader>
          <div className={cn("px-4 pb-6")}>
            {activePanel === "materiaal" && <MaterialModelPicker3D models={models} syncFavorites={!guest} onSelect={handleAddModel} surfaceClassName="bg-background" />}
            {activePanel === "item" && itemPanel}
            {activePanel === "rotatie" && rotationPanel}
            {activePanel === "kamer" && roomPanel}
            {activePanel === "lijst" && (
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
