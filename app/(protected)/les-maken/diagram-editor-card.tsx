"use client";

import { useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Check, MapPinned } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { GymCanvasHandle } from "@/components/canvas/GymCanvas";
import type { DiagramData } from "@/components/canvas/gym-canvas-types";

// Konva touches `window` at module load time, so it can never run during
// SSR — even inside an already-"use client" file.
const GymCanvas = dynamic(
  () => import("@/components/canvas/GymCanvas").then((mod) => mod.GymCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-64 items-center justify-center rounded-lg border text-sm text-muted-foreground">
        Canvas laden...
      </div>
    ),
  },
);

export function DiagramEditorCard({
  onExport,
}: {
  onExport: (data: DiagramData, imageDataUrl: string) => void;
}) {
  const canvasRef = useRef<GymCanvasHandle>(null);
  const [exported, setExported] = useState(false);

  function handleExport() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const { data, imageDataUrl } = canvas.exportDiagram();
    onExport(data, imageDataUrl);
    setExported(true);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tekening van het arrangement</CardTitle>
        <CardDescription>
          Bouw de opstelling van de gymzaal en exporteer &apos;m naar je
          lesvoorbereiding.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <GymCanvas ref={canvasRef} />
        <div className="flex items-center gap-3">
          <Button type="button" onClick={handleExport}>
            <MapPinned className="size-4" />
            Exporteer plattegrond naar les
          </Button>
          {exported && (
            <span className="flex items-center gap-1 text-sm text-muted-foreground">
              <Check className="size-4" />
              Toegevoegd aan de lesvoorbereiding
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
