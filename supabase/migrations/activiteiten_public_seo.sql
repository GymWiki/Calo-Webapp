-- SEO/GEO voor de activiteitenbibliotheek: publieke, crawlbare
-- activiteit-/categoriepagina's terwijl de volledige uitwerking achter de
-- betaalmuur blijft. Zie de brief "Maak de activiteitenbibliotheek
-- vindbaar in Google en AI-zoekmachines".
--
-- ============================================================================
-- 0. KRITIEKE FIX (onafhankelijk ontdekt, hoort hier thuis): de bestaande
-- "Anonieme bezoekers lezen openbare activiteiten"-policy
-- (consolidate_lessons_into_activiteiten.sql) gaf de `anon`-rol SELECT op
-- ALLE kolommen van elke is_public=true-rij. RLS filtert rijen, geen
-- kolommen — de publieke anon-key (staat letterlijk in de client-JS) kon
-- dus vandaag al elke afgeschermde kolom (regels, deelnemers_regels,
-- aandachtspunten, didactic_items, diagram_data, ...) rechtstreeks via de
-- Supabase REST-API ophalen, buiten de app (die alles achter login houdt)
-- om. Niets in de app gebruikt vandaag anon-reads op deze tabel (de
-- landingspagina-preview gebruikt de service-role client, zie
-- lib/services/landing.ts) — deze policy droppen breekt dus niets en sluit
-- het lek. De nieuwe publieke pagina's lezen voortaan uitsluitend via de
-- view hieronder (stap 2), die een harde kolom-allowlist afdwingt.
-- ============================================================================
drop policy if exists "Anonieme bezoekers lezen openbare activiteiten" on public.activiteiten;

-- ============================================================================
-- 1. Nieuwe kolommen: slug (publieke URL, /activiteiten/[slug]) en
-- seo_summary (AI-gegenereerde 2-3 zinnen, zie checkActivityQuality). Beide
-- nullable — gevuld door de backfill (eenmalig script) voor bestaande rijen
-- en voortaan bij elke (her)goedkeuring (actions/lesson.ts,
-- actions/activity-submission.ts).
-- ============================================================================
alter table public.activiteiten
  add column if not exists slug text,
  add column if not exists seo_summary text;

-- Partial unique index (i.p.v. een gewone unique-constraint): staat
-- meerdere NULL-slugs toe (concepten, nog niet gebackfilde rijen) terwijl
-- elke daadwerkelijk gezette slug uniek moet zijn.
create unique index if not exists activiteiten_slug_key
  on public.activiteiten (slug)
  where slug is not null;

-- ============================================================================
-- 2. Publieke view — de ENIGE leesweg voor niet-ingelogde/SEO-pagina's.
-- Bewust GEEN `security_invoker`: dit is het standaard Postgres/Supabase-
-- patroon voor "veilige kolom-subset over een RLS-tabel" — de view draait
-- met de rechten van de EIGENAAR (de migratie-uitvoerende rol, die de
-- onderliggende RLS omzeilt), dus werkt voor `anon` puur op basis van de
-- GRANT hieronder, ongeacht welke RLS-policies op de basistabel staan. De
-- kolomlijst is een harde allowlist (alleen wat STAP 1 van de brief als
-- publiek aanmerkt: titel, korte AI-beschrijving, lesdoel, doelgroep,
-- leerlijn/categorie, materialen, + een illustratieve foto — dus NIET de
-- ruwe `beschrijving` (die verklapt vaak de volledige opbouw), regels,
-- loopt/lukt/leeft, deelnemers_regels, plaatje_praatje, aandachtspunten,
-- arrangement, didactic_items, diagram_data/diagram_image_url of
-- tactical_questions). De WHERE-clause dwingt de indexeerbaarheidsregel
-- (STAP 5) structureel af op databaseniveau, onafhankelijk van app-code:
-- alleen goedgekeurde, publieke, niet-AI-gegenereerde activiteiten mét een
-- geslaagd gegenereerde samenvatting zijn ooit zichtbaar via deze view.
create or replace view public.activiteiten_publiek as
select
  a.id,
  a.slug,
  a.titel,
  a.seo_summary,
  a.doel,
  a.doelgroep,
  a.leerlijn,
  a.categorie,
  a.materiaal,
  a.base_materials,
  a.rule_materials,
  a.afbeelding,
  a.public_since,
  a.created_at
from public.activiteiten a
where a.status = 'approved'
  and a.is_public = true
  and a.is_ai_generated = false
  and a.slug is not null
  and a.seo_summary is not null
  and length(a.seo_summary) >= 100;

revoke all on public.activiteiten_publiek from public;
grant select on public.activiteiten_publiek to anon, authenticated;
