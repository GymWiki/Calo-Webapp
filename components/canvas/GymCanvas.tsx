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
  Circle,
  Group,
  Layer,
  Line,
  Rect,
  Stage,
  Transformer,
} from "react-konva";
import { Eraser, Plus, RotateCcw, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { ElementIcon } from "./element-icons";
import {
  CATEGORY_LABELS,
  ELEMENT_CATEGORIES,
  ELEMENT_DEFS,
  type DiagramData,
  type DiagramElement,
  type ElementType,
  type ViewMode,
} from "./gym-canvas-types";

const BASE_WIDTH = 800;
const BASE_HEIGHT = 560;
const MAX_HISTORY = 30;
const THUMB_BOX = 40;

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

function ElementThumbnail({ type }: { type: ElementType }) {
  const def = ELEMENT_DEFS[type];
  const scale = Math.min(1.4, (THUMB_BOX - 8) / Math.max(def.width, def.height));

  return (
    <Stage width={THUMB_BOX} height={THUMB_BOX} listening={false}>
      <Layer listening={false}>
        <Group x={THUMB_BOX / 2} y={THUMB_BOX / 2} scaleX={scale} scaleY={scale}>
          <ElementIcon type={type} viewMode="top" />
        </Group>
      </Layer>
    </Stage>
  );
}

function ElementPickerButton({
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
      className="flex min-h-24 flex-col items-center justify-center gap-1.5 rounded-lg border bg-background p-2 text-center transition-colors duration-150 ease-brand hover:bg-accent active:scale-95"
    >
      <ElementThumbnail type={type} />
      <span className="text-[11px] leading-tight font-medium">
        {ELEMENT_DEFS[type].label}
      </span>
    </button>
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

  const isDesktop = useIsDesktop();
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const nodeRefs = useRef<Map<string, Konva.Node>>(new Map());

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

    if (!selectedId) {
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

  useImperativeHandle(ref, () => ({
    exportDiagram: () => {
      transformerRef.current?.nodes([]);
      transformerRef.current?.getLayer()?.batchDraw();
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

  function addElement(type: ElementType) {
    // Stagger stacked adds by a deterministic offset (derived from the
    // current count) instead of Math.random(), which the React Compiler's
    // purity check flags even though this only ever runs from a click.
    const step = elements.length % 6;
    const newElement: DiagramElement = {
      id: createId(),
      type,
      x: BASE_WIDTH / 2 + (step - 2.5) * 24,
      y: BASE_HEIGHT / 2 + (step - 2.5) * 18,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
    };
    withHistory((prev) => [...prev, newElement]);
    setSelectedId(newElement.id);
  }

  function updateElement(id: string, changes: Partial<DiagramElement>) {
    withHistory((prev) =>
      prev.map((el) => (el.id === id ? { ...el, ...changes } : el)),
    );
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
                <Tabs defaultValue={ELEMENT_CATEGORIES[0]}>
                  <TabsList className="h-auto w-full flex-wrap gap-1">
                    {ELEMENT_CATEGORIES.map((category) => (
                      <TabsTrigger
                        key={category}
                        value={category}
                        className="min-h-9 flex-1 text-xs"
                      >
                        {CATEGORY_LABELS[category]}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  {ELEMENT_CATEGORIES.map((category) => (
                    <TabsContent
                      key={category}
                      value={category}
                      className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4"
                    >
                      {(Object.keys(ELEMENT_DEFS) as ElementType[])
                        .filter((type) => ELEMENT_DEFS[type].category === category)
                        .map((type) => (
                          <ElementPickerButton
                            key={type}
                            type={type}
                            onSelect={addElement}
                          />
                        ))}
                    </TabsContent>
                  ))}
                </Tabs>
              </div>
            </SheetContent>
          </Sheet>

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

      <div ref={containerRef} className="w-full">
        <div className="inline-block touch-none overflow-hidden rounded-lg border">
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
              {elements.map((el) => (
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
                  onDragEnd={(e) =>
                    updateElement(el.id, { x: e.target.x(), y: e.target.y() })
                  }
                  onTransformEnd={(e) => {
                    const node = e.target;
                    updateElement(el.id, {
                      x: node.x(),
                      y: node.y(),
                      rotation: node.rotation(),
                      scaleX: node.scaleX(),
                      scaleY: node.scaleY(),
                    });
                  }}
                >
                  <ElementIcon type={el.type} viewMode={viewMode} />
                </Group>
              ))}
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
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Klik op &quot;Materiaal toevoegen&quot; voor de categorieën. Versleep,
        roteer of schaal via de handgrepen, en gebruik &quot;Verwijderen&quot;
        voor het geselecteerde item.
      </p>
    </div>
  );
});
