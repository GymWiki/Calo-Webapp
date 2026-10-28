// Filters, sortering en paginering van de beheerlijst (/beheer). Zuiver (geen Supabase) zodat het testbaar is; de pagina past
// het resultaat toe op de query. Alles komt uit een allowlist; onbekende waarden vallen terug op de standaard.

export const PAGE_SIZE = 25;

export const SORTS = {
  bijgewerkt: { column: "updated_at", ascending: false, label: "Laatst bijgewerkt" },
  titel: { column: "titel", ascending: true, label: "Titel A–Z" },
  nieuwste: { column: "created_at", ascending: false, label: "Nieuwste eerst" },
  likes: { column: "like_count", ascending: false, label: "Meeste likes" },
} as const;
export type SortKey = keyof typeof SORTS;

export const STATUS_FILTERS = ["concept", "gepubliceerd", "gearchiveerd", "in-beoordeling", "afgewezen", "verwijderd"] as const;
export type StatusFilter = (typeof STATUS_FILTERS)[number];
const TRISTATE = ["ja", "nee"] as const;
export type Tristate = (typeof TRISTATE)[number];

export type ListFilters = {
  q: string;
  categorie: string;
  leerlijn: string;
  status: StatusFilter | "";
  plattegrond: Tristate | "";
  afbeelding: Tristate | "";
  sort: SortKey;
  page: number;
};

type Raw = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export function parseListFilters(raw: Raw): ListFilters {
  const status = one(raw.status);
  const plattegrond = one(raw.plattegrond);
  const afbeelding = one(raw.afbeelding);
  const sort = one(raw.sort);
  const page = Number.parseInt(one(raw.pagina), 10);
  return {
    // Geen % of , in de zoekterm: die hebben betekenis in PostgREST-filters.
    q: one(raw.q).replace(/[%,()*\\]/g, " ").trim().slice(0, 80),
    categorie: one(raw.categorie).slice(0, 80),
    leerlijn: one(raw.leerlijn).slice(0, 120),
    status: (STATUS_FILTERS as readonly string[]).includes(status) ? (status as StatusFilter) : "",
    plattegrond: (TRISTATE as readonly string[]).includes(plattegrond) ? (plattegrond as Tristate) : "",
    afbeelding: (TRISTATE as readonly string[]).includes(afbeelding) ? (afbeelding as Tristate) : "",
    sort: sort in SORTS ? (sort as SortKey) : "bijgewerkt",
    page: Number.isFinite(page) && page > 0 ? Math.min(page, 10_000) : 1,
  };
}

/** Querystring van de actieve filters (voor links, paginering en export van de huidige weergave). */
export function listQuery(filters: ListFilters, overrides: Partial<ListFilters> = {}): string {
  const f = { ...filters, ...overrides };
  const params = new URLSearchParams();
  if (f.q) params.set("q", f.q);
  if (f.categorie) params.set("categorie", f.categorie);
  if (f.leerlijn) params.set("leerlijn", f.leerlijn);
  if (f.status) params.set("status", f.status);
  if (f.plattegrond) params.set("plattegrond", f.plattegrond);
  if (f.afbeelding) params.set("afbeelding", f.afbeelding);
  if (f.sort !== "bijgewerkt") params.set("sort", f.sort);
  if (f.page > 1) params.set("pagina", String(f.page));
  const text = params.toString();
  return text ? `?${text}` : "";
}

export const pageCount = (total: number) => Math.max(1, Math.ceil(total / PAGE_SIZE));
