"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  useSyncExternalStore,
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
  Eraser,
  Italic,
  Minus,
  Plus,
  RotateCcw,
  Trash2,
  Type,
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
  type ElementTransform,
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

function toFontStyle(bold: boolean, italic: boolean): TextFontStyle {
  if (bold && italic) return "bold italic";
  if (bold) return "bold";
  if (italic) return "italic";
  return "normal";
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
 * constant, ongeacht de lijnlengte.
 */
function LineElementNode({
  element,
  selected,
  onSelect,
  onDragStart,
  onWholeMove,
  onPointMove,
  registerHandle,
}: {
  element: LineDiagramElement;
  selected: boolean;
  onSelect: () => void;
  onDragStart: () => void;
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
      onDragStart={onDragStart}
      onDragEnd={(e) => {
        const node = e.target;
        const dx = node.x();
        const dy = node.y();
        node.position({ x: 0, y: 0 });
        onWholeMove([x1 + dx, y1 + dy, x2 + dx, y2 + dy]);
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
            radius={7}
            fill="#ffffff"
            stroke={element.stroke}
            strokeWidth={2}
            draggable
            onDragStart={onDragStart}
            onDragMove={(e) => onPointMove(0, e.target.x(), e.target.y())}
          />
          <Circle
            ref={(node) => registerHandle(`${element.id}-1`, node)}
            x={x2}
            y={y2}
            radius={7}
            fill="#ffffff"
            stroke={element.stroke}
            strokeWidth={2}
            draggable
            onDragStart={onDragStart}
            onDragMove={(e) => onPointMove(1, e.target.x(), e.target.y())}
          />
        </>
      )}
    </Group>
  );
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
  const [stageWidth, setStageWidth] = useState(BASE_WIDTH);
  // Welk tekstvak op dit moment via de <textarea>-overlay bewerkt wordt —
  // zie de rendering verderop. De onderliggende Konva-Text blijft altijd
  // zichtbaar en live-gesynchroniseerd (setTextLive), dus een export tijdens
  // het bewerken toont altijd de laatst getypte tekst.
  const [editingTextId, setEditingTextId] = useState<string | null>(null);

  const isDesktop = useIsDesktop();
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const nodeRefs = useRef<Map<string, Konva.Node>>(new Map());
  // Eindpunt-handles van lijn/pijl-elementen — apart van nodeRefs omdat ze
  // geen Transformer-doelwit zijn, maar wél expliciet verborgen moeten
  // worden vóór het exporteren (zie exportDiagram hieronder), net als de
  // Transformer zelf.
  const lineHandleRefs = useRef<Map<string, Konva.Circle>>(new Map());

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
      const currentScale = stage?.scaleX() || 1;
      const imageDataUrl = stage
        ? stage.toDataURL({
            mimeType: "image/png",
            pixelRatio: 1 / currentScale,
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

  function updateElement(id: string, changes: Partial<ElementTransform>) {
    withHistory((prev) =>
      prev.map((el) => (el.id === id ? { ...el, ...changes } : el)),
    );
  }

  // Eén geschiedenis-snapshot bij het BEGIN van een doorlopend sleepgebaar
  // (lijn-eindpunt of tekstbewerking) — de tussentijdse updates lopen
  // daarna via setElements (geen history), zodat undo dat hele gebaar als
  // één stap terugdraait i.p.v. één stap per pixel/toetsaanslag.
  function beginElementEdit() {
    setHistory((prev) => [...prev.slice(-(MAX_HISTORY - 1)), elements]);
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
  const selectedElement = elements.find((el) => el.id === selectedId) ?? null;
  const editingTextElement =
    editingTextId !== null
      ? ((elements.find((el) => el.id === editingTextId && el.kind === "text") as
          | TextDiagramElement
          | undefined) ?? null)
      : null;

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
        <div className="relative inline-block touch-none overflow-hidden rounded-lg border">
          <Stage
            ref={stageRef}
            width={BASE_WIDTH * scale}
            height={BASE_HEIGHT * scale}
            scaleX={scale}
            scaleY={scale}
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
                      onSelect={() => setSelectedId(el.id)}
                      onDragStart={beginElementEdit}
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
                    onDragEnd={(e) =>
                      updateElement(el.id, { x: e.target.x(), y: e.target.y() })
                    }
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
                        withHistory((prev) =>
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
                        return;
                      }
                      updateElement(el.id, {
                        x: node.x(),
                        y: node.y(),
                        rotation: node.rotation(),
                        scaleX: node.scaleX(),
                        scaleY: node.scaleY(),
                      });
                    }}
                  >
                    <ElementIcon element={el} viewMode={viewMode} />
                  </Group>
                );
              })}
              <Transformer
                ref={transformerRef}
                rotateEnabled
                flipEnabled={false}
                boundBoxFunc={(oldBox, newBox) =>
                  newBox.width < 8 || newBox.height < 8 ? oldBox : newBox
                }
              />
            </Layer>
          </Stage>

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
                left: editingTextElement.x * scale,
                top: editingTextElement.y * scale,
                width: Math.max(100, editingTextElement.fontSize * 7) * scale,
                fontSize: editingTextElement.fontSize * editingTextElement.scaleY * scale,
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
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Klik op &quot;Materiaal toevoegen&quot; voor de categorieën, of
        &quot;Tekst toevoegen&quot; voor een tekstvak. Versleep, roteer of
        schaal via de handgrepen — bij lijnen/pijlen versleep je de twee
        eindpunten om de lengte aan te passen, en dubbelklik op een
        tekstvak om het te bewerken. Gebruik &quot;Verwijderen&quot; voor
        het geselecteerde item.
      </p>
    </div>
  );
});
