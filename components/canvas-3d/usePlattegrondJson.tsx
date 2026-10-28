"use client";

import { useCallback, useMemo, useRef, useState, type DragEvent, type ReactNode } from "react";
import { FileUp } from "lucide-react";
import { toast } from "sonner";

import { PlattegrondImportDialog, type ImportDialogState } from "@/components/canvas-3d/PlattegrondImportDialog";
import type { JsonAction } from "@/components/canvas-3d/PlattegrondJsonMenu";
import { downloadBlob } from "@/lib/guest/export-image";
import { buildEnvelope, exportFileName, stringifyEnvelope } from "@/lib/plattegrond/format";
import { parsePlattegrondJson, type ImportOk } from "@/lib/plattegrond/validate";
import type { Floorplan3dData } from "@/types/floorplan3d";

/**
 * JSON-export en -import van de editor: downloaden, kopiëren, bestand kiezen of slepen. Alle serialisatie en validatie zit in
 * lib/plattegrond (dezelfde logica als de deellink en het CLI-script); deze hook regelt alleen bestand, dialoog en melding.
 */
export function usePlattegrondJson({
  getScene,
  title,
  knownSlugs,
  hasWork,
  onApply,
}: {
  getScene: () => Floorplan3dData;
  title: string;
  knownSlugs: ReadonlySet<string>;
  /** Er staat nu iets in de editor dat bij importeren verdwijnt (bevestiging vragen). Wordt pas bij het openen van een bestand aangeroepen. */
  hasWork: () => boolean;
  onApply: (result: ImportOk) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dialog, setDialog] = useState<ImportDialogState | null>(null);
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);

  const download = useCallback(() => {
    const text = stringifyEnvelope(buildEnvelope(getScene(), title));
    downloadBlob(new Blob([text], { type: "application/json" }), exportFileName(title));
    toast.success("JSON gedownload.");
  }, [getScene, title]);

  const copy = useCallback(async () => {
    const text = stringifyEnvelope(buildEnvelope(getScene(), title));
    try {
      await navigator.clipboard.writeText(text);
      toast.success("JSON gekopieerd naar het klembord.");
    } catch {
      toast.error("Kopiëren is niet gelukt. Download het bestand in plaats daarvan.");
    }
  }, [getScene, title]);

  const handleFile = useCallback(
    async (file: File) => {
      let text: string;
      try {
        text = await file.text();
      } catch {
        setDialog({ kind: "errors", fileName: file.name, errors: [{ path: "(bestand)", message: "Het bestand kon niet worden gelezen." }] });
        return;
      }
      const result = parsePlattegrondJson(text, { knownSlugs });
      if (!result.ok) {
        setDialog({ kind: "errors", fileName: file.name, errors: result.errors });
        return;
      }
      const replaces = hasWork();
      if (result.warnings.length > 0 || replaces) {
        setDialog({ kind: "confirm", fileName: file.name, result, replaces });
        return;
      }
      onApply(result);
      toast.success(`“${result.title}” geopend.`);
    },
    [knownSlugs, hasWork, onApply],
  );

  const openPicker = useCallback(() => inputRef.current?.click(), []);

  const run = useCallback(
    (action: JsonAction) => {
      if (action === "download") download();
      else if (action === "copy") void copy();
      else openPicker();
    },
    [download, copy, openPicker],
  );

  const dragProps = useMemo(
    () => ({
      onDragEnter: (event: DragEvent) => {
        if (!event.dataTransfer?.types.includes("Files")) return;
        event.preventDefault();
        dragDepth.current += 1;
        setDragging(true);
      },
      onDragOver: (event: DragEvent) => {
        if (event.dataTransfer?.types.includes("Files")) event.preventDefault();
      },
      onDragLeave: () => {
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (dragDepth.current === 0) setDragging(false);
      },
      onDrop: (event: DragEvent) => {
        if (!event.dataTransfer?.files?.length) return;
        event.preventDefault();
        dragDepth.current = 0;
        setDragging(false);
        void handleFile(event.dataTransfer.files[0]);
      },
    }),
    [handleFile],
  );

  const elements: ReactNode = (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".json,application/json"
        className="sr-only"
        tabIndex={-1}
        aria-label="Plattegrond-JSON kiezen"
        data-testid="json-file-input"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void handleFile(file);
        }}
      />
      {dragging && (
        <div className="pointer-events-none absolute inset-0 z-[120] flex items-center justify-center bg-primary/10 backdrop-blur-[1px]" data-testid="json-drop-overlay">
          <div className="flex items-center gap-2 rounded-2xl border-2 border-dashed border-primary bg-card px-6 py-4 text-sm font-semibold shadow-lg">
            <FileUp className="size-5 text-primary" aria-hidden="true" /> Laat los om de plattegrond te openen
          </div>
        </div>
      )}
      <PlattegrondImportDialog
        state={dialog}
        onCancel={() => setDialog(null)}
        onConfirm={(result) => {
          setDialog(null);
          onApply(result);
          toast.success(`“${result.title}” geopend.`);
        }}
      />
    </>
  );

  return { run, dragProps, elements };
}
