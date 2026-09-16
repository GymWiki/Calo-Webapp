"use client";

import { useRef } from "react";
import dynamic from "next/dynamic";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
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

/**
 * Volledig-scherm canvas-editor — vervangt de vroegere altijd-ingebedde
 * `DiagramEditorCard`. Geen paginanavigatie/headers eromheen, alleen een
 * minimale "Klaar"-knop: sluiten SLAAT ALTIJD OP (zie Deel 3 van de brief —
 * geen aparte bevestigingsstap meer), dus zowel de terug-pijl links als de
 * "Klaar"-knop rechts roepen dezelfde exportDiagram+onSave-flow aan.
 */
export function FullscreenDiagramEditor({
  open,
  onOpenChange,
  initialData,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData: DiagramData | null;
  onSave: (data: DiagramData, imageDataUrl: string) => void;
}) {
  const canvasRef = useRef<GymCanvasHandle>(null);

  function handleDone() {
    const result = canvasRef.current?.exportDiagram();
    if (result) {
      onSave(result.data, result.imageDataUrl);
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : handleDone())}>
      <DialogContent
        showCloseButton={false}
        className="fixed inset-0 top-0 left-0 z-50 flex h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-0 p-0"
      >
        <DialogTitle className="sr-only">Plattegrond bewerken</DialogTitle>
        <div className="flex shrink-0 items-center justify-between gap-2 border-b bg-card px-3 py-2.5">
          <Button type="button" variant="ghost" size="sm" onClick={handleDone}>
            <X className="size-4" />
            Terug
          </Button>
          <p className="text-sm font-semibold">Plattegrond bewerken</p>
          <Button type="button" size="sm" onClick={handleDone}>
            Klaar
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 sm:p-4">
          {open && <GymCanvas ref={canvasRef} initialData={initialData} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}
