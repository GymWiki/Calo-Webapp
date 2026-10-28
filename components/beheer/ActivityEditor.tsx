"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Box, History, ImageOff, Link2, Link2Off, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  adminHardDelete,
  adminLinkFloorplan,
  adminRemoveActivityImage,
  adminRestoreAuditChange,
  adminSetActivityState,
  adminSoftDelete,
  adminUpdateActivity,
} from "@/actions/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RESTORABLE_COLUMNS } from "@/lib/beheer/schemas";
import { STATE_LABEL, TARGET_STATES, canChangeState, deriveState } from "@/lib/beheer/state";
import { DOELGROEP_LABELS } from "@/types/activity";
import type { AuditEntry, LinkedFloorplan } from "@/lib/services/adminActivities";

export type EditableActivity = {
  id: string;
  titel: string;
  doel: string | null;
  beginsituatie: string | null;
  beschrijving: string | null;
  arrangement: string | null;
  aandachtspunten: string | null;
  plaatje_praatje: string | null;
  deelnemers_regels: string | null;
  categorie: string | null;
  leerlijn: string | null;
  beweegthema: string | null;
  niveau: number | null;
  doelgroep: number[] | null;
  materiaal: string[] | null;
  base_materials: string[] | null;
  rule_materials: string[] | null;
  regels: string[] | null;
  loopt: string[] | null;
  lukt: string[] | null;
  leeft: string[] | null;
  min_participants: number | null;
  participants_bench: number | null;
  afbeelding: string | null;
  status: string;
  visibility: string;
  deleted_at: string | null;
  author_id: string | null;
  is_ai_generated: boolean;
  updated_at: string;
};

type FormState = Record<string, string | number[]>;

const TEXT_FIELDS = [
  ["titel", "Titel", 1],
  ["categorie", "Categorie", 1],
  ["leerlijn", "Leerlijn", 1],
  ["beweegthema", "Beweegthema", 1],
  ["doel", "Doel", 3],
  ["beginsituatie", "Beginsituatie", 3],
  ["beschrijving", "Beschrijving", 5],
  ["arrangement", "Opstelling", 4],
  ["aandachtspunten", "Aandachtspunten", 4],
  ["plaatje_praatje", "Plaatje en praatje", 3],
  ["deelnemers_regels", "Regels voor deelnemers", 3],
] as const;
const LIST_FIELDS = [
  ["materiaal", "Materiaal"],
  ["base_materials", "Basismateriaal"],
  ["rule_materials", "Regelmateriaal"],
  ["regels", "Regels"],
  ["loopt", "Loopt het?"],
  ["lukt", "Lukt het?"],
  ["leeft", "Leeft het?"],
] as const;
const NUMBER_FIELDS = [
  ["niveau", "Niveau (0–10)"],
  ["min_participants", "Minimum aantal deelnemers"],
  ["participants_bench", "Aantal op de bank"],
] as const;

const toForm = (a: EditableActivity): FormState => ({
  ...Object.fromEntries(TEXT_FIELDS.map(([k]) => [k, (a[k] as string | null) ?? ""])),
  ...Object.fromEntries(LIST_FIELDS.map(([k]) => [k, ((a[k] as string[] | null) ?? []).join("\n")])),
  ...Object.fromEntries(NUMBER_FIELDS.map(([k]) => [k, a[k] === null ? "" : String(a[k])])),
  afbeelding: a.afbeelding ?? "",
  doelgroep: a.doelgroep ?? [],
});

function toInput(form: FormState) {
  const num = (v: string | number[]) => (v === "" ? null : Number(v));
  return {
    ...Object.fromEntries(TEXT_FIELDS.map(([k]) => [k, form[k] as string])),
    ...Object.fromEntries(LIST_FIELDS.map(([k]) => [k, (form[k] as string).split("\n").map((l) => l.trim()).filter(Boolean)])),
    ...Object.fromEntries(NUMBER_FIELDS.map(([k]) => [k, num(form[k])])),
    afbeelding: form.afbeelding as string,
    doelgroep: form.doelgroep as number[],
  };
}

const short = (value: unknown) => {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  if (text === undefined || text === "null") return "(leeg)";
  return text.length > 90 ? `${text.slice(0, 90)}…` : text;
};

const inputClass = "w-full rounded-lg border bg-background px-3 py-2 text-base sm:text-sm";

