import Link from "next/link";
import { cookies } from "next/headers";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";

import { ActivityTable } from "@/components/beheer/ActivityTable";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { requireAdminPage } from "@/lib/auth/admin";
import { PAGE_SIZE, SORTS, STATUS_FILTERS, listQuery, pageCount, parseListFilters } from "@/lib/beheer/list";
import { STATE_LABEL } from "@/lib/beheer/state";
import { adminFilterOptions, listAdminActivities } from "@/lib/services/adminActivities";
import { createClient } from "@/utils/supabase/server";

export const metadata = { title: "Beheer — GymWiki", robots: { index: false, follow: false } };

const selectClass = "h-10 w-full rounded-lg border bg-background px-2 text-sm";

export default async function BeheerPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdminPage();
  const filters = parseListFilters(await searchParams);
  const supabase = createClient(await cookies());
  const [{ rows, total, counts }, options] = await Promise.all([listAdminActivities(supabase, filters), adminFilterOptions(supabase)]);
  const pages = pageCount(total);
  const hasFilters = Boolean(filters.q || filters.categorie || filters.leerlijn || filters.status || filters.plattegrond || filters.afbeelding);

  const stat = (label: string, value: number, status: string) => (
    <Link
      key={label}
      href={`/beheer${listQuery(filters, { status: status as never, page: 1 })}`}
      className={`rounded-xl border px-3 py-2 text-sm hover:border-primary/60 ${filters.status === status ? "border-primary bg-primary/5" : "bg-card"}`}
    >
      <span className="block text-lg font-semibold tabular-nums">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </Link>
  );

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-8 sm:py-10">
      <PageHeader eyebrow="Beheer" title="Activiteiten" description="Alle activiteiten bekijken, aanpassen, publiceren, archiveren en verwijderen. Elke wijziging komt in het auditlog." />

      <section aria-label="Aantallen" className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {stat("Totaal", counts.totaal, "")}
        {stat(STATE_LABEL.gepubliceerd, counts.gepubliceerd, "gepubliceerd")}
        {stat(STATE_LABEL.concept, counts.concept, "concept")}
        {stat(STATE_LABEL.gearchiveerd, counts.gearchiveerd, "gearchiveerd")}
        {stat(STATE_LABEL["in-beoordeling"], counts.inBeoordeling, "in-beoordeling")}
        {stat(STATE_LABEL.afgewezen, counts.afgewezen, "afgewezen")}
        {stat(STATE_LABEL.verwijderd, counts.verwijderd, "verwijderd")}
      </section>

      <form method="get" action="/beheer" className="grid gap-3 rounded-2xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Filters">
        <label className="sm:col-span-2 lg:col-span-2">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Zoeken in titel</span>
          <span className="relative block">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input name="q" defaultValue={filters.q} placeholder="Bijv. tikspel" className="h-10 w-full rounded-lg border bg-background pr-2 pl-8 text-base sm:text-sm" />
          </span>
        </label>
        <label>
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Status</span>
          <select name="status" defaultValue={filters.status} className={selectClass}>
            <option value="">Alle (zonder verwijderd)</option>
            {STATUS_FILTERS.map((s) => (
              <option key={s} value={s}>{STATE_LABEL[s]}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Sorteren</span>
          <select name="sort" defaultValue={filters.sort} className={selectClass}>
            {Object.entries(SORTS).map(([key, s]) => (
              <option key={key} value={key}>{s.label}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Categorie</span>
          <select name="categorie" defaultValue={filters.categorie} className={selectClass}>
            <option value="">Alle categorieën</option>
            {options.categorieen.map((c) => (<option key={c} value={c}>{c}</option>))}
          </select>
        </label>
        <label>
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Leerlijn</span>
          <select name="leerlijn" defaultValue={filters.leerlijn} className={selectClass}>
            <option value="">Alle leerlijnen</option>
            {options.leerlijnen.map((l) => (<option key={l} value={l}>{l}</option>))}
          </select>
        </label>
        <label>
          <span className="mb-1 block text-xs font-medium text-muted-foreground">3D-plattegrond</span>
          <select name="plattegrond" defaultValue={filters.plattegrond} className={selectClass}>
            <option value="">Maakt niet uit</option>
            <option value="ja">Heeft een plattegrond</option>
            <option value="nee">Geen plattegrond</option>
          </select>
        </label>
        <label>
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Afbeelding</span>
          <select name="afbeelding" defaultValue={filters.afbeelding} className={selectClass}>
            <option value="">Maakt niet uit</option>
            <option value="ja">Heeft een afbeelding</option>
            <option value="nee">Geen afbeelding</option>
          </select>
        </label>
        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4">
          <Button type="submit">Filteren</Button>
          {hasFilters && (
            <Button asChild variant="ghost">
              <Link href="/beheer">Filters wissen</Link>
            </Button>
          )}
          <p className="ml-auto text-sm text-muted-foreground" aria-live="polite" data-testid="beheer-aantal">
            {total} {total === 1 ? "resultaat" : "resultaten"}{hasFilters ? " met deze filters" : ""}
          </p>
        </div>
      </form>

      <ActivityTable rows={rows} options={options} />

      {pages > 1 && (
        <nav aria-label="Paginering" className="flex items-center justify-between gap-3">
          <Button asChild variant="outline" size="sm" aria-disabled={filters.page <= 1} className={filters.page <= 1 ? "pointer-events-none opacity-50" : ""}>
            <Link href={`/beheer${listQuery(filters, { page: filters.page - 1 })}`}><ChevronLeft className="size-4" aria-hidden="true" /> Vorige</Link>
          </Button>
          <span className="text-sm text-muted-foreground">Pagina {filters.page} van {pages} ({PAGE_SIZE} per pagina)</span>
          <Button asChild variant="outline" size="sm" aria-disabled={filters.page >= pages} className={filters.page >= pages ? "pointer-events-none opacity-50" : ""}>
            <Link href={`/beheer${listQuery(filters, { page: filters.page + 1 })}`}>Volgende <ChevronRight className="size-4" aria-hidden="true" /></Link>
          </Button>
        </nav>
      )}
    </main>
  );
}
