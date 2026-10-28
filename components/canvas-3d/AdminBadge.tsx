"use client";

import Link from "next/link";
import { useState } from "react";
import { History, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { adminListFloorplanVersions, adminRestoreFloorplanVersion } from "@/actions/admin";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { FloorplanAdminInfo, FloorplanVersionRow } from "@/lib/services/adminFloorplans";

/**
 * "Beheer"-badge in de editor: je werkt als beheerder, eventueel in andermans plattegrond. Toont eigenaar en activiteit, en geeft
 * toegang tot de laatste 10 versies (terugzetten). Alles server-side afgedwongen; dit is alleen de weergave.
 */
export function AdminBadge({ info, onRestored }: { info: FloorplanAdminInfo; onRestored: () => void }) {
  const [open, setOpen] = useState(false);
  const [versions, setVersions] = useState<FloorplanVersionRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function openVersions() {
    setOpen(true);
    setError(null);
    setVersions(null);
    const result = await adminListFloorplanVersions(info.floorplanId);
    if ("error" in result) setError(result.error);
    else setVersions(result.versions);
  }

  async function restore(id: string) {
    setBusy(id);
    const result = await adminRestoreFloorplanVersion(id);
    setBusy(null);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success("Versie teruggezet.");
    setOpen(false);
    onRestored();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void openVersions()}
        title={`Beheermodus — eigenaar: ${info.ownerName}${info.activityTitle ? ` · activiteit: ${info.activityTitle}` : ""}. Klik voor de versies.`}
        data-testid="admin-badge"
        className="inline-flex min-h-9 max-w-[16rem] items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-2.5 text-xs font-semibold text-primary hover:bg-primary/15 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <ShieldCheck className="size-3.5 shrink-0" aria-hidden="true" />
        <span className="shrink-0">Beheer</span>
        <span className="hidden truncate font-normal text-foreground/80 lg:inline">
          · {info.ownerIsSelf ? "eigen plattegrond" : info.ownerName}
          {info.activityTitle ? ` · ${info.activityTitle}` : ""}
        </span>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent overlayClassName="z-[140]" className="z-[150]" data-testid="admin-versions-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="size-5 text-primary" aria-hidden="true" /> Versies van deze plattegrond
            </DialogTitle>
            <DialogDescription>
              Eigenaar: {info.ownerName}
              {info.activityTitle ? ` · activiteit: ${info.activityTitle}` : " · niet aan een activiteit gekoppeld"}. De laatste 10 versies blijven bewaard; terugzetten bewaart eerst de huidige staat.
            </DialogDescription>
          </DialogHeader>
          {info.activityId && (
            <Link href={`/beheer/activiteiten/${info.activityId}`} className="text-sm font-medium text-primary underline-offset-4 hover:underline">
              Activiteit in het beheer openen
            </Link>
          )}
          {error && (
            <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
          {!error && versions === null && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Versies laden…
            </p>
          )}
          {versions && versions.length === 0 && <p className="text-sm text-muted-foreground">Nog geen eerdere versies.</p>}
          {versions && versions.length > 0 && (
            <ul className="max-h-72 space-y-2 overflow-y-auto" aria-label="Versies">
              {versions.map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
                  <span className="min-w-0">
                    <span className="block font-medium">
                      Versie {v.version} · {v.items} items
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      Overschreven op {new Date(v.saved_at).toLocaleString("nl-NL")}
                      {v.replaced_by_name ? ` door ${v.replaced_by_name}` : ""}
                    </span>
                  </span>
                  <Button type="button" size="sm" variant="outline" disabled={busy !== null} onClick={() => void restore(v.id)}>
                    {busy === v.id ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : "Terugzetten"}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
