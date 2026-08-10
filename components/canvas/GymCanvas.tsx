"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type Konva from "konva";
import {
  Arrow,
  Circle,
  Group,
  Layer,
  Line,
  Rect,
  RegularPolygon,
  Stage,
  Transformer,
} from "react-konva";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  ELEMENT_CATEGORIES,
  ELEMENT_DEFS,
  type DiagramData,
  type DiagramElement,
  type ElementType,
} from "./gym-canvas-types";

const BASE_WIDTH = 800;
const BASE_HEIGHT = 560;

export type GymCanvasHandle = {
  exportDiagram: () => { data: DiagramData; imageDataUrl: string };
};

function createId() {
  return `el-${Math.random().toString(36).slice(2, 10)}`;
}

function GymBackground() {
  const gridLines = [];
  const step = 40;

  for (let x = step; x < BASE_WIDTH; x += step) {
    gridLines.push(
      <Line
        key={`v-${x}`}
        points={[x, 0, x, BASE_HEIGHT]}
        stroke="#e5e5e5"
        strokeWidth={1}
        listening={false}
      />,
    );
  }
  for (let y = step; y < BASE_HEIGHT; y += step) {
    gridLines.push(
      <Line
        key={`h-${y}`}
        points={[0, y, BASE_WIDTH, y]}
        stroke="#e5e5e5"
        strokeWidth={1}
        listening={false}
      />,
    );
  }

  return (
    <>
      <Rect
        x={0}
        y={0}
        width={BASE_WIDTH}
        height={BASE_HEIGHT}
        fill="#fafaf9"
        listening={false}
      />
      {gridLines}
      <Rect
        x={30}
        y={30}
        width={BASE_WIDTH - 60}
        height={BASE_HEIGHT - 60}
        stroke="#d4d4d4"
        strokeWidth={2}
        listening={false}
      />
      <Circle
        x={BASE_WIDTH / 2}
        y={BASE_HEIGHT / 2}
        radius={50}
        stroke="#d4d4d4"
        strokeWidth={2}
        listening={false}
      />
      <Line
        points={[BASE_WIDTH / 2, 30, BASE_WIDTH / 2, BASE_HEIGHT - 30]}
        stroke="#d4d4d4"
        strokeWidth={2}
        listening={false}
      />
    </>
  );
}

function ElementShape({ type }: { type: ElementType }) {
  const def = ELEMENT_DEFS[type];

  switch (def.shape) {
    case "rect":
      return (
        <Rect
          x={-def.width / 2}
          y={-def.height / 2}
          width={def.width}
          height={def.height}
          fill={def.fill}
          cornerRadius={4}
          stroke="rgba(0,0,0,0.15)"
          strokeWidth={1}
        />
      );
    case "circle":
      return (
        <Circle
          radius={def.width / 2}
          fill={def.fill}
          stroke="rgba(0,0,0,0.15)"
          strokeWidth={1}
        />
      );
    case "triangle":
      return (
        <RegularPolygon
          sides={3}
          radius={def.width / 2}
          fill={def.fill}
          stroke="rgba(0,0,0,0.15)"
          strokeWidth={1}
        />
      );
    case "arrow":
      return (
        <Arrow
          points={[-def.width / 2, 0, def.width / 2, 0]}
          stroke={def.fill}
          fill={def.fill}
          strokeWidth={4}
          pointerLength={10}
          pointerWidth={10}
        />
      );
    default:
      return null;
  }
}

export const GymCanvas = forwardRef<
  GymCanvasHandle,
  { initialData?: DiagramData | null }
>(function GymCanvas({ initialData }, ref) {
  const [elements, setElements] = useState<DiagramElement[]>(
    initialData?.elements ?? [],
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [stageWidth, setStageWidth] = useState(BASE_WIDTH);

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
        data: { width: BASE_WIDTH, height: BASE_HEIGHT, elements },
        imageDataUrl,
      };
    },
  }));

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
    setElements((prev) => [...prev, newElement]);
    setSelectedId(newElement.id);
  }

  function updateElement(id: string, changes: Partial<DiagramElement>) {
    setElements((prev) =>
      prev.map((el) => (el.id === id ? { ...el, ...changes } : el)),
    );
  }

  function removeSelected() {
    if (!selectedId) return;
    setElements((prev) => prev.filter((el) => el.id !== selectedId));
    setSelectedId(null);
  }

  const scale = stageWidth / BASE_WIDTH;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-1 flex-wrap gap-x-4 gap-y-2">
          {ELEMENT_CATEGORIES.map((category) => (
            <div key={category} className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                {category}:
              </span>
              {(Object.keys(ELEMENT_DEFS) as ElementType[])
                .filter((type) => ELEMENT_DEFS[type].category === category)
                .map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => addElement(type)}
                    className="rounded-md border bg-background px-2 py-1 text-xs font-medium hover:bg-accent"
                  >
                    {ELEMENT_DEFS[type].label}
                  </button>
                ))}
            </div>
          ))}
        </div>
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
              <GymBackground />
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
                  <ElementShape type={el.type} />
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
        Klik op een item om het toe te voegen. Versleep, roteer of schaal via
        de handgrepen, en gebruik &quot;Verwijderen&quot; voor het
        geselecteerde item.
      </p>
    </div>
  );
});