export function ActivityEditor({
  activity,
  audit,
  floorplans,
  authorName,
}: {
  activity: EditableActivity;
  audit: AuditEntry[];
  floorplans: { linked: LinkedFloorplan[]; available: (LinkedFloorplan & { linkedTo: string | null })[] };
  authorName: string | null;
}) {
  const router = useRouter();
  const [initial, setInitial] = useState(() => JSON.stringify(toForm(activity)));
  const [form, setForm] = useState<FormState>(() => toForm(activity));
  const [pending, start] = useTransition();
  const [hardDelete, setHardDelete] = useState(false);
  const [typedTitle, setTypedTitle] = useState("");
  const [linkId, setLinkId] = useState("");

  const dirty = useMemo(() => JSON.stringify(form) !== initial, [form, initial]);
  const state = deriveState(activity);
  const has3d = floorplans.linked.length > 0;

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const set = (key: string, value: string | number[]) => setForm((prev) => ({ ...prev, [key]: value }));
  const run = (fn: () => Promise<{ error: string } | object>, ok: string, after?: () => void) =>
    start(async () => {
      const result = await fn();
      if ("error" in result) {
        toast.error(String(result.error));
        return;
      }
      toast.success(ok);
      after?.();
      router.refresh();
    });

  function save() {
    run(
      () => adminUpdateActivity(activity.id, toInput(form)),
      "Opgeslagen.",
      () => setInitial(JSON.stringify(form)),
    );
  }

  function cancel() {
    if (dirty && !window.confirm("Je hebt niet-opgeslagen wijzigingen. Weggooien?")) return;
    setForm(JSON.parse(initial));
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
        className="space-y-5"
        aria-label="Activiteit bewerken"
      >
        {TEXT_FIELDS.map(([key, label, rows]) => (
          <label key={key} className="block">
            <span className="mb-1 block text-sm font-medium">{label}</span>
            {rows === 1 ? (
              <input value={form[key] as string} onChange={(e) => set(key, e.target.value)} className={inputClass} required={key === "titel"} maxLength={key === "titel" ? 200 : undefined} />
            ) : (
              <textarea value={form[key] as string} onChange={(e) => set(key, e.target.value)} rows={rows} className={inputClass} />
            )}
          </label>
        ))}

        <fieldset className="space-y-2">
          <legend className="mb-1 text-sm font-medium">Doelgroep</legend>
          <div className="flex flex-wrap gap-2">
            {Object.entries(DOELGROEP_LABELS).map(([code, label]) => {
              const value = Number(code);
              const on = (form.doelgroep as number[]).includes(value);
              return (
                <label key={code} className={`inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full border px-3 text-sm ${on ? "border-primary bg-primary/10" : ""}`}>
                  <input type="checkbox" checked={on} onChange={() => set("doelgroep", on ? (form.doelgroep as number[]).filter((v) => v !== value) : [...(form.doelgroep as number[]), value].sort())} className="size-4" />
                  {label}
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-3">
          {NUMBER_FIELDS.map(([key, label]) => (
            <label key={key} className="block">
              <span className="mb-1 block text-sm font-medium">{label}</span>
              <input type="number" min={0} max={500} value={form[key] as string} onChange={(e) => set(key, e.target.value)} className={inputClass} />
            </label>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {LIST_FIELDS.map(([key, label]) => (
            <label key={key} className="block">
              <span className="mb-1 block text-sm font-medium">{label} <span className="font-normal text-muted-foreground">(één per regel)</span></span>
              <textarea value={form[key] as string} onChange={(e) => set(key, e.target.value)} rows={4} className={inputClass} />
            </label>
          ))}
        </div>

        <label className="block">
          <span className="mb-1 block text-sm font-medium">Afbeelding (https-adres)</span>
          <input value={form.afbeelding as string} onChange={(e) => set("afbeelding", e.target.value)} placeholder="https://…" className={inputClass} inputMode="url" />
        </label>

        <div className="sticky bottom-2 z-10 flex flex-wrap items-center gap-2 rounded-2xl border bg-card p-3 shadow-brand-md">
          <Button type="submit" disabled={!dirty || pending} data-testid="opslaan">{pending ? "Bezig…" : "Opslaan"}</Button>
          <Button type="button" variant="outline" onClick={cancel} disabled={!dirty || pending}>Annuleren</Button>
          {dirty && <span className="text-sm text-muted-foreground" role="status">Niet-opgeslagen wijzigingen</span>}
          <Link href="/beheer" onClick={(e) => { if (dirty && !window.confirm("Je hebt niet-opgeslagen wijzigingen. Toch verlaten?")) e.preventDefault(); }} className="ml-auto text-sm text-primary underline-offset-4 hover:underline">
            Terug naar de lijst
          </Link>
        </div>
      </form>

      <aside className="space-y-5">
        <section className="space-y-3 rounded-2xl border bg-card p-4" aria-label="Status">
          <h2 className="text-sm font-semibold">Status</h2>
          <p className="text-sm">
            <Badge variant={state === "gepubliceerd" ? "default" : "secondary"}>{STATE_LABEL[state]}</Badge>
            <span className="ml-2 text-xs text-muted-foreground">auteur: {authorName ?? "GymWiki"}{activity.is_ai_generated ? " · AI-gegenereerd" : ""}</span>
          </p>
          {canChangeState(activity) ? (
            <div className="flex flex-wrap gap-2">
              {TARGET_STATES.map((s) => (
                <Button key={s.value} type="button" size="sm" variant={state === s.value ? "default" : "outline"} disabled={pending || state === s.value} title={s.hint} onClick={() => run(() => adminSetActivityState(activity.id, s.value), `Status: ${s.label}.`)}>
                  {s.label}
                </Button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Dit is een teamactiviteit; de status wijzigt het team zelf.</p>
          )}
          <div className="flex flex-wrap gap-2 border-t pt-3">
            {activity.deleted_at ? (
              <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => run(() => adminSoftDelete(activity.id, true), "Hersteld.")}><RotateCcw className="size-4" aria-hidden="true" /> Herstellen</Button>
            ) : (
              <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => run(() => adminSoftDelete(activity.id), "Verplaatst naar verwijderd (herstelbaar).")}><Trash2 className="size-4" aria-hidden="true" /> Verwijderen (herstelbaar)</Button>
            )}
            <Button type="button" size="sm" variant="ghost" className="text-destructive" onClick={() => { setTypedTitle(""); setHardDelete(true); }}>Definitief verwijderen…</Button>
          </div>
          <Link href={`/activiteit/${activity.id}`} className="block text-sm text-primary underline-offset-4 hover:underline">Bekijk zoals op de site</Link>
        </section>

        <section className="space-y-3 rounded-2xl border bg-card p-4" aria-label="Voorbeeld">
          <h2 className="text-sm font-semibold">Voorbeeld</h2>
          {form.afbeelding && !has3d ? (
            // eslint-disable-next-line @next/next/no-img-element -- beheervoorbeeld van een willekeurig https-adres
            <img src={form.afbeelding as string} alt="" className="aspect-[16/10] w-full rounded-lg object-cover" />
          ) : (
            <div className="flex aspect-[16/10] w-full items-center justify-center rounded-lg bg-muted text-xs text-muted-foreground">{has3d ? "3D-plattegrond wint van de afbeelding" : "Geen afbeelding"}</div>
          )}
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{(form.leerlijn as string) || (form.categorie as string) || "Activiteit"}</p>
          <p className="font-semibold">{(form.titel as string) || "Zonder titel"}</p>
          <p className="line-clamp-3 text-sm text-muted-foreground">{(form.beschrijving as string) || (form.doel as string) || "Geen beschrijving"}</p>
          {activity.afbeelding && (
            <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => run(() => adminRemoveActivityImage(activity.id), "Afbeelding verwijderd.", () => set("afbeelding", ""))}>
              <ImageOff className="size-4" aria-hidden="true" /> Afbeelding verwijderen
            </Button>
          )}
          {has3d && <p className="text-xs text-muted-foreground">Zodra er een 3D-plattegrond is, wint die van de afbeelding (de afbeelding blijft bewaard).</p>}
        </section>

        <section className="space-y-3 rounded-2xl border bg-card p-4" aria-label="3D-plattegronden">
          <h2 className="flex items-center gap-2 text-sm font-semibold"><Box className="size-4 text-primary" aria-hidden="true" /> 3D-plattegronden</h2>
          {floorplans.linked.length === 0 && <p className="text-sm text-muted-foreground">Geen plattegrond gekoppeld.</p>}
          <ul className="space-y-2">
            {floorplans.linked.map((f) => (
              <li key={f.id} className="rounded-lg border p-2 text-sm">
                <p className="font-medium">{f.naam}</p>
                <p className="text-xs text-muted-foreground">van {f.ownerName}</p>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  <Button asChild size="sm" variant="outline"><Link href={`/plattegrond-3d?open=${f.id}`}>Plattegrond bewerken</Link></Button>
                  <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => run(() => adminLinkFloorplan(f.id, null), "Losgemaakt.")}><Link2Off className="size-4" aria-hidden="true" /> Losmaken</Button>
                </div>
              </li>
            ))}
          </ul>
          {floorplans.available.length > 0 && (
            <div className="flex gap-2">
              <select value={linkId} onChange={(e) => setLinkId(e.target.value)} className="h-10 min-w-0 flex-1 rounded-lg border bg-background px-2 text-sm" aria-label="Plattegrond om te koppelen">
                <option value="">Plattegrond koppelen…</option>
                {floorplans.available.map((f) => (<option key={f.id} value={f.id}>{f.naam} · {f.ownerName}{f.linkedTo ? " (nu elders gekoppeld)" : ""}</option>))}
              </select>
              <Button type="button" size="sm" disabled={!linkId || pending} onClick={() => run(() => adminLinkFloorplan(linkId, activity.id), "Gekoppeld.", () => setLinkId(""))}><Link2 className="size-4" aria-hidden="true" /> Koppel</Button>
            </div>
          )}
        </section>

        <section className="space-y-3 rounded-2xl border bg-card p-4" aria-label="Wijzigingshistorie">
          <h2 className="flex items-center gap-2 text-sm font-semibold"><History className="size-4 text-primary" aria-hidden="true" /> Wijzigingshistorie</h2>
          {audit.length === 0 && <p className="text-sm text-muted-foreground">Nog geen vastgelegde wijzigingen.</p>}
          <ol className="max-h-[32rem] space-y-3 overflow-y-auto" data-testid="auditlog">
            {audit.map((entry) => (
              <li key={entry.id} className="rounded-lg border p-2 text-xs">
                <p className="font-medium">
                  {new Date(entry.at).toLocaleString("nl-NL")} · {entry.actor ?? "Systeem"}
                  {entry.actorRole && entry.actorRole !== "user" ? ` (${entry.actorRole})` : ""} · {entry.action === "insert" ? "aangemaakt" : entry.action === "delete" ? "verwijderd" : "gewijzigd"}
                </p>
                <ul className="mt-1 space-y-1.5">
                  {Object.entries(entry.changes).filter(([field]) => field !== "_rij").map(([field, change]) => (
                    <li key={field}>
                      <span className="font-semibold">{field}</span>: <span className="text-muted-foreground line-through">{short(change.old)}</span> → {short(change.new)}
                      {entry.action === "update" && RESTORABLE_COLUMNS.includes(field) && (
                        <button type="button" disabled={pending} onClick={() => run(() => adminRestoreAuditChange(entry.id, field), `${field} teruggezet.`)} className="ml-2 inline-flex min-h-6 items-center gap-1 text-primary underline-offset-2 hover:underline disabled:opacity-50">
                          <RotateCcw className="size-3" aria-hidden="true" /> terugzetten
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </section>
      </aside>

      <Dialog open={hardDelete} onOpenChange={setHardDelete}>
        <DialogContent data-testid="harddelete-dialog">
          <DialogHeader>
            <DialogTitle>Definitief verwijderen?</DialogTitle>
            <DialogDescription>Dit kan niet ongedaan worden gemaakt. Typ de titel om te bevestigen: <strong>{activity.titel}</strong></DialogDescription>
          </DialogHeader>
          <input value={typedTitle} onChange={(e) => setTypedTitle(e.target.value)} aria-label="Titel ter bevestiging" className={inputClass} autoComplete="off" />
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={() => setHardDelete(false)}>Annuleren</Button>
            <Button type="button" variant="destructive" disabled={typedTitle.trim() !== activity.titel.trim() || pending} onClick={() => run(() => adminHardDelete(activity.id, typedTitle), "Definitief verwijderd.", () => router.push("/beheer"))}>Definitief verwijderen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
