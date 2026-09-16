"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  useSyncExternalStore,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type Konva from "konva";
import {
  Arrow,
  Circle,
  Group,
  Layer,
  Line,
  Rect,
  Stage,
  Transformer,
} from "react-konva";
import {
  ArrowLeftRight,
  ArrowRight,
  Bold,
  BringToFront,
  Copy,
  Eraser,
  Italic,
  Minus,
  MoreHorizontal,
  Move,
  Plus,
  RotateCcw,
  RotateCw,
  SendToBack,
  Trash2,
  Type,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { createClient } from "@/utils/supabase/client";
import { incrementMaterialUsage } from "@/lib/services/materials";
import type { Material } from "@/types/material";
import { ElementIcon, SystemElementPreviewIcon } from "./element-icons";
import { MaterialPicker } from "./MaterialPicker";
import {
  CATEGORY_LABELS,
  ELEMENT_CATEGORIES,
  ELEMENT_DEFS,
  LEGACY_LINE_TYPES,
  LINE_VARIANT_LABELS,
  type DiagramData,
  type DiagramElement,
  type ElementType,
  type LineDiagramElement,
  type LineVariant,
  type TextDiagramElement,
  type TextFontStyle,
  type ViewMode,
} from "./gym-canvas-types";

const BASE_WIDTH = 800;
const BASE_HEIGHT = 560;
const MAX_HISTORY = 30;
const THUMB_BOX = 40;
// Vaste weergavegrootte voor materiaal-elementen — de echte foto-
// beeldverhouding wordt daarbinnen "contain"-gefit (zie MaterialElementIcon
// in element-icons.tsx), dus dit is puur de sleep-/selectiebox op canvas.
const MATERIAL_DEFAULT_SIZE = 48;

// Lijnen/pijlen: vaste pijlpuntgrootte (pointerLength/pointerWidth) — deze
// getallen leven NIET binnen een geschaalde Group, dus blijven constant
// ongeacht de lijnlengte (zie LineDiagramElement in gym-canvas-types.ts).
const DEFAULT_LINE_LENGTH = 120;
const DEFAULT_LINE_STROKE = "#1c7ed6";
const DEFAULT_LINE_STROKE_WIDTH = 3;
const LINE_POINTER_LENGTH = 14;
const LINE_POINTER_WIDTH = 12;

const DEFAULT_TEXT_FONT_SIZE = 22;
const DEFAULT_TEXT_COLOR = "#1b1d21";

// Pan/zoom — los van `scale` (de "pas-in-container-breedte"-factor
// hieronder), zie effectiveScale verderop. MIN/MAX in "keer scale", dus
// zoom=1 betekent altijd "de responsive fit-breedte", niet "100% van
// BASE_WIDTH".
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;
const ZOOM_BUTTON_STEP = 1.25;
const WHEEL_ZOOM_STEP = 1.06;

// Zwevende-controls-afmetingen (canvas-container-relatieve pixels, niet
// canvas-eenheden) — gebruikt om de actiebalk/rotate-move-knoppen boven of
// onder de selectie te positioneren.
const FLOATING_TOOLBAR_HEIGHT = 44;
const FLOATING_GAP = 10;
const HANDLE_SIZE = 44;

function toFontStyle(bold: boolean, italic: boolean): TextFontStyle {
  if (bold && italic) return "bold italic";
  if (bold) return "bold";
  if (italic) return "italic";
  return "normal";
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export type GymCanvasHandle = {
  exportDiagram: () => { data: DiagramData; imageDataUrl: string };
};

function createId() {
  return `el-${Math.random().toString(36).slice(2, 10)}`;
}

function subscribeToDesktopQuery(callback: () => void) {
  const mql = window.matchMedia("(min-width: 640px)");
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}
function getIsDesktopSnapshot() {
  return window.matchMedia("(min-width: 640px)").matches;
}
function getIsDesktopServerSnapshot() {
  return false;
}
function useIsDesktop() {
  return useSyncExternalStore(
    subscribeToDesktopQuery,
    getIsDesktopSnapshot,
    getIsDesktopServerSnapshot,
  );
}

// Los van useIsDesktop hierboven (dat is schermbreedte, voor de
// materiaal-Sheet die als drawer vs. zijpaneel opent) — dit is het echte
// "vinger vs. muis"-signaal uit de brief, gebruikt om de losse rotate/move-
// knoppen en de grotere handle-maten alleen op aanraakschermen te tonen. Een
// breed touchscreen (bijv. tablet in landscape) hoort nog steeds de
// touch-controls te krijgen, ook al zou useIsDesktop daar "desktop" zeggen.
function subscribeToCoarsePointerQuery(callback: () => void) {
  const mql = window.matchMedia("(pointer: coarse)");
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}
function getIsCoarsePointerSnapshot() {
  return window.matchMedia("(pointer: coarse)").matches;
}
function getIsCoarsePointerServerSnapshot() {
  return false;
}
function useIsCoarsePointer() {
  return useSyncExternalStore(
    subscribeToCoarsePointerQuery,
    getIsCoarsePointerSnapshot,
    getIsCoarsePointerServerSnapshot,
  );
}

function GymBackground({ viewMode }: { viewMode: ViewMode }) {
  if (viewMode === "side") {
    const floorY = BASE_HEIGHT - 90;
    const rungCount = 8;
    const rackX = BASE_WIDTH - 40;

    return (
      <>
        <Rect x={0} y={0} width={BASE_WIDTH} height={floorY} fill="#eef2f6" listening={false} />
        <Rect x={0} y={floorY} width={BASE_WIDTH} height={BASE_HEIGHT - floorY} fill="#e4dcc8" listening={false} />
        <Line points={[0, floorY, BASE_WIDTH, floorY]} stroke="#adb5bd" strokeWidth={3} listening={false} />
        <Rect x={rackX} y={40} width={14} height={floorY - 60} fill="#c99a52" stroke="rgba(0,0,0,0.15)" strokeWidth={1} listening={false} />
        {Array.from({ length: rungCount }, (_, i) => {
          const ry = 50 + i * ((floorY - 80) / (rungCount - 1));
          return (
            <Line
              key={i}
              points={[rackX, ry, rackX - 14, ry]}
              stroke="#8b5e34"
              strokeWidth={2}
              listening={false}
            />
          );
        })}
      </>
    );
  }

  const gridLines = [];
  const step = 40;

  for (let x = step; x < BASE_WIDTH; x += step) {
    gridLines.push(
      <Line key={`v-${x}`} points={[x, 0, x, BASE_HEIGHT]} stroke="#e5e5e5" strokeWidth={1} listening={false} />,
    );
  }
  for (let y = step; y < BASE_HEIGHT; y += step) {
    gridLines.push(
      <Line key={`h-${y}`} points={[0, y, BASE_WIDTH, y]} stroke="#e5e5e5" strokeWidth={1} listening={false} />,
    );
  }

  return (
    <>
      <Rect x={0} y={0} width={BASE_WIDTH} height={BASE_HEIGHT} fill="#fafaf9" listening={false} />
      {gridLines}
      <Rect x={30} y={30} width={BASE_WIDTH - 60} height={BASE_HEIGHT - 60} stroke="#d4d4d4" strokeWidth={2} listening={false} />
      <Circle x={BASE_WIDTH / 2} y={BASE_HEIGHT / 2} radius={50} stroke="#d4d4d4" strokeWidth={2} listening={false} />
      <Line points={[BASE_WIDTH / 2, 30, BASE_WIDTH / 2, BASE_HEIGHT - 30]} stroke="#d4d4d4" strokeWidth={2} listening={false} />
    </>
  );
}

function SystemElementThumbnail({ type }: { type: ElementType }) {
  const def = ELEMENT_DEFS[type];
  const scale = Math.min(1.4, (THUMB_BOX - 8) / Math.max(def.width, def.height));

  return (
    <Stage width={THUMB_BOX} height={THUMB_BOX} listening={false}>
      <Layer listening={false}>
        <Group x={THUMB_BOX / 2} y={THUMB_BOX / 2} scaleX={scale} scaleY={scale}>
          <SystemElementPreviewIcon type={type} viewMode="top" />
        </Group>
      </Layer>
    </Stage>
  );
}

function SystemElementPickerButton({
  type,
  onSelect,
}: {
  type: ElementType;
  onSelect: (type: ElementType) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(type)}
      className="flex min-h-24 min-w-0 flex-col items-center justify-center gap-1.5 rounded-lg border bg-background p-2 text-center transition-colors duration-150 ease-brand hover:bg-accent active:scale-95"
    >
      <SystemElementThumbnail type={type} />
      <span className="w-full leading-tight font-medium text-[11px] break-words">
        {ELEMENT_DEFS[type].label}
      </span>
    </button>
  );
}

const LINE_VARIANT_ICONS: Record<LineVariant, typeof Minus> = {
  line: Minus,
  arrow: ArrowRight,
  double_arrow: ArrowLeftRight,
};

function LineVariantPickerButton({
  variant,
  onSelect,
}: {
  variant: LineVariant;
  onSelect: (variant: LineVariant) => void;
}) {
  const Icon = LINE_VARIANT_ICONS[variant];
  return (
    <button
      type="button"
      onClick={() => onSelect(variant)}
      className="flex min-h-24 min-w-0 flex-col items-center justify-center gap-1.5 rounded-lg border bg-background p-2 text-center transition-colors duration-150 ease-brand hover:bg-accent active:scale-95"
    >
      <div className="flex size-10 items-center justify-center rounded-md bg-muted text-foreground">
        <Icon className="size-5" aria-hidden="true" />
      </div>
      <span className="w-full leading-tight font-medium text-[11px] break-words">
        {LINE_VARIANT_LABELS[variant]}
      </span>
    </button>
  );
}

/**
 * Lijn/pijl-element: rendert buiten het gedeelde Group+Transformer-systeem
 * om (zie de typecommentaar bij LineDiagramElement) — de hele lijn is zelf
 * draggable (verplaatsen), en bij selectie verschijnen twee losse,
 * draggable eindpunt-handles waarmee de lengte verandert door `points` zelf
 * bij te werken, in plaats van via een schalende resize-handle. Zo blijven
 * strokeWidth en de Arrow-pijlpunt (pointerLength/pointerWidth) altijd
 * constant, ongeacht de lijnlengte. `handleRadius` groter op coarse-pointer-
 * apparaten (zie useIsCoarsePointer) — een 14px-hit-target (de oorspronkelijke
 * radius=7) is te klein om precies met een vinger te raken.
 */
function LineElementNode({
  element,
  selected,
  handleRadius,
  onSelect,
  onInteractionStart,
  onInteractionEnd,
  onWholeMove,
  onPointMove,
  registerHandle,
}: {
  element: LineDiagramElement;
  selected: boolean;
  handleRadius: number;
  onSelect: () => void;
  onInteractionStart: () => void;
  onInteractionEnd: () => void;
  onWholeMove: (points: [number, number, number, number]) => void;
  onPointMove: (index: 0 | 1, x: number, y: number) => void;
  registerHandle: (key: string, node: Konva.Circle | null) => void;
}) {
  const [x1, y1, x2, y2] = element.points;
  const shapeProps = {
    points: element.points,
    stroke: element.stroke,
    strokeWidth: element.strokeWidth,
    hitStrokeWidth: Math.max(20, element.strokeWidth + 14),
    lineCap: "round" as const,
  };

  return (
    <Group
      draggable
      onClick={onSelect}
      onTap={onSelect}
      onDragStart={onInteractionStart}
      onDragEnd={(e) => {
        const node = e.target;
        const dx = node.x();
        const dy = node.y();
        node.position({ x: 0, y: 0 });
        onWholeMove([x1 + dx, y1 + dy, x2 + dx, y2 + dy]);
        onInteractionEnd();
      }}
    >
      {element.variant === "line" ? (
        <Line {...shapeProps} />
      ) : (
        <Arrow
          {...shapeProps}
          fill={element.stroke}
          pointerLength={LINE_POINTER_LENGTH}
          pointerWidth={LINE_POINTER_WIDTH}
          pointerAtBeginning={element.variant === "double_arrow"}
          pointerAtEnding
        />
      )}
      {selected && (
        <>
          <Circle
            ref={(node) => registerHandle(`${element.id}-0`, node)}
            x={x1}
            y={y1}
            radius={handleRadius}
            fill="#ffffff"
            stroke={element.stroke}
            strokeWidth={2}
            draggable
            onDragStart={onInteractionStart}
            onDragMove={(e) => onPointMove(0, e.target.x(), e.target.y())}
            onDragEnd={onInteractionEnd}
          />
          <Circle
            ref={(node) => registerHandle(`${element.id}-1`, node)}
            x={x2}
            y={y2}
            radius={handleRadius}
            fill="#ffffff"
            stroke={element.stroke}
            strokeWidth={2}
            draggable
            onDragStart={onInteractionStart}
            onDragMove={(e) => onPointMove(1, e.target.x(), e.target.y())}
            onDragEnd={onInteractionEnd}
          />
        </>
      )}
    </Group>
  );
}

/**
 * Axis-aligned selectiebox in canvas-eenheden (BASE_WIDTH/BASE_HEIGHT-
 * ruimte), per elementsoort — negeert rotatie bewust (net als de meeste
 * ontwerptools de zwevende actiebalk gewoon op de niet-geroteerde
 * begrenzing laten meebewegen i.p.v. een exacte, geroteerde omtrek te
 * berekenen). Gebruikt om de zwevende actiebalk en de rotate/move-knoppen
 * te positioneren — een kleine benadering hier is visueel niet merkbaar.
 */
function getElementBounds(element: DiagramElement): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  if (element.kind === "line") {
    const [x1, y1, x2, y2] = element.points;
    return {
      x: Math.min(x1, x2),
      y: Math.min(y1, y2),
      width: Math.max(Math.abs(x2 - x1), 4),
      height: Math.max(Math.abs(y2 - y1), 4),
    };
  }

  if (element.kind === "text") {
    const width = Math.max(100, element.fontSize * 7) * element.scaleX;
    const height = element.fontSize * 1.4 * element.scaleY;
    return { x: element.x, y: element.y, width, height };
  }

  if (element.kind === "material") {
    const width = element.width * element.scaleX;
    const height = element.height * element.scaleY;
    return { x: element.x - width / 2, y: element.y - height / 2, width, height };
  }

  const def = ELEMENT_DEFS[element.type];
  const width = def.width * element.scaleX;
  const height = def.height * element.scaleY;
  return { x: element.x - width / 2, y: element.y - height / 2, width, height };
}

