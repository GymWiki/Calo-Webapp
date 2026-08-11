# Ontdek Activiteiten — zoek- en filterpagina voor de activiteiten-bibliotheek

## Doel
De 203 geïmporteerde PE/gym-activiteiten (tabel `public.activiteiten`) doorzoekbaar en filterbaar maken als de nieuwe `/zoeken`-pagina, met opslaan-als-favoriet en "kopieer naar eigen les"-acties. Vervangt de huidige lessen-zoekpagina op die route (lessen-zoeken blijft bestaan op `docent/bibliotheek`).

## Architectuur
Client-side filtering, geen server-side full-text search. Alle 203 rijen worden één keer server-side opgehaald (Server Component) en als props doorgegeven aan een client component die zoekterm + filter-chips toepast met `useMemo`. Dit levert instant resultaten zonder debounce/roundtrips en volgt het patroon van de bestaande lessen-zoekpagina. Bij duizenden rijen zou Postgres FTS nodig zijn; bij 203 is dat premature.

Paginering: client-side "Laad meer" — toont eerst 24 kaarten, telt op bij klikken. Reset naar 24 zodra zoekterm/filters wijzigen.

## Databron & nieuwe tabel
- Bestaand: `public.activiteiten` (203 rijen, kolommen: id, titel, actcode, afbeelding, beginsituatie, beschrijving, categorie, beweegthema, doel, leerlijn, loopt, lukt, leeft, niveau, materiaal, onderwijs_type, veld, regels, doelgroep, filters).
- Nieuw: `public.opgeslagen_activiteiten` (bookmark-tabel)
  ```sql
  create table public.opgeslagen_activiteiten (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    activiteit_id text not null references public.activiteiten(id) on delete cascade,
    created_at timestamptz not null default now(),
    unique (user_id, activiteit_id)
  );
  -- RLS: eigen rijen selecteren/inserten/verwijderen, geen toegang tot andermans rijen.
  ```
  Bestand: `supabase/schema_fase6.sql`.

## Filters (afgeleid van echte data)
- **Leerlijn** — multi-select chips, de 14 distincte waarden uit de tabel.
- **Categorie** — multi-select chips: Atletiek, Spel, Turnen, Zelfverdediging, Bewegen op muziek, Overig.
- **Doelgroep** — multi-select chips, directe 1-op-1 mapping op de `doelgroep`-array-waarden (geen bereik-logica):
  | waarde | label |
  |---|---|
  | 1 | Groep 1/2 |
  | 2 | Groep 3/4 |
  | 3 | Groep 5/6 |
  | 4 | Groep 7/8 |
  | 5 | Onderbouw |
  | 6 | Bovenbouw |
  Match: `chipWaarde = ANY(doelgroep)`.
- **Materiaal** — enkele toggle "Weinig materiaal" (heuristiek: `materiaal.length <= 2`).

Filter-groepen zijn AND t.o.v. elkaar; waarden binnen één groep zijn OR.

## Zoekbalk
Instant substring-match (lowercase, whitespace-trim) over: `titel`, `beweegthema`, `doel`, `leerlijn`, `materiaal.join(" ")`, `actcode`.

## UI
- `app/(protected)/zoeken/page.tsx` (Server Component): haalt alle activiteiten + (indien ingelogd) de bookmark-ids van de gebruiker op, rendert `ActiviteitenSearchClient`. Nav-label "Zoeken" → "Activiteiten" in `components/app-layout.tsx` (href blijft `/zoeken`).
- `app/(protected)/zoeken/activiteiten-search-client.tsx` (nieuw, vervangt `search-client.tsx`): hero zoekbalk + filter-chip-rijen + resultaten-grid + "Laad meer". Lege-resultaten-state via bestaande `EmptyState`, met "Wis filters"-knop wanneer filters actief zijn.
- `components/activity-card.tsx` (nieuw): titel, leerlijn+beweegthema (badges), doelgroep-labels, materiaal-preview (eerste 2-3 + "+N"), niveau-indicator, afbeelding-thumbnail (met fallback-icoon als de afbeelding-URL faalt/ontbreekt), en 3 acties: Bewaren (bookmark-toggle, optimistic), Kopieer & Bewerk (link), Bekijk Lesvoorbereiding (opent dialog).
- `components/activity-detail-dialog.tsx` (nieuw): volledige details (doel, beginsituatie, beschrijving, materiaal-lijst, regels-lijst, loopt/lukt/leeft-tips), zelfde 2 actieknoppen in de footer.

**Geen aparte detailpagina-route** — "Bekijk Lesvoorbereiding" opent een Dialog i.p.v. te navigeren, om een nieuwe route te vermijden voor content die al compact in een modal past.
**Geen duur/deelnemers-aantal op de kaart** — niet aanwezig als apart veld in de tabel, alleen losjes in vrije tekst; wordt niet gescraped.

## "Kopieer & Bewerk" — les-maken pre-fill
`app/(protected)/les-maken/page.tsx` wordt async en leest `searchParams.vanuit` (activiteit-id). Indien aanwezig: haalt de activiteit op en mapt naar `Partial<CreateLessonFormInput>`:

| lesveld | bron | opmerking |
|---|---|---|
| title | titel | |
| learningLine | leerlijn | |
| movementTheme | beweegthema | |
| goals | doel | |
| baseMaterials | materiaal | |
| rules | regels | |
| arrangement | beschrijving | |
| deelnemersRegels | regels.join("\n") | prosetekst van dezelfde regels-lijst |
| plaatjePraatje | beginsituatie | benaderend, geen exacte match |
| aandachtspunten | loopt + lukt + leeft samengevoegd | gelabeld per categorie |
| movementProblem | — | **blijft leeg**, verplicht veld, gebruiker vult zelf in |
| lessonDate, groupName | — | **blijven leeg**, verplicht, gebruiker vult zelf in |
| 4 L'en-velden | — | blijven leeg (optioneel, blokkeert niet) |

`LessonForm` krijgt een nieuwe optionele prop `initialValues?: Partial<CreateLessonFormInput>`, gemerged over `createLessonDefaultValues`.

## Server-acties & services
- `lib/services/activities.ts`: `getAllActivities()`, `getActivityById(id)`, `getSavedActivityIds(userId)`.
- `actions/activity.ts`: `toggleSavedActivity(activiteitId)` — insert/delete in `opgeslagen_activiteiten` voor de ingelogde gebruiker, retourneert nieuwe staat; gebruikt voor de optimistic bookmark-knop.
- `types/activity.ts`: TS-type dat de tabelkolommen spiegelt.

## Foutafhandeling
- Bookmark-toggle mislukt → sonner-toast + optimistic state terugdraaien.
- Geen matches bij actieve filters → `EmptyState` met "Wis filters".
- Ontbrekende/kapotte afbeelding-URL → fallback-icoon i.p.v. gebroken `<img>`.

## Test-/verificatieplan
- Build + lint.
- Playwright: laden als student + docent, zoekterm typen (instant filter), elke filter-groep toggelen, "Laad meer", bookmark toggle + page-reload-persistentie, "Kopieer & Bewerk" → formulier correct voorgevuld → opslaan werkt, "Bekijk Lesvoorbereiding"-dialog toont volledige content, mobiele viewport toont zoekbalk direct in beeld, lege-resultaten-state met filters-wissen.
