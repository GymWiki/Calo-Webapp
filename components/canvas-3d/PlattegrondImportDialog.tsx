"use client";

import { AlertTriangle, FileWarning } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ImportOk, Issue } from "@/lib/plattegrond/validate";

export type ImportDialogState =
  | { kind: "errors"; fileName: string; errors: Issue[] }
  | { kind: "confirm"; fileName: string; result: ImportOk; replaces: boolean };

/** Foutmeldingen of bevestiging (vervangen / waarschuwingen) bij het openen van een plattegrond-JSON. Boven de schermvullende editor (z-index). */
export function PlattegrondImportDialog({
  state,
  onCancel,
  onConfirm,
}: {
  state: ImportDialogState | null;
  onCancel: () => void;
  onConfirm: (result: ImportOk) => void;
}) {
  return (
    <Dialog open={state !== null} onOpenChange={(open) => !open && onCancel()}>
      {state && (
        <DialogContent overlayClassName="z-[140]" className="z-[150]" data-testid="json-import-dialog">
          {state.kind === "errors" ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FileWarning className="size-5 text-destructive" aria-hidden="true" /> Dit bestand kan niet worden geopend
                </DialogTitle>
                <DialogDescription>{state.fileName}: er is niets veranderd in je plattegrond.</DialogDescription>
              </DialogHeader>
              <ul className="max-h-64 space-y-2 overflow-y-auto text-sm" aria-label="Gevonden problemen">
                {state.errors.map((error, index) => (
                  <li key={`${error.path}-${index}`} className="rounded-lg bg-destructive/10 px-3 py-2">
                    <code className="font-mono text-xs font-semibold">{error.path}</code>
                    <span className="block">{error.message}</span>
                  </li>
                ))}
              </ul>
              <DialogFooter>
                <Button type="button" onClick={onCancel}>
                  Sluiten
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>{state.replaces ? "Huidige plattegrond vervangen?" : "Plattegrond openen?"}</DialogTitle>
                <DialogDescription>
                  {state.fileName}: {state.result.scene.items.length} {state.result.scene.items.length === 1 ? "item" : "items"} en {state.result.scene.coneFields.length}{" "}
                  {state.result.scene.coneFields.length === 1 ? "afgezet veld" : "afgezette velden"}.
                  {state.replaces && " Wat je nu hebt wordt vervangen; met ongedaan maken (Ctrl+Z) haal je het terug."}
                </DialogDescription>
              </DialogHeader>
              {state.result.warnings.length > 0 && (
                <div className="space-y-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-950/30 dark:text-amber-100" role="note">
                  <p className="flex items-center gap-2 font-semibold">
                    <AlertTriangle className="size-4" aria-hidden="true" /> Let op
                  </p>
                  <ul className="list-disc space-y-1 pl-5">
                    {state.result.warnings.map((warning, index) => (
                      <li key={`${warning.code}-${index}`}>{warning.message}</li>
                    ))}
                  </ul>
                </div>
              )}
              <DialogFooter className="gap-2 sm:gap-2">
                <Button type="button" variant="outline" onClick={onCancel}>
                  Annuleren
                </Button>
                <Button type="button" onClick={() => onConfirm(state.result)} data-testid="json-import-confirm">
                  {state.replaces ? "Vervangen" : "Openen"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      )}
    </Dialog>
  );
}