export const GymCanvas = forwardRef<
  GymCanvasHandle,
  { initialData?: DiagramData | null }
>(function GymCanvas({ initialData }, ref) {
  const [elements, setElements] = useState<DiagramElement[]>(
    initialData?.elements ?? [],
  );
  const [history, setHistory] = useState<DiagramElement[][]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>(
    initialData?.viewMode ?? "top",
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [stageWidth, setStageWidth] = useState(BASE_WIDTH);
  // Pan/zoom-viewport — los van `scale` hieronder (de "pas in
  // containerbreedte"-fit-factor). `zoom` is de extra, door de gebruiker
  // bediende in-/uitzoomfactor (pinch, wieltje, +/- knoppen); `stagePos` is
  // de bijbehorende pan-verschuiving in canvas-containerpixels.
  const [zoom, setZoom] = useState(1);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  // Uit tijdens een actief 2-vinger-pinchgebaar — anders vecht Konva's eigen
  // 1-vinger-sleep-pan (Stage `draggable`) met de pinch-zoom-berekening
  // hieronder, allebei op de eerste vinger. `draggable` staat hier bewust
  // als losse state (i.p.v. imperatief `stage.draggable(false)`) omdat elke
  // zoom/pan-herrender via React anders de imperatieve waarde weer zou
  // overschrijven met de altijd-`true` JSX-prop.
  const [stageDraggable, setStageDraggable] = useState(true);
  // True tijdens een actief sleep-/roteer-/schaalgebaar (native Konva-drag,
  // Transformer, of de losse rotate/move-knoppen hieronder) — de zwevende
  // actiebalk en rotate/move-knoppen verbergen zich dan (net als in Canva),
  // en verschijnen weer zodra het gebaar stopt, op de nieuwe positie.
  const [isInteracting, setIsInteracting] = useState(false);
  // Welk tekstvak op dit moment via de <textarea>-overlay bewerkt wordt —
  // zie de rendering verderop. De onderliggende Konva-Text blijft altijd
  // zichtbaar en live-gesynchroniseerd (setTextLive), dus een export tijdens
  // het bewerken toont altijd de laatst getypte tekst.
  const [editingTextId, setEditingTextId] = useState<string | null>(null);

  const isDesktop = useIsDesktop();
  const isCoarsePointer = useIsCoarsePointer();
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const nodeRefs = useRef<Map<string, Konva.Node>>(new Map());
  // Eindpunt-handles van lijn/pijl-elementen — apart van nodeRefs omdat ze
  // geen Transformer-doelwit zijn, maar wél expliciet verborgen moeten
  // worden vóór het exporteren (zie exportDiagram hieronder), net als de
  // Transformer zelf.
  const lineHandleRefs = useRef<Map<string, Konva.Circle>>(new Map());
  // Pinch-to-zoom-gebaar-status — bewaart de vorige frame-afstand/middelpunt
  // tussen de twee vingers, zodat elke touchmove alleen het VERSCHIL sinds
  // de vorige frame hoeft te verwerken. null = geen 2-vinger-gebaar bezig.
  const lastPinchRef = useRef<{ distance: number; x: number; y: number } | null>(null);

  useEffect(() => {
    function updateSize() {
      const container = containerRef.current;
      if (!container) return;
      setStageWidth(Math.max(240, Math.min(container.clientWidth, BASE_WIDTH)));
    }

    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  useEffect(() => {
    const transformer = transformerRef.current;
    if (!transformer) return;

    // Lijn/pijl-elementen hebben geen Transformer-doelwit — die tekenen hun
    // eigen eindpunt-handles (zie LineElementNode), een schalende
    // Transformer-box zou daar juist de bug herintroduceren die dit moest
    // oplossen (uitgerekte lijndikte/pijlpunt).
    const selectedElement = elements.find((el) => el.id === selectedId);
    if (!selectedId || !selectedElement || selectedElement.kind === "line") {
      transformer.nodes([]);
      transformer.getLayer()?.batchDraw();
      return;
    }

    const node = nodeRefs.current.get(selectedId);
    if (node) {
      transformer.nodes([node]);
      transformer.getLayer()?.batchDraw();
    }
  }, [selectedId, elements]);

  // De "meer opties"-popover hoort bij één specifiek geselecteerd element —
  // sluit 'm zodra de selectie wisselt, anders blijft hij zichtbaar boven
  // een ander (of geen) element. Aangepast tijdens het renderen zelf
  // (React's aanbevolen patroon voor "state aanpassen in reactie op een
  // prop/state-wijziging") i.p.v. in een effect, want een effect mag geen
  // setState synchroon aanroepen (react-hooks/set-state-in-effect).
  const [lastSelectedIdForMenu, setLastSelectedIdForMenu] = useState(selectedId);
  if (selectedId !== lastSelectedIdForMenu) {
    setLastSelectedIdForMenu(selectedId);
    setMoreMenuOpen(false);
  }

  // Backspace/Delete verwijdert het geselecteerde element — zelfde actie als
  // de "Verwijderen"-knop. Genegeerd terwijl een tekstveld elders op de
  // pagina focus heeft (bijv. Titel/Doelstelling), anders zou backspace
  // tijdens het typen daar per ongeluk het canvas-element weggooien.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Backspace" && event.key !== "Delete") return;
      if (!selectedId) return;

      const target = event.target as HTMLElement | null;
      const isEditableTarget =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;
      if (isEditableTarget) return;

      event.preventDefault();
      removeSelected();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- removeSelected is a plain (non-memoized) function that only closes over selectedId, already the sole dep; listing it too would just reattach the listener every render.
  }, [selectedId]);

  useImperativeHandle(ref, () => ({
    exportDiagram: () => {
      transformerRef.current?.nodes([]);
      transformerRef.current?.getLayer()?.batchDraw();
      // Lijn-eindpunt-handles zijn gewone React-gerenderde Circles (geen
      // Transformer-nodes), dus `setSelectedId(null)` alleen verbergt ze
      // niet op tijd voor deze synchrone toDataURL-aanroep (React rendert
      // pas ná deze functie) — daarom hier ook expliciet, imperatief.
      lineHandleRefs.current.forEach((circle) => circle.visible(false));
      stageRef.current?.batchDraw();
      setSelectedId(null);

      const stage = stageRef.current;
      // Export altijd op de "pas in containerbreedte"-schaal, ongeacht de
      // huidige pan/zoom-viewport-stand — anders zou heen-en-weer inzoomen
      // vóór het opslaan de geëxporteerde plattegrond-afbeelding beïnvloeden.
      const currentScale = scale;
      const imageDataUrl = stage
        ? stage.toDataURL({
            mimeType: "image/png",
            pixelRatio: 1 / currentScale,
            x: 0,
            y: 0,
            width: BASE_WIDTH * scale,
            height: BASE_HEIGHT * scale,
          })
        : "";

      return {
        data: { width: BASE_WIDTH, height: BASE_HEIGHT, viewMode, elements },
        imageDataUrl,
      };
    },
  }));

  function withHistory(mutator: (prev: DiagramElement[]) => DiagramElement[]) {
    setHistory((prev) => [...prev.slice(-(MAX_HISTORY - 1)), elements]);
    setElements(mutator);
  }

  // Stagger stacked adds by a deterministic offset (derived from the
  // current count) instead of Math.random(), which the React Compiler's
  // purity check flags even though this only ever runs from a click.
  function staggeredCenter() {
    const step = elements.length % 6;
    return {
      x: BASE_WIDTH / 2 + (step - 2.5) * 24,
      y: BASE_HEIGHT / 2 + (step - 2.5) * 18,
    };
  }

  function addElement(type: ElementType) {
    const { x, y } = staggeredCenter();
    const newElement: DiagramElement = {
      id: createId(),
      kind: "system",
      type,
      x,
      y,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
    };
    withHistory((prev) => [...prev, newElement]);
    setSelectedId(newElement.id);
  }

  function addMaterialElement(material: Material) {
    const { x, y } = staggeredCenter();
    const newElement: DiagramElement = {
      id: createId(),
      kind: "material",
      materialId: material.id,
      name: material.name,
      imageUrl: material.image_url,
      width: MATERIAL_DEFAULT_SIZE,
      height: MATERIAL_DEFAULT_SIZE,
      x,
      y,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
    };
    withHistory((prev) => [...prev, newElement]);
    setSelectedId(newElement.id);
    void incrementMaterialUsage(createClient(), material.id);
  }

  // Eén geschiedenis-snapshot bij het BEGIN van een doorlopend sleepgebaar
  // (lijn-eindpunt, tekstbewerking, of de losse rotate/move-knoppen
  // hieronder) — de tussentijdse updates lopen daarna via setElements (geen
  // history), zodat undo dat hele gebaar als één stap terugdraait i.p.v. één
  // stap per pixel/toetsaanslag.
  function beginElementEdit() {
    setHistory((prev) => [...prev.slice(-(MAX_HISTORY - 1)), elements]);
  }

  function startInteraction() {
    setIsInteracting(true);
    beginElementEdit();
  }

  function endInteraction() {
    setIsInteracting(false);
  }

  function setLinePointsLive(id: string, points: [number, number, number, number]) {
    setElements((prev) =>
      prev.map((el) => (el.id === id && el.kind === "line" ? { ...el, points } : el)),
    );
  }

  function updateLineStyle(
    id: string,
    changes: Partial<Pick<LineDiagramElement, "stroke" | "strokeWidth">>,
  ) {
    withHistory((prev) =>
      prev.map((el) => (el.id === id && el.kind === "line" ? { ...el, ...changes } : el)),
    );
  }

  function addLineElement(variant: LineVariant) {
    const { x, y } = staggeredCenter();
    const half = DEFAULT_LINE_LENGTH / 2;
    const newElement: DiagramElement = {
      id: createId(),
      kind: "line",
      variant,
      points: [x - half, y, x + half, y],
      stroke: DEFAULT_LINE_STROKE,
      strokeWidth: DEFAULT_LINE_STROKE_WIDTH,
    };
    withHistory((prev) => [...prev, newElement]);
    setSelectedId(newElement.id);
  }

  function setTextLive(id: string, text: string) {
    setElements((prev) =>
      prev.map((el) => (el.id === id && el.kind === "text" ? { ...el, text } : el)),
    );
  }

  function updateTextStyle(
    id: string,
    changes: Partial<Pick<TextDiagramElement, "fontSize" | "fill" | "fontStyle">>,
  ) {
    withHistory((prev) =>
      prev.map((el) => (el.id === id && el.kind === "text" ? { ...el, ...changes } : el)),
    );
  }

  function addTextElement() {
    const { x, y } = staggeredCenter();
    const newElement: DiagramElement = {
      id: createId(),
      kind: "text",
      x: x - 40,
      y: y - DEFAULT_TEXT_FONT_SIZE / 2,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      // Leeg, direct bewerkbaar tekstvak — de <textarea>-overlay opent
      // meteen (zie setEditingTextId hieronder), geen placeholdertekst die
      // de gebruiker eerst zou moeten wegtikken.
      text: "",
      fontSize: DEFAULT_TEXT_FONT_SIZE,
      fill: DEFAULT_TEXT_COLOR,
      fontStyle: "normal",
    };
    withHistory((prev) => [...prev, newElement]);
    setSelectedId(newElement.id);
    setEditingTextId(newElement.id);
  }

  // Bij een NIEUW tekstvak heeft addTextElement hierboven de geschiedenis al
  // gesnapshot (via withHistory); bij het heropenen van een bestaand
  // tekstvak (dubbelklik) moet dat hier alsnog, zodat undo ook een bewerking
  // van al bestaande tekst als één stap terugdraait.
  function startTextEdit(id: string) {
    beginElementEdit();
    setSelectedId(id);
    setEditingTextId(id);
  }

  function finishTextEdit() {
    const id = editingTextId;
    if (!id) return;
    setEditingTextId(null);
    // Leeg gelaten (nooit getypt, of alles weer gewist) -> weer verwijderen
    // i.p.v. een onzichtbaar leeg tekstvak op het canvas achter te laten.
    const current = elements.find((el) => el.id === id);
    if (current && current.kind === "text" && current.text.trim().length === 0) {
      setElements((prev) => prev.filter((el) => el.id !== id));
      setSelectedId((selected) => (selected === id ? null : selected));
    }
  }

  function removeSelected() {
    if (!selectedId) return;
    withHistory((prev) => prev.filter((el) => el.id !== selectedId));
    setSelectedId(null);
  }

  // Kopieert het geselecteerde element, licht verschoven zodat de kopie
  // zichtbaar een apart element is i.p.v. exact overlappend met het
  // origineel — zelfde offset-idee als staggeredCenter hierboven.
  function duplicateSelected() {
    const original = elements.find((el) => el.id === selectedId);
    if (!original) return;

    const offset = 20;
    let clone: DiagramElement;
    if (original.kind === "line") {
      const [x1, y1, x2, y2] = original.points;
      clone = {
        ...original,
        id: createId(),
        points: [x1 + offset, y1 + offset, x2 + offset, y2 + offset] as [
          number,
          number,
          number,
          number,
        ],
      };
    } else {
      clone = { ...original, id: createId(), x: original.x + offset, y: original.y + offset };
    }

    withHistory((prev) => [...prev, clone]);
    setSelectedId(clone.id);
    setMoreMenuOpen(false);
  }

  // Laagvolgorde = volgorde in `elements` (later in de array = boven-op,
  // zie de render-loop verderop) — naar voren/achteren sturen verplaatst het
  // element dus simpelweg naar het eind/begin van diezelfde array.
  function bringSelectedToFront() {
    if (!selectedId) return;
    withHistory((prev) => {
      const index = prev.findIndex((el) => el.id === selectedId);
      if (index === -1 || index === prev.length - 1) return prev;
      const next = [...prev];
      const [item] = next.splice(index, 1);
      next.push(item);
      return next;
    });
    setMoreMenuOpen(false);
  }

  function sendSelectedToBack() {
    if (!selectedId) return;
    withHistory((prev) => {
      const index = prev.findIndex((el) => el.id === selectedId);
      if (index <= 0) return prev;
      const next = [...prev];
      const [item] = next.splice(index, 1);
      next.unshift(item);
      return next;
    });
    setMoreMenuOpen(false);
  }

  function clearCanvas() {
    if (elements.length === 0) return;
    withHistory(() => []);
    setSelectedId(null);
  }

  function undo() {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    setHistory((prev) => prev.slice(0, -1));
    setElements(previous);
    setSelectedId(null);
  }

  const scale = stageWidth / BASE_WIDTH;
  // De daadwerkelijke schaal waarop de Stage getekend wordt: de responsive
  // "pas in containerbreedte"-factor vermenigvuldigd met de door de
  // gebruiker gekozen zoomstand. Alle omrekeningen tussen canvas-eenheden en
  // scherm-/containerpixels (zwevende controls, tekst-overlay) gebruiken
  // deze ene waarde, zodat pan/zoom die nooit uit de pas laat lopen.
  const effectiveScale = scale * zoom;
  const selectedElement = elements.find((el) => el.id === selectedId) ?? null;
  const editingTextElement =
    editingTextId !== null
      ? ((elements.find((el) => el.id === editingTextId && el.kind === "text") as
          | TextDiagramElement
          | undefined) ?? null)
      : null;

  function zoomAround(nextZoom: number, pointer: { x: number; y: number }) {
    const clamped = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
    const oldEffective = effectiveScale;
    const newEffective = scale * clamped;
    // Houdt het canvaspunt onder `pointer` op dezelfde schermpositie tijdens
    // het zoomen (i.p.v. altijd rond de canvas-linkerbovenhoek), hetzelfde
    // idee als Konva's eigen "zoom relative to pointer"-voorbeeld.
    const canvasPoint = {
      x: (pointer.x - stagePos.x) / oldEffective,
      y: (pointer.y - stagePos.y) / oldEffective,
    };
    setZoom(clamped);
    setStagePos({
      x: pointer.x - canvasPoint.x * newEffective,
      y: pointer.y - canvasPoint.y * newEffective,
    });
  }

  function zoomByButton(factor: number) {
    // Rond het midden van de zichtbare canvas-viewport — de knoppen kennen
    // geen aanwijzerpositie zoals wiel-/pinch-zoomen dat wel hebben.
    zoomAround(zoom * factor, { x: (BASE_WIDTH * scale) / 2, y: (BASE_HEIGHT * scale) / 2 });
  }

  function handleWheel(e: Konva.KonvaEventObject<WheelEvent>) {
    e.evt.preventDefault();
    const stage = stageRef.current;
    const pointer = stage?.getPointerPosition();
    if (!pointer) return;
    const direction = e.evt.deltaY > 0 ? -1 : 1;
    const nextZoom = direction > 0 ? zoom * WHEEL_ZOOM_STEP : zoom / WHEEL_ZOOM_STEP;
    zoomAround(nextZoom, pointer);
  }

  function getTouchDistance(a: Touch, b: Touch) {
    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  }

  // Pinch-to-zoom: alleen actief bij precies 2 vingers, zodat 1-vinger-
  // slepen (pannen via Stage's eigen `draggable`, of een object verslepen)
  // hier niets mee te maken heeft. lastPinchRef bewaart alleen de vorige
  // frame — elke touchmove verwerkt dus het VERSCHIL sinds daarnet, niet
  // sinds de start van het hele gebaar.
  function handleStageTouchMove(e: Konva.KonvaEventObject<TouchEvent>) {
    const touches = e.evt.touches;
    if (touches.length !== 2) {
      lastPinchRef.current = null;
      setStageDraggable(true);
      return;
    }
    e.evt.preventDefault();

    const stage = stageRef.current;
    const container = stage?.container();
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const [t1, t2] = [touches[0], touches[1]];
    const distance = getTouchDistance(t1, t2);
    const center = {
      x: (t1.clientX + t2.clientX) / 2 - rect.left,
      y: (t1.clientY + t2.clientY) / 2 - rect.top,
    };

    const last = lastPinchRef.current;
    if (!last) {
      lastPinchRef.current = { distance, x: center.x, y: center.y };
      setStageDraggable(false);
      return;
    }

    const scaleBy = distance / last.distance;
    zoomAround(zoom * scaleBy, center);
    lastPinchRef.current = { distance, x: center.x, y: center.y };
  }

  function handleStageTouchEnd(e: Konva.KonvaEventObject<TouchEvent>) {
    if (e.evt.touches.length < 2) {
      lastPinchRef.current = null;
      setStageDraggable(true);
    }
  }

  // Rotate-knop (alleen coarse-pointer, zie useIsCoarsePointer): draait het
  // element met de vinger om zijn eigen middelpunt, losstaand van Konva's
  // eigen Transformer-rotatiehandle (die op mobiel uitstaat, zie
  // rotateEnabled hieronder) — vergelijkbaar met Canva's ronde draai-knop
  // onder de selectie i.p.v. een klein hoekhandvat.
  function startRotateGesture(event: ReactPointerEvent) {
    const element = selectedElement;
    if (!element || element.kind === "line") return;
    event.preventDefault();
    event.stopPropagation();

    const bounds = getElementBounds(element);
    // Middelpunt van het element, omgerekend van canvas-eenheden naar
    // absolute schermpixels — dezelfde stagePos/effectiveScale-omrekening
    // als overal elders, plus de container's eigen positie op de pagina
    // (event.clientX/Y zijn viewport-relatief, niet container-relatief).
    const containerRect = containerRef.current?.getBoundingClientRect();
    if (!containerRect) return;
    const centerScreenX =
      containerRect.left + stagePos.x + (bounds.x + bounds.width / 2) * effectiveScale;
    const centerScreenY =
      containerRect.top + stagePos.y + (bounds.y + bounds.height / 2) * effectiveScale;

    const startAngle = Math.atan2(event.clientY - centerScreenY, event.clientX - centerScreenX);
    const startRotation = element.rotation;
    const elementId = element.id;

    startInteraction();

    function onMove(moveEvent: PointerEvent) {
      const angle = Math.atan2(moveEvent.clientY - centerScreenY, moveEvent.clientX - centerScreenX);
      const deltaDeg = ((angle - startAngle) * 180) / Math.PI;
      setElements((prev) =>
        prev.map((item) =>
          item.id === elementId && item.kind !== "line"
            ? { ...item, rotation: startRotation + deltaDeg }
            : item,
        ),
      );
    }
    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      endInteraction();
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  // Move-knop (alleen coarse-pointer): expliciete, los aantikbare manier om
  // te verslepen — lost het bekende mobiele conflict op waarbij direct op
  // een klein object slepen soms als canvas-pan/scroll wordt geïnterpreteerd
  // in plaats van als object-verplaatsing.
  function startMoveGesture(event: ReactPointerEvent) {
    const element = selectedElement;
    if (!element || element.kind === "line") return;
    event.preventDefault();
    event.stopPropagation();

    const startClientX = event.clientX;
    const startClientY = event.clientY;
    const originX = element.x;
    const originY = element.y;
    const elementId = element.id;

    startInteraction();

    function onMove(moveEvent: PointerEvent) {
      const dx = (moveEvent.clientX - startClientX) / effectiveScale;
      const dy = (moveEvent.clientY - startClientY) / effectiveScale;
      setElements((prev) =>
        prev.map((item) =>
          item.id === elementId && item.kind !== "line"
            ? { ...item, x: originX + dx, y: originY + dy }
            : item,
        ),
      );
    }
    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      endInteraction();
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  // Zwevende-controls-positie (containerpixels, niet canvaseenheden) — recht
  // boven de selectie, of eronder wanneer erboven geen ruimte meer is (te
  // dicht bij de bovenrand van de canvas-container). Simplificatie: getoetst
  // aan de canvas-container zelf, niet aan het volledige browserviewport
  // (zie ook de code-commentaar bij getElementBounds hierboven).
  const selectedBounds = selectedElement ? getElementBounds(selectedElement) : null;
  const floatingControlsVisible =
    selectedBounds !== null && !isInteracting && editingTextId === null;
  let toolbarLeft = 0;
  let toolbarTop = 0;
  let toolbarBelow = false;
  let handlesTop = 0;
  if (selectedBounds) {
    const boxTop = stagePos.y + selectedBounds.y * effectiveScale;
    const boxBottom = stagePos.y + (selectedBounds.y + selectedBounds.height) * effectiveScale;
    const boxCenterX = stagePos.x + (selectedBounds.x + selectedBounds.width / 2) * effectiveScale;
    toolbarBelow = boxTop < FLOATING_TOOLBAR_HEIGHT + FLOATING_GAP;
    toolbarTop = toolbarBelow ? boxBottom + FLOATING_GAP : boxTop - FLOATING_TOOLBAR_HEIGHT - FLOATING_GAP;
    toolbarLeft = boxCenterX;
    handlesTop = boxBottom + FLOATING_GAP;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Sheet open={pickerOpen} onOpenChange={setPickerOpen}>
            <SheetTrigger asChild>
              <Button type="button">
                <Plus className="size-4" />
                Materiaal toevoegen
              </Button>
            </SheetTrigger>
            <SheetContent
              side={isDesktop ? "right" : "bottom"}
              className="flex flex-col overflow-y-auto sm:max-w-md"
            >
              <SheetHeader>
                <SheetTitle>Materiaal & spelers</SheetTitle>
              </SheetHeader>
              <div className="p-4 pt-0">
                <Tabs defaultValue="materiaal">
                  <TabsList className="h-auto w-full flex-wrap gap-1">
                    <TabsTrigger value="materiaal" className="min-h-9 flex-1 text-xs">
                      Materiaal
                    </TabsTrigger>
                    <TabsTrigger value="systeem" className="min-h-9 flex-1 text-xs">
                      Spelers & lijnen
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="materiaal" className="mt-3">
                    <MaterialPicker onSelect={addMaterialElement} />
                  </TabsContent>
                  <TabsContent value="systeem" className="mt-3 space-y-4">
                    {ELEMENT_CATEGORIES.map((category) => (
                      <div key={category}>
                        <p className="mb-2 text-sm font-semibold">
                          {CATEGORY_LABELS[category]}
                        </p>
                        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                          {category === "lijnen_pijlen" &&
                            (["line", "arrow", "double_arrow"] as LineVariant[]).map((variant) => (
                              <LineVariantPickerButton
                                key={variant}
                                variant={variant}
                                onSelect={(v) => {
                                  addLineElement(v);
                                  setPickerOpen(false);
                                }}
                              />
                            ))}
                          {/* looplijn/looprichting_pijl/balbaan_pijl bewust niet meer
                              aangeboden — vervangen door de echte vector-lijnen
                              hierboven (zie LEGACY_LINE_TYPES). aanvalszone blijft
                              staan: dat is een zone, geen lijn/pijl, en heeft niet
                              hetzelfde vervormingsprobleem. */}
                          {(Object.keys(ELEMENT_DEFS) as ElementType[])
                            .filter(
                              (type) =>
                                ELEMENT_DEFS[type].category === category &&
                                !LEGACY_LINE_TYPES.includes(type),
                            )
                            .map((type) => (
                              <SystemElementPickerButton
                                key={type}
                                type={type}
                                onSelect={addElement}
                              />
                            ))}
                        </div>
                      </div>
                    ))}
                  </TabsContent>
                </Tabs>
              </div>
            </SheetContent>
          </Sheet>

          <Button type="button" variant="outline" onClick={addTextElement}>
            <Type className="size-4" />
            Tekst toevoegen
          </Button>

          <div className="flex overflow-hidden rounded-md border">
            <button
              type="button"
              onClick={() => setViewMode("top")}
              className={cn(
                "min-h-9 px-3 py-2 text-xs font-medium transition-colors duration-150 ease-brand",
                viewMode === "top"
                  ? "bg-primary text-primary-foreground"
                  : "bg-background hover:bg-accent",
              )}
            >
              Bovenaanzicht
            </button>
            <button
              type="button"
              onClick={() => setViewMode("side")}
              className={cn(
                "min-h-9 border-l px-3 py-2 text-xs font-medium transition-colors duration-150 ease-brand",
                viewMode === "side"
                  ? "bg-primary text-primary-foreground"
                  : "bg-background hover:bg-accent",
              )}
            >
              Zijaanzicht
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={undo}
            disabled={history.length === 0}
          >
            <RotateCcw className="size-4" />
            Ongedaan maken
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={clearCanvas}
            disabled={elements.length === 0}
          >
            <Eraser className="size-4" />
            Canvas wissen
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={removeSelected}
            disabled={!selectedId}
          >
            <Trash2 className="size-4" />
            Verwijderen
          </Button>
        </div>
      </div>

      {/* Stijl-controls voor het geselecteerde lijn-/tekstelement — er
          bestond nog geen algemeen stijl-controlepatroon in deze editor
          (spelers/materiaal hebben een vaste vorm/foto), dus dit hergebruikt
          de gewone Button/Input-componenten van de rest van de app. */}
      {selectedElement && (selectedElement.kind === "line" || selectedElement.kind === "text") && (
        <div className="flex flex-wrap items-center gap-4 rounded-lg border bg-muted/40 p-2.5">
          {selectedElement.kind === "line" ? (
            <>
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                Kleur
                <input
                  type="color"
                  value={selectedElement.stroke}
                  onChange={(e) => updateLineStyle(selectedElement.id, { stroke: e.target.value })}
                  className="size-7 cursor-pointer rounded border p-0.5"
                  aria-label="Lijnkleur"
                />
              </label>
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                Dikte
                <Input
                  type="number"
                  min={1}
                  max={12}
                  value={selectedElement.strokeWidth}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    if (!Number.isNaN(value)) {
                      updateLineStyle(selectedElement.id, {
                        strokeWidth: Math.min(12, Math.max(1, value)),
                      });
                    }
                  }}
                  className="h-8 w-16 text-sm"
                />
              </label>
            </>
          ) : (
            <>
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                Kleur
                <input
                  type="color"
                  value={selectedElement.fill}
                  onChange={(e) => updateTextStyle(selectedElement.id, { fill: e.target.value })}
                  className="size-7 cursor-pointer rounded border p-0.5"
                  aria-label="Tekstkleur"
                />
              </label>
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                Grootte
                <Input
                  type="number"
                  min={8}
                  max={72}
                  value={selectedElement.fontSize}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    if (!Number.isNaN(value)) {
                      updateTextStyle(selectedElement.id, {
                        fontSize: Math.min(72, Math.max(8, value)),
                      });
                    }
                  }}
                  className="h-8 w-16 text-sm"
                />
              </label>
              <Button
                type="button"
                variant={selectedElement.fontStyle.includes("bold") ? "default" : "outline"}
                size="icon"
                className="size-8"
                aria-label="Vet"
                aria-pressed={selectedElement.fontStyle.includes("bold")}
                onClick={() =>
                  updateTextStyle(selectedElement.id, {
                    fontStyle: toFontStyle(
                      !selectedElement.fontStyle.includes("bold"),
                      selectedElement.fontStyle.includes("italic"),
                    ),
                  })
                }
              >
                <Bold className="size-4" />
              </Button>
              <Button
                type="button"
                variant={selectedElement.fontStyle.includes("italic") ? "default" : "outline"}
                size="icon"
                className="size-8"
                aria-label="Cursief"
                aria-pressed={selectedElement.fontStyle.includes("italic")}
                onClick={() =>
                  updateTextStyle(selectedElement.id, {
                    fontStyle: toFontStyle(
                      selectedElement.fontStyle.includes("bold"),
                      !selectedElement.fontStyle.includes("italic"),
                    ),
                  })
                }
              >
                <Italic className="size-4" />
              </Button>
            </>
          )}
        </div>
      )}

      <div ref={containerRef} className="w-full">
        {/* Buiten de overflow-hidden canvas-box hieronder (die is puur voor
            de Stage zelf) — de zwevende actiebalk/rotate-move-knoppen/
            zoomknoppen mogen desnoods net over de canvasrand heen steken
            zonder afgesneden te worden. */}
        <div className="relative">
          <div className="touch-none overflow-hidden rounded-lg border">
            <Stage
              ref={stageRef}
              width={BASE_WIDTH * scale}
              height={BASE_HEIGHT * scale}
              scaleX={effectiveScale}
              scaleY={effectiveScale}
              x={stagePos.x}
              y={stagePos.y}
              draggable={stageDraggable}
              onDragMove={(e) => {
                if (e.target !== e.target.getStage()) return;
                setStagePos({ x: e.target.x(), y: e.target.y() });
              }}
              onWheel={handleWheel}
              onTouchMove={handleStageTouchMove}
              onTouchEnd={handleStageTouchEnd}
              onMouseDown={(e) => {
                if (e.target === e.target.getStage()) setSelectedId(null);
              }}
              onTouchStart={(e) => {
                if (e.target === e.target.getStage()) setSelectedId(null);
              }}
            >
              <Layer>
                <GymBackground viewMode={viewMode} />
              </Layer>
              <Layer>
                {elements.map((el) => {
                  if (el.kind === "line") {
                    return (
                      <LineElementNode
                        key={el.id}
                        element={el}
                        selected={selectedId === el.id}
                        handleRadius={isCoarsePointer ? 16 : 7}
                        onSelect={() => setSelectedId(el.id)}
                        onInteractionStart={startInteraction}
                        onInteractionEnd={endInteraction}
                        onWholeMove={(points) => setLinePointsLive(el.id, points)}
                        onPointMove={(index, x, y) => {
                          const next: [number, number, number, number] = [
                            el.points[0],
                            el.points[1],
                            el.points[2],
                            el.points[3],
                          ];
                          if (index === 0) {
                            next[0] = x;
                            next[1] = y;
                          } else {
                            next[2] = x;
                            next[3] = y;
                          }
                          setLinePointsLive(el.id, next);
                        }}
                        registerHandle={(key, node) => {
                          if (node) lineHandleRefs.current.set(key, node);
                          else lineHandleRefs.current.delete(key);
                        }}
                      />
                    );
                  }

                  return (
                    <Group
                      key={el.id}
                      ref={(node) => {
                        if (node) nodeRefs.current.set(el.id, node);
                        else nodeRefs.current.delete(el.id);
                      }}
                      x={el.x}
                      y={el.y}
                      rotation={el.rotation}
                      scaleX={el.scaleX}
                      scaleY={el.scaleY}
                      draggable
                      onClick={() => setSelectedId(el.id)}
                      onTap={() => setSelectedId(el.id)}
                      onDblClick={() => {
                        if (el.kind === "text") startTextEdit(el.id);
                      }}
                      onDblTap={() => {
                        if (el.kind === "text") startTextEdit(el.id);
                      }}
                      onDragStart={startInteraction}
                      onDragMove={(e) => {
                        const node = e.target;
                        setElements((prev) =>
                          prev.map((item) =>
                            item.id === el.id && item.kind !== "line"
                              ? { ...item, x: node.x(), y: node.y() }
                              : item,
                          ),
                        );
                      }}
                      onDragEnd={(e) => {
                        setElements((prev) =>
                          prev.map((item) =>
                            item.id === el.id && item.kind !== "line"
                              ? { ...item, x: e.target.x(), y: e.target.y() }
                              : item,
                          ),
                        );
                        endInteraction();
                      }}
                      onTransformStart={startInteraction}
                      onTransformEnd={(e) => {
                        const node = e.target;
                        // Tekst schaalt naar een nieuwe fontSize i.p.v. de
                        // Group uit te rekken — anders wordt de tekst
                        // vervormd/wazig in plaats van scherp groter/kleiner
                        // (zie TextDiagramElement in gym-canvas-types.ts).
                        if (el.kind === "text") {
                          const newFontSize = Math.max(8, Math.round(el.fontSize * node.scaleY()));
                          node.scaleX(1);
                          node.scaleY(1);
                          setElements((prev) =>
                            prev.map((item) =>
                              item.id === el.id && item.kind === "text"
                                ? {
                                    ...item,
                                    x: node.x(),
                                    y: node.y(),
                                    rotation: node.rotation(),
                                    scaleX: 1,
                                    scaleY: 1,
                                    fontSize: newFontSize,
                                  }
                                : item,
                            ),
                          );
                          endInteraction();
                          return;
                        }
                        setElements((prev) =>
                          prev.map((item) =>
                            item.id === el.id && item.kind !== "line"
                              ? {
                                  ...item,
                                  x: node.x(),
                                  y: node.y(),
                                  rotation: node.rotation(),
                                  scaleX: node.scaleX(),
                                  scaleY: node.scaleY(),
                                }
                              : item,
                          ),
                        );
                        endInteraction();
                      }}
                    >
                      <ElementIcon element={el} viewMode={viewMode} />
                    </Group>
                  );
                })}
                <Transformer
                  ref={transformerRef}
                  rotateEnabled={!isCoarsePointer}
                  flipEnabled={false}
                  enabledAnchors={["top-left", "top-right", "bottom-left", "bottom-right"]}
                  anchorSize={isCoarsePointer ? 26 : 12}
                  anchorCornerRadius={999}
                  anchorFill="#ffffff"
                  anchorStroke="#7c3aed"
                  anchorStrokeWidth={2}
                  borderStroke="#7c3aed"
                  borderStrokeWidth={2}
                  boundBoxFunc={(oldBox, newBox) =>
                    newBox.width < 8 || newBox.height < 8 ? oldBox : newBox
                  }
                />
              </Layer>
            </Stage>
          </div>

          {editingTextElement && (
            <textarea
              ref={(node) => node?.focus()}
              value={editingTextElement.text}
              onChange={(e) => setTextLive(editingTextElement.id, e.target.value)}
              onBlur={finishTextEdit}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  (e.target as HTMLTextAreaElement).blur();
                }
              }}
              placeholder="Tekst..."
              className="absolute z-10 rounded border border-primary bg-white/90 p-1 text-black outline-none"
              style={{
                left: stagePos.x + editingTextElement.x * effectiveScale,
                top: stagePos.y + editingTextElement.y * effectiveScale,
                width: Math.max(100, editingTextElement.fontSize * 7) * effectiveScale,
                fontSize: editingTextElement.fontSize * editingTextElement.scaleY * effectiveScale,
                lineHeight: 1.2,
                color: editingTextElement.fill,
                fontWeight: editingTextElement.fontStyle.includes("bold") ? 700 : 400,
                fontStyle: editingTextElement.fontStyle.includes("italic") ? "italic" : "normal",
                transform: `rotate(${editingTextElement.rotation}deg)`,
                transformOrigin: "top left",
                resize: "none",
              }}
            />
          )}

          {/* Zwevende actiebalk — dupliceren/verwijderen/meer, net als
              Canva's mobiele objectbalk (zie screenshot in de brief). Op
              elke apparaatsoort zichtbaar (puur additief, geen bestaande
              muis-bediening verandert erdoor); verbergt zich tijdens een
              actief sleep-/roteer-/schaalgebaar (isInteracting) en
              verschijnt na afloop weer op de nieuwe positie i.p.v. continu
              live mee te bewegen — zie het commentaar bij isInteracting. */}
          {floatingControlsVisible && selectedElement && (
            <div
              className="absolute z-20 flex -translate-x-1/2 items-center gap-1 rounded-full border bg-card p-1 shadow-brand-lg"
              style={{ left: toolbarLeft, top: toolbarTop, height: FLOATING_TOOLBAR_HEIGHT }}
            >
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-9 rounded-full"
                aria-label="Dupliceren"
                onClick={duplicateSelected}
              >
                <Copy className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-9 rounded-full text-destructive hover:text-destructive"
                aria-label="Verwijderen"
                onClick={removeSelected}
              >
                <Trash2 className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-9 rounded-full"
                aria-label="Meer opties"
                aria-expanded={moreMenuOpen}
                onClick={() => setMoreMenuOpen((open) => !open)}
              >
                {moreMenuOpen ? <X className="size-4" /> : <MoreHorizontal className="size-4" />}
              </Button>

              {moreMenuOpen && (
                <div
                  className={cn(
                    "absolute left-1/2 z-30 flex w-44 -translate-x-1/2 flex-col gap-0.5 rounded-lg border bg-card p-1.5 shadow-brand-lg",
                    toolbarBelow ? "top-full mt-2" : "bottom-full mb-2",
                  )}
                >
                  <button
                    type="button"
                    onClick={bringSelectedToFront}
                    className="flex items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm font-medium transition-colors duration-150 ease-brand hover:bg-accent"
                  >
                    <BringToFront className="size-4" />
                    Naar voren
                  </button>
                  <button
                    type="button"
                    onClick={sendSelectedToBack}
                    className="flex items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm font-medium transition-colors duration-150 ease-brand hover:bg-accent"
                  >
                    <SendToBack className="size-4" />
                    Naar achteren
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Losse rotate/move-knoppen onder de selectie — alleen op
              aanraakschermen (useIsCoarsePointer): met een muis werken de
              Transformer's eigen rotatiehandle en direct slepen prima, en
              zou dit alleen maar in de weg zitten. Niet voor lijnen/pijlen:
              die roteren/verplaatsen al via hun eigen eindpunt-handles/
              lijn-slepen (zie LineElementNode) — losse rotate/move-knoppen
              zouden daar een tegenstrijdig tweede bedieningsmodel naast
              zetten. */}
          {floatingControlsVisible &&
            isCoarsePointer &&
            selectedElement &&
            selectedElement.kind !== "line" && (
              <>
                <button
                  type="button"
                  aria-label="Roteren"
                  onPointerDown={startRotateGesture}
                  className="absolute z-20 flex touch-none items-center justify-center rounded-full border bg-card text-foreground shadow-brand-md active:scale-95"
                  style={{
                    left: toolbarLeft - HANDLE_SIZE - 8,
                    top: handlesTop,
                    width: HANDLE_SIZE,
                    height: HANDLE_SIZE,
                  }}
                >
                  <RotateCw className="size-5" />
                </button>
                <button
                  type="button"
                  aria-label="Verplaatsen"
                  onPointerDown={startMoveGesture}
                  className="absolute z-20 flex touch-none items-center justify-center rounded-full border bg-card text-foreground shadow-brand-md active:scale-95"
                  style={{
                    left: toolbarLeft + 8,
                    top: handlesTop,
                    width: HANDLE_SIZE,
                    height: HANDLE_SIZE,
                  }}
                >
                  <Move className="size-5" />
                </button>
              </>
            )}

          {/* Zoomknoppen — altijd zichtbaar (niet afhankelijk van selectie),
              voor wie liever tikt dan knijpt. Pinch (touch) en het
              muiswieltje (desktop) werken los hiervan al via de
              Stage-handlers hierboven. */}
          <div className="absolute right-2 bottom-2 z-20 flex flex-col overflow-hidden rounded-lg border bg-card shadow-brand-md">
            <button
              type="button"
              aria-label="Inzoomen"
              onClick={() => zoomByButton(ZOOM_BUTTON_STEP)}
              disabled={zoom >= MAX_ZOOM}
              className="flex size-10 items-center justify-center border-b transition-colors duration-150 ease-brand hover:bg-accent disabled:pointer-events-none disabled:opacity-40"
            >
              <ZoomIn className="size-4" />
            </button>
            <button
              type="button"
              aria-label="Uitzoomen"
              onClick={() => zoomByButton(1 / ZOOM_BUTTON_STEP)}
              disabled={zoom <= MIN_ZOOM}
              className="flex size-10 items-center justify-center transition-colors duration-150 ease-brand hover:bg-accent disabled:pointer-events-none disabled:opacity-40"
            >
              <ZoomOut className="size-4" />
            </button>
          </div>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Klik op &quot;Materiaal toevoegen&quot; voor de categorieën, of
        &quot;Tekst toevoegen&quot; voor een tekstvak. Versleep, roteer of
        schaal via de handgrepen — bij lijnen/pijlen versleep je de twee
        eindpunten om de lengte aan te passen, en dubbelklik op een
        tekstvak om het te bewerken. Knijp of gebruik de +/- knoppen om in
        te zoomen, en sleep een leeg stuk canvas om te pannen. Gebruik
        &quot;Verwijderen&quot; voor het geselecteerde item.
      </p>
    </div>
  );
});
