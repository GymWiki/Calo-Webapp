-- Opgeslagen intro-teksten voor de publieke categoriepagina's
-- (/leerlijn/[leerlijn], /groep/[groep]) — zie STAP 6 van de SEO-brief.
-- Eenmalig gegenereerd (scripts/generate-category-intros.mts) i.p.v. bij
-- elke page-load opnieuw een AI-call te doen: de tekst verandert niet per
-- bezoeker en hoeft alleen bijgewerkt als de brontekst-strategie wijzigt.

create table if not exists public.categorie_intro (
  id uuid primary key default gen_random_uuid(),
  -- 'leerlijn' of 'groep' — geen 'leerlijn_groep': de combinatiepagina's
  -- (/leerlijn/[leerlijn]/[groep], alleen gerenderd bij >=5 activiteiten)
  -- gebruiken een korte, deterministisch samengestelde introzin i.p.v. een
  -- eigen AI-gegenereerde tekst, dus die hebben geen rij hier nodig.
  type text not null check (type in ('leerlijn', 'groep')),
  slug text not null,
  label text not null,
  intro_text text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (type, slug)
);

drop trigger if exists categorie_intro_set_updated_at on public.categorie_intro;
create trigger categorie_intro_set_updated_at
  before update on public.categorie_intro
  for each row execute function private.set_updated_at();

alter table public.categorie_intro enable row level security;
alter table public.categorie_intro force row level security;

-- Publiek leesbaar (anon + authenticated) — dit IS de publieke
-- marketing-/SEO-tekst voor de categoriepagina's. Schrijven gebeurt
-- uitsluitend via het backfill-script met de service-role-client (die RLS
-- omzeilt); er is bewust geen insert/update-policy voor anon/authenticated.
create policy "Iedereen leest categorie-intro's"
  on public.categorie_intro
  for select
  to anon, authenticated
  using (true);
