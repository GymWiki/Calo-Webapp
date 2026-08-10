-- ============================================================================
-- activiteiten — GymWiki activiteitenbibliotheek import
-- ============================================================================
-- Source: activiteitenGymWiki JSON export (Firestore -> this migration).
-- `id` is kept as the original Firestore document id (text, not uuid) so the
-- import script can upsert idempotently on it, exactly as requested.
-- Reference/library content, no per-user ownership — same RLS shape as the
-- other "iedereen leest openbare content" tables in this schema.
-- ============================================================================

create table if not exists public.activiteiten (
  id text primary key,
  titel text not null,
  actcode text,
  afbeelding text,
  beginsituatie text,
  beschrijving text,
  categorie text,
  beweegthema text,
  created_time timestamptz,
  doel text,
  in_gymwiki boolean not null default true,
  leerlijn text,
  loopt text[],
  lukt text[],
  leeft text[],
  niveau int,
  materiaal text[],
  onderwijs_type text,
  veld text,
  regels text[],
  taalcode text not null,
  doelgroep int[],
  filters text[],
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists idx_activiteiten_categorie on public.activiteiten (categorie);
create index if not exists idx_activiteiten_taalcode on public.activiteiten (taalcode);
create index if not exists idx_activiteiten_leerlijn on public.activiteiten (leerlijn);

-- Reuses the trigger function already defined for `lessons` (Fase: Volledige
-- Activiteiten- & Lessendatabase).
drop trigger if exists activiteiten_set_updated_at on public.activiteiten;
create trigger activiteiten_set_updated_at
  before update on public.activiteiten
  for each row execute function private.set_updated_at();

alter table public.activiteiten enable row level security;
alter table public.activiteiten force row level security;

create policy "Iedereen leest activiteiten" on public.activiteiten
  for select
  to authenticated
  using (true);

-- ============================================================================
-- Storage bucket for activiteit-afbeeldingen
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'activiteiten-afbeeldingen',
  'activiteiten-afbeeldingen',
  true,
  10485760, -- 10 MB
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;
