"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Box, ImageIcon } from "lucide-react";
import { toast } from "sonner";

import { adminBulkUpdate } from "@/actions/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TARGET_STATES, STATE_LABEL, canChangeState, type TargetState } from "@/lib/beheer/state";
import type { AdminListRow } from "@/lib/services/adminActivities";

const selectClass = "h-10 w-full rounded-lg border bg-background px-2 text-sm";

/** Lijst met selectie en bulkacties (categorie, leerlijn, status) met voorbeeld en bevestiging vooraf. */
export function ActivityTable({ rows, options }: { rows: AdminListRow[]; options: { categorieen: string[]; leerlijnen: string[] } }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [categorie, setCategorie] = useState("");
  const [leerlijn, setLeerlijn] = useState("");
  const [state, setState] = useState<TargetState | "">("");
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();

  const chosen = useMemo(() => rows.filter((r) => selected.has(r.id)), [rows, selected]);
  const teamBlocked = state !== "" && chosen.some((r) => !canChangeState(r));
  const hasChange = categorie !== "" || leerlijn !== "" || state !== "";
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function apply() {
    start(async () => {
      const result = await adminBulkUpdate({
        ids: chosen.map((r) => r.id),
        ...(categorie ? { categorie } : {}),
        ...(leerlijn ? { leerlijn } : {}),
        ...(state ? { state } : {}),
      });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(`${result.updated} activiteit${result.updated === 1 ? "" : "en"} bijgewerkt.`);
      setConfirming(false);
      setSelected(new Set());
      setCategorie("");
      setLeerlijn("");
      setState("");
      router.refresh();
    });
  }

  if (rows.length === 0) return <p className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">Geen activiteiten gevonden met deze filters.</p>;

  return (
    <div className="space-y-4">
      {selected.size > 0 && (
        <section aria-label="Bulkacties" className="sticky top-2 z-20 space-y-3 rounded-2xl border border-primary/40 bg-card p-4 shadow-brand-md" data-testid="bulk-bar">
          <p className="text-sm font-semibold">{selected.size} geselecteerd</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <label>
              <span className="mb-1 block text-xs font-medium text-muted-foreground">Categorie wijzigen naar</span>
              <select value={categorie} onChange={(e) => setCategorie(e.target.value)} className={selectClass}>
                <option value="">Niet wijzigen</option>
                {options.categorieen.map((c) => (<option key={c} value={c}>{c}</option>))}
              </select>
            </label>
            <label>
              <span className="mb-1 block text-xs font-medium text-muted-foreground">Leerlijn wijzigen naar</span>
              <select value={leerlijn} onChange={(e) => setLeerlijn(e.target.value)} className={selectClass}>
                <option value="">Niet wijzigen</option>
                {options.leerlijnen.map((l) => (<option key={l} value={l}>{l}</option>))}
              </select>
            </label>
            <label>
              <span className="mb-1 block text-xs font-medium text-muted-foreground">Status wijzigen naar</span>
              <select value={state} onChange={(e) => setState(e.target.value as TargetState | "")} className={selectClass}>
                <option value="">Niet wijzigen</option>
                {TARGET_STATES.map((s) => (<option key={s.value} value={s.value}>{s.label}</option>))}
              </select>
            </label>
          </div>
          {teamBlocked && <p className="text-sm text-destructive" role="alert">De selectie bevat teamactiviteiten; die wisselen niet van status via het beheer.</p>}
          <div className="flex gap-2">
            <Button type="button" disabled={!hasChange || teamBlocked} onClick={() => setConfirming(true)} data-testid="bulk-preview">Voorbeeld en bevestigen</Button>
            <Button type="button" variant="ghost" onClick={() => setSelected(new Set())}>Selectie wissen</Button>
          </div>
        </section>
      )}

      <div className="overflow-hidden rounded-2xl border bg-card">
        <div className="hidden grid-cols-[2rem_1fr_9rem_9rem_7rem] items-center gap-3 border-b bg-muted/40 px-4 py-2 text-xs font-semibold text-muted-foreground md:grid">
          <input type="checkbox" aria-label="Alles op deze pagina selecteren" checked={allSelected} onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)))} className="size-4" />
          <span>Activiteit</span>
          <span>Categorie</span>
          <span>Auteur</span>
          <span>Status</span>
        </div>
        <ul className="divide-y">
          {rows.map((r) => (
            <li key={r.id} className="grid grid-cols-[2rem_1fr] items-start gap-3 px-4 py-3 md:grid-cols-[2rem_1fr_9rem_9rem_7rem] md:items-center" data-testid="beheer-rij">
              <input type="checkbox" aria-label={`Selecteer ${r.titel}`} checked={selected.has(r.id)} onChange={() => toggle(r.id)} className="mt-1 size-4 md:mt-0" />
              <div className="min-w-0">
                <Link href={`/beheer/activiteiten/${r.id}`} className="block min-h-6 truncate font-medium text-primary underline-offset-4 hover:underline">{r.titel}</Link>
                <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {r.has3d && <span className="inline-flex items-center gap-1"><Box className="size-3" aria-hidden="true" /> 3D</span>}
                  {r.afbeelding && <span className="inline-flex items-center gap-1"><ImageIcon className="size-3" aria-hidden="true" /> afbeelding</span>}
                  <span>{r.like_count} likes</span>
                  <span>bijgewerkt {new Date(r.updated_at).toLocaleDateString("nl-NL")}</span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground md:hidden">{r.categorie ?? "Geen categorie"} · {r.authorName ?? "GymWiki"}</p>
              </div>
              <span className="hidden truncate text-sm md:block">{r.categorie ?? "—"}</span>
              <span className="hidden truncate text-sm md:block">{r.authorName ?? "GymWiki"}</span>
              <span className="col-start-2 md:col-start-auto"><Badge variant={r.state === "gepubliceerd" ? "default" : "secondary"}>{STATE_LABEL[r.state]}</Badge></span>
            </li>
          ))}
        </ul>
      </div>

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent data-testid="bulk-dialog">
          <DialogHeader>
            <DialogTitle>{chosen.length} activiteit{chosen.length === 1 ? "" : "en"} aanpassen?</DialogTitle>
            <DialogDescription>Controleer het voorbeeld. Elke wijziging komt in het auditlog en is per activiteit terug te zetten.</DialogDescription>
          </DialogHeader>
          <ul className="space-y-1 text-sm">
            {categorie && <li>Categorie wordt <strong>{categorie}</strong></li>}
            {leerlijn && <li>Leerlijn wordt <strong>{leerlijn}</strong></li>}
            {state && <li>Status wordt <strong>{TARGET_STATES.find((s) => s.value === state)?.label}</strong></li>}
          </ul>
          <ul className="max-h-48 divide-y overflow-y-auto rounded-lg border text-sm" aria-label="Betreffende activiteiten">
            {chosen.map((r) => (
              <li key={r.id} className="px-3 py-1.5">
                <span className="font-medium">{r.titel}</span>
                <span className="block text-xs text-muted-foreground">nu: {r.categorie ?? "geen categorie"} · {r.leerlijn ?? "geen leerlijn"} · {STATE_LABEL[r.state]}</span>
              </li>
            ))}
          </ul>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={() => setConfirming(false)}>Annuleren</Button>
            <Button type="button" onClick={apply} disabled={pending} data-testid="bulk-confirm">{pending ? "Bezig…" : "Doorvoeren"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
